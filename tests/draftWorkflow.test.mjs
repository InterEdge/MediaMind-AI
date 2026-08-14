import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDraftTransitionPatch,
  canScheduleDraft,
  canTransitionDraftStatus,
  executeDraftScheduling,
  getAllowedDraftTransitions,
  isDisplayableDraftStatus,
  normalizeReviewNote,
} from "../src/utils/draftWorkflow.ts";

const now = "2026-08-14T12:00:00.000Z";

test("allows Draft to In Review", () => {
  assert.equal(canTransitionDraftStatus("Draft", "In Review"), true);
  assert.deepEqual(getAllowedDraftTransitions("Draft"), ["In Review"]);
});

const approvedDraft = {
  id: "draft-1",
  title: "Launch update",
  content: "The exact approved copy.",
  platform: "LinkedIn",
  status: "Approved",
  hashtags: ["launch", "update"],
};

function createSchedulingRepository({ failActivity = false } = {}) {
  const posts = new Map();
  const activities = [];
  let creates = 0;
  let updates = 0;

  return {
    posts,
    activities,
    counts: () => ({ creates, updates }),
    async findLinkedPostId(draftId) {
      return posts.get(draftId)?.id ?? null;
    },
    async createPost(snapshot) {
      creates += 1;
      const id = `post-${creates}`;
      posts.set(snapshot.draft_id, { id, ...structuredClone(snapshot) });
      return id;
    },
    async updatePost(postId, snapshot) {
      updates += 1;
      posts.set(snapshot.draft_id, { id: postId, ...structuredClone(snapshot) });
    },
    async logSchedulingActivity(activity) {
      if (failActivity) throw new Error("activity unavailable");
      activities.push(activity);
    },
  };
}

test("only Approved drafts are eligible for scheduling", () => {
  assert.equal(canScheduleDraft("Approved"), true);
  assert.equal(canScheduleDraft("Draft"), false);
  assert.equal(canScheduleDraft("In Review"), false);
  assert.equal(canScheduleDraft("Published"), false);
});

test("accepts a future local datetime and creates an exact post snapshot", async () => {
  const repository = createSchedulingRepository();
  const result = await executeDraftScheduling(
    approvedDraft,
    "2026-08-15",
    "14:30",
    repository,
    new Date("2026-08-14T12:00:00.000Z"),
  );

  assert.equal(result.rescheduled, false);
  assert.equal(repository.counts().creates, 1);
  assert.equal(repository.counts().updates, 0);
  const post = repository.posts.get(approvedDraft.id);
  assert.equal(post.draft_id, approvedDraft.id);
  assert.equal(post.title, approvedDraft.title);
  assert.equal(post.content, approvedDraft.content);
  assert.equal(post.platform, approvedDraft.platform);
  assert.deepEqual(post.hashtags, approvedDraft.hashtags);
  assert.equal(post.status, "Scheduled");
  assert.equal(repository.activities.length, 1);
  assert.equal(repository.activities[0].rescheduled, false);

  approvedDraft.content = "A later draft edit.";
  assert.equal(post.content, "The exact approved copy.");
  approvedDraft.content = "The exact approved copy.";
});

test("rejects non-Approved drafts before any post mutation", async () => {
  for (const status of ["Draft", "In Review", "Published"]) {
    const repository = createSchedulingRepository();
    await assert.rejects(
      executeDraftScheduling({ ...approvedDraft, status }, "2026-08-15", "14:30", repository, new Date("2026-08-14T12:00:00.000Z")),
      /Only Approved drafts/,
    );
    assert.deepEqual(repository.counts(), { creates: 0, updates: 0 });
  }
});

test("rejects missing, invalid, and past schedule values", async () => {
  const nowDate = new Date("2026-08-14T12:00:00.000Z");
  for (const [date, time] of [["", "14:30"], ["not-a-date", "14:30"], ["2020-01-01", "10:00"]]) {
    const repository = createSchedulingRepository();
    await assert.rejects(executeDraftScheduling(approvedDraft, date, time, repository, nowDate));
    assert.deepEqual(repository.counts(), { creates: 0, updates: 0 });
  }
});

test("a second schedule reschedules the linked post instead of creating a duplicate", async () => {
  const repository = createSchedulingRepository();
  const nowDate = new Date("2026-08-14T12:00:00.000Z");
  await executeDraftScheduling(approvedDraft, "2026-08-15", "14:30", repository, nowDate);
  const result = await executeDraftScheduling(approvedDraft, "2026-08-16", "09:00", repository, nowDate);

  assert.equal(result.rescheduled, true);
  assert.deepEqual(repository.counts(), { creates: 1, updates: 1 });
  assert.equal(repository.posts.size, 1);
  assert.equal(repository.activities[1].rescheduled, true);
});

test("activity failure is reported without undoing the scheduled post", async () => {
  const repository = createSchedulingRepository({ failActivity: true });
  const result = await executeDraftScheduling(
    approvedDraft,
    "2026-08-15",
    "14:30",
    repository,
    new Date("2026-08-14T12:00:00.000Z"),
  );

  assert.equal(repository.posts.size, 1);
  assert.match(result.activityWarning, /activity could not be recorded/);
});

test("successful scheduling refreshes the shared posts data path", async () => {
  const repository = createSchedulingRepository();
  let refreshes = 0;
  await executeDraftScheduling(
    approvedDraft,
    "2026-08-15",
    "14:30",
    repository,
    new Date("2026-08-14T12:00:00.000Z"),
    () => { refreshes += 1; },
  );

  assert.equal(refreshes, 1);
});

test("allows In Review to Draft", () => {
  assert.equal(canTransitionDraftStatus("In Review", "Draft"), true);
});

test("allows In Review to Approved", () => {
  assert.equal(canTransitionDraftStatus("In Review", "Approved"), true);
});

test("allows Approved to In Review", () => {
  assert.equal(canTransitionDraftStatus("Approved", "In Review"), true);
});

test("rejects Draft to Approved", () => {
  assert.equal(canTransitionDraftStatus("Draft", "Approved"), false);
  assert.throws(() => buildDraftTransitionPatch("Draft", "Approved", undefined, now), /Invalid draft status transition/);
});

test("rejects Approved to Draft", () => {
  assert.equal(canTransitionDraftStatus("Approved", "Draft"), false);
});

test("entering Approved sets approved_at", () => {
  const patch = buildDraftTransitionPatch("In Review", "Approved", undefined, now);
  assert.equal(patch.approved_at, now);
  assert.equal(patch.updated_at, now);
});

test("leaving Approved clears approved_at", () => {
  const patch = buildDraftTransitionPatch("Approved", "In Review", undefined, now);
  assert.equal(patch.approved_at, null);
});

test("review notes are trimmed, preserved when omitted, and clearable", () => {
  assert.equal(normalizeReviewNote("  Ready after legal review.  "), "Ready after legal review.");
  assert.equal(normalizeReviewNote(undefined), undefined);
  assert.equal(normalizeReviewNote("   "), null);

  const omitted = buildDraftTransitionPatch("Draft", "In Review", undefined, now);
  assert.equal(Object.hasOwn(omitted, "review_note"), false);

  const cleared = buildDraftTransitionPatch("Draft", "In Review", "   ", now);
  assert.equal(cleared.review_note, null);
});

test("legacy Published remains displayable but has no transitions", () => {
  assert.equal(isDisplayableDraftStatus("Published"), true);
  assert.deepEqual(getAllowedDraftTransitions("Published"), []);
});

test("unsupported and arbitrary statuses have no mutation path", () => {
  assert.equal(canTransitionDraftStatus("Draft", "Published"), false);
  assert.equal(canTransitionDraftStatus("Published", "Approved"), false);
  assert.equal(canTransitionDraftStatus("Unknown", "In Review"), false);
  assert.deepEqual(getAllowedDraftTransitions("Unknown"), []);
});
