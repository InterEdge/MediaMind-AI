import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPostReschedulePatch,
  executePostDelete,
  executePostEdit,
  executePostReschedule,
  executePostStatusChange,
  isCalendarVisiblePost,
  isUpcomingPost,
} from "../src/utils/postWorkflow.ts";

const now = new Date("2026-08-14T12:00:00.000Z");
const post = {
  id: "post-1",
  draft_id: "draft-1",
  title: "Scheduled snapshot",
  content: "Original post content",
  platform: "LinkedIn",
  hashtags: ["launch"],
  status: "Scheduled",
  scheduled_at: "2026-08-15T14:00:00.000Z",
};

function repository({ failActivity = false } = {}) {
  const updates = [];
  const deletedPostIds = [];
  const deletedDraftIds = [];
  const activities = [];
  return {
    updates,
    deletedPostIds,
    deletedDraftIds,
    activities,
    async updatePost(postId, patch) { updates.push({ postId, patch: structuredClone(patch) }); },
    async deletePost(postId) { deletedPostIds.push(postId); },
    async logActivity(activity) {
      if (failActivity) throw new Error("activity unavailable");
      activities.push(activity);
    },
  };
}

test("Scheduled posts with valid dates are Calendar-visible", () => {
  assert.equal(isCalendarVisiblePost(post), true);
});

test("Cancelled and Published posts are excluded from active Calendar display", () => {
  assert.equal(isCalendarVisiblePost({ ...post, status: "Cancelled" }), false);
  assert.equal(isCalendarVisiblePost({ ...post, status: "Published" }), false);
});

test("only future Scheduled posts appear in Upcoming Posts", () => {
  assert.equal(isUpcomingPost(post, now), true);
  assert.equal(isUpcomingPost({ ...post, status: "Published" }, now), false);
  assert.equal(isUpcomingPost({ ...post, scheduled_at: "2026-08-13T10:00:00.000Z" }, now), false);
});

test("legacy and unknown post statuses do not crash or appear active", () => {
  for (const status of ["Draft", "Failed", "Unknown"]) {
    assert.doesNotThrow(() => isCalendarVisiblePost({ ...post, status }));
    assert.equal(isCalendarVisiblePost({ ...post, status }), false);
  }
});

test("rescheduling rejects past timestamps", () => {
  assert.throws(() => buildPostReschedulePatch("Scheduled", "2026-08-13", "10:00", now), /future/);
});

test("rescheduling converts valid browser-local date and time to ISO", () => {
  const patch = buildPostReschedulePatch("Scheduled", "2026-08-16", "09:30", now);
  assert.equal(patch.scheduled_at, new Date("2026-08-16T09:30").toISOString());
});

test("rescheduling updates the existing post row and never creates one", async () => {
  const repo = repository();
  const result = await executePostReschedule(post, "2026-08-16", "09:30", repo, now);
  assert.equal(repo.updates.length, 1);
  assert.equal(repo.updates[0].postId, post.id);
  assert.equal(result.patch.status, "Scheduled");
});

test("cancelling preserves scheduling data and changes status", async () => {
  const repo = repository();
  const result = await executePostStatusChange(post, "Cancelled", repo, now);
  assert.equal(result.patch.status, "Cancelled");
  assert.equal(Object.hasOwn(result.patch, "scheduled_at"), false);
});

test("publishing changes status without changing the linked draft", async () => {
  const repo = repository();
  const result = await executePostStatusChange(post, "Published", repo, now);
  assert.equal(result.patch.status, "Published");
  assert.equal(Object.hasOwn(result.patch, "draft_id"), false);
});

test("editing the post snapshot does not mutate draft data", async () => {
  const draft = { id: "draft-1", title: "Draft title", content: "Draft content" };
  const repo = repository();
  await executePostEdit(post, {
    title: " Updated post ",
    content: " Updated content ",
    platform: " LinkedIn ",
    hashtags: ["#new"],
  }, repo, now);
  assert.deepEqual(draft, { id: "draft-1", title: "Draft title", content: "Draft content" });
  assert.equal(repo.updates[0].patch.title, "Updated post");
  assert.deepEqual(repo.updates[0].patch.hashtags, ["new"]);
});

test("delete removes only the post row and leaves the draft untouched", async () => {
  const repo = repository();
  const result = await executePostDelete(post, repo);
  assert.equal(result.deleted, true);
  assert.deepEqual(repo.deletedPostIds, [post.id]);
  assert.deepEqual(repo.deletedDraftIds, []);
});

test("restoring a Cancelled post updates the same row to Scheduled", async () => {
  const repo = repository();
  const cancelled = { ...post, status: "Cancelled" };
  const result = await executePostReschedule(cancelled, "2026-08-17", "11:00", repo, now);
  assert.equal(repo.updates.length, 1);
  assert.equal(repo.updates[0].postId, cancelled.id);
  assert.equal(result.patch.status, "Scheduled");
  assert.equal(repo.activities[0].operation, "restore");
});

test("activity failure remains a warning after successful primary mutation", async () => {
  const repo = repository({ failActivity: true });
  const result = await executePostStatusChange(post, "Cancelled", repo, now);
  assert.equal(repo.updates.length, 1);
  assert.match(result.activityWarning, /activity could not be recorded/);
});
