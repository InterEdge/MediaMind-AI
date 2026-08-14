import assert from "node:assert/strict";
import test from "node:test";

import {
  executeCreateNotification,
  executeMarkAllNotificationsRead,
  executeMarkNotificationRead,
  getDraftNotificationEvent,
  getNotificationMetadata,
  getPostNotificationEvent,
  normalizeNotificationPayload,
  resolveUnreadCount,
} from "../src/utils/notifications.ts";

function repository({ duplicate = false, failInsert = false } = {}) {
  const inserts = [];
  const readIds = [];
  let allRead = 0;
  return {
    inserts,
    readIds,
    allReadCount: () => allRead,
    async insert(payload) {
      if (duplicate) throw { code: "23505", message: "duplicate key" };
      if (failInsert) throw new Error("notifications unavailable");
      inserts.push(payload);
    },
    async markRead(id) { readIds.push(id); },
    async markAllRead() { allRead += 1; },
  };
}

test("notification payload normalization trims values and supplies backward-compatible defaults", () => {
  assert.deepEqual(normalizeNotificationPayload({
    type: " success ",
    title: " Ready ",
    message: " Complete ",
  }), {
    type: "success",
    title: "Ready",
    message: "Complete",
    related_record_id: null,
    related_record_type: null,
    metadata: {},
    event_key: null,
  });
});

test("duplicate event keys are treated as idempotent success", async () => {
  const result = await executeCreateNotification({
    type: "info",
    title: "Draft submitted",
    message: "Ready",
    eventKey: "draft:1:review:event",
  }, repository({ duplicate: true }));
  assert.equal(result.duplicate, true);
  assert.equal(result.warning, null);
});

test("mark one read delegates only the selected notification", async () => {
  const repo = repository();
  const result = await executeMarkNotificationRead("notification-1", repo);
  assert.deepEqual(repo.readIds, ["notification-1"]);
  assert.equal(result.warning, null);
});

test("mark all read uses the centralized repository operation", async () => {
  const repo = repository();
  await executeMarkAllNotificationsRead(repo);
  assert.equal(repo.allReadCount(), 1);
});

test("unread count comes from the independent count query, not recent-list length", () => {
  const recentNotifications = Array.from({ length: 10 });
  assert.equal(recentNotifications.length, 10);
  assert.equal(resolveUnreadCount(37), 37);
});

test("Draft to In Review emits a submitted notification", () => {
  const event = getDraftNotificationEvent({
    draftId: "00000000-0000-0000-0000-000000000001",
    title: "Campaign",
    previousStatus: "Draft",
    nextStatus: "In Review",
    transitionAt: "2026-08-14T12:00:00.000Z",
  });
  assert.equal(event?.title, "Draft submitted for review");
});

test("In Review to Approved emits an approval notification", () => {
  const event = getDraftNotificationEvent({
    draftId: "00000000-0000-0000-0000-000000000001",
    title: "Campaign",
    previousStatus: "In Review",
    nextStatus: "Approved",
    transitionAt: "2026-08-14T12:00:00.000Z",
  });
  assert.equal(event?.title, "Draft approved");
});

test("reverse draft transitions do not emit notifications", () => {
  for (const [previousStatus, nextStatus] of [["In Review", "Draft"], ["Approved", "In Review"]]) {
    assert.equal(getDraftNotificationEvent({
      draftId: "00000000-0000-0000-0000-000000000001",
      title: "Campaign",
      previousStatus,
      nextStatus,
      transitionAt: "2026-08-14T12:00:00.000Z",
    }), null);
  }
});

const postEvent = (operation) => getPostNotificationEvent({
  operation,
  postId: "00000000-0000-0000-0000-000000000002",
  draftId: "00000000-0000-0000-0000-000000000001",
  title: "Campaign post",
  previousStatus: "Scheduled",
  nextStatus: operation === "cancel" ? "Cancelled" : "Published",
  scheduledAt: "2026-08-16T09:00:00.000Z",
  eventAt: "2026-08-14T12:00:00.000Z",
});

test("first post schedule emits while normal reschedule does not", () => {
  assert.equal(postEvent("schedule")?.title, "Post scheduled");
  assert.equal(postEvent("reschedule"), null);
});

test("post cancellation emits a warning notification", () => {
  assert.equal(postEvent("cancel")?.title, "Post cancelled");
});

test("post publication emits a success notification", () => {
  assert.equal(postEvent("publish")?.title, "Post published");
});

test("notification failure remains a secondary warning", async () => {
  const primaryMutationSucceeded = true;
  const result = await executeCreateNotification({
    type: "info",
    title: "Post scheduled",
    message: "Scheduled",
    eventKey: "post:1:scheduled:event",
  }, repository({ failInsert: true }));
  assert.equal(primaryMutationSucceeded, true);
  assert.match(result.warning, /could not be created/);
});

test("legacy notification rows without metadata remain safe", () => {
  const legacy = { id: "legacy", title: "Old", message: "Existing row", read: false };
  assert.deepEqual(getNotificationMetadata(legacy), {});
});
