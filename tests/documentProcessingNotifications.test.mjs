import assert from "node:assert/strict";
import test from "node:test";

import {
  emitDocumentProcessingNotification,
  persistTerminalDocumentFailure,
} from "../supabase/functions/_shared/documentNotifications.ts";

const document = {
  id: "00000000-0000-0000-0000-000000000010",
  title: "market-research.pdf",
};

function repository({ failNotifications = false } = {}) {
  const eventKeys = new Set();
  const notifications = [];
  const failedUpdates = [];
  return {
    notifications,
    failedUpdates,
    async insertNotification(payload) {
      if (failNotifications) throw new Error("notification insert unavailable");
      if (eventKeys.has(payload.event_key)) throw { code: "23505", message: "duplicate key" };
      eventKeys.add(payload.event_key);
      notifications.push(structuredClone(payload));
    },
    async markDocumentFailed(documentId) {
      failedUpdates.push({ documentId, ai_status: "failed", status: "Failed" });
    },
  };
}

test("successful processing emits exactly one ready notification", async () => {
  const repo = repository();
  await emitDocumentProcessingNotification(document, "ready", repo);
  assert.equal(repo.notifications.length, 1);
  assert.equal(repo.notifications[0].title, "Document ready");
  assert.equal(repo.notifications[0].related_record_id, document.id);
  assert.equal(repo.notifications[0].related_record_type, "document");
  assert.equal(repo.notifications[0].metadata.file_name, document.title);
});

test("ready notification retry is idempotent", async () => {
  const repo = repository();
  await emitDocumentProcessingNotification(document, "ready", repo);
  await emitDocumentProcessingNotification(document, "ready", repo);
  assert.equal(repo.notifications.length, 1);
});

test("terminal failure persists failed status and emits exactly one notification", async () => {
  const repo = repository();
  await persistTerminalDocumentFailure(document, repo);
  assert.deepEqual(repo.failedUpdates, [{ documentId: document.id, ai_status: "failed", status: "Failed" }]);
  assert.equal(repo.notifications.length, 1);
  assert.equal(repo.notifications[0].title, "Document processing failed");
  assert.equal(repo.notifications[0].metadata.processing_status, "failed");
});

test("failed notification retry does not duplicate the event", async () => {
  const repo = repository();
  await persistTerminalDocumentFailure(document, repo);
  await persistTerminalDocumentFailure(document, repo);
  assert.equal(repo.notifications.length, 1);
  assert.equal(repo.failedUpdates.length, 2);
});

test("notification insert failure does not make successful processing fail", async () => {
  const warning = await emitDocumentProcessingNotification(document, "ready", repository({ failNotifications: true }));
  assert.match(warning, /could not be created/);
});

test("terminal failure status persists even when its notification insert fails", async () => {
  const repo = repository({ failNotifications: true });
  const warning = await persistTerminalDocumentFailure(document, repo);
  assert.equal(repo.failedUpdates.length, 1);
  assert.equal(repo.failedUpdates[0].status, "Failed");
  assert.match(warning, /could not be created/);
});

test("intermediate processing states do not emit notifications", async () => {
  const repo = repository();
  for (const status of ["pending", "extracting", "ai_processing"]) {
    await emitDocumentProcessingNotification(document, status, repo);
  }
  assert.equal(repo.notifications.length, 0);
});
