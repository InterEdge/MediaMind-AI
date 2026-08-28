import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDocumentProcessingNotification } from "../supabase/functions/_shared/documentNotifications.ts";

import {
  assertWorkspaceLink,
  buildWorkspaceStoragePath,
  requireActiveWorkspaceId,
  setActiveWorkspaceId,
  withActiveWorkspace,
} from "../src/utils/workspaceOwnership.ts";

test("owned records require a resolved active workspace", () => {
  setActiveWorkspaceId(null);
  assert.throws(() => requireActiveWorkspaceId(), /active workspace is required/i);
  assert.throws(() => withActiveWorkspace({ title: "Draft" }), /active workspace is required/i);
});

test("owned insert composition applies the active workspace", () => {
  setActiveWorkspaceId("workspace-1");
  assert.deepEqual(withActiveWorkspace({ title: "Draft" }), { title: "Draft", workspace_id: "workspace-1" });
});

test("document storage paths are workspace-prefixed and use generated object IDs", () => {
  setActiveWorkspaceId("workspace-1");
  assert.equal(buildWorkspaceStoragePath("Report.PDF", "file-1"), "workspace-1/file-1.pdf");
});

test("linked records require the exact active workspace", () => {
  setActiveWorkspaceId("workspace-1");
  assert.equal(assertWorkspaceLink({ workspace_id: "workspace-1" }, "Draft"), "workspace-1");
  assert.throws(() => assertWorkspaceLink({ workspace_id: null }, "Draft"), /different workspace/i);
  assert.throws(() => assertWorkspaceLink({ workspace_id: "workspace-2" }, "Draft"), /different workspace/i);
});

test("server document notifications inherit document workspace ownership", () => {
  const notification = buildDocumentProcessingNotification(
    { id: "document-1", title: "Plan.pdf", workspace_id: "workspace-1" },
    "ready",
  );
  assert.equal(notification?.workspace_id, "workspace-1");
});

test("core creation paths compose workspace ownership", async () => {
  const paths = [
    "src/services/documents.ts",
    "src/services/contentGenerator.ts",
    "src/services/draftWorkflow.ts",
    "src/services/notifications.ts",
    "src/services/knowledgeChat.ts",
    "src/services/postWorkflow.ts",
    "src/views/PromptLibrary.tsx",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /withActiveWorkspace/, `${path} should use centralized ownership composition`);
  }
});

test("Dashboard greeting resolves authenticated identity", async () => {
  const source = await readFile(new URL("../src/views/Dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /getDisplayName\(profile\?\.display_name, user\?\.email\)/);
  assert.doesNotMatch(source, /Welcome back, Alex/);
});

test("ownership foundation migration is nullable, indexed, and leaves RLS untouched", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260817120000_add_business_workspace_ownership.sql", import.meta.url), "utf8");
  for (const table of ["documents", "chat_sessions", "drafts", "posts", "notifications", "prompts", "activities"]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public\\.workspaces\\(id\\)`, "i"));
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS ${table}_workspace_id_idx`, "i"));
  }
  assert.doesNotMatch(sql, /workspace_id uuid NOT NULL/i);
  assert.doesNotMatch(sql, /CREATE POLICY|DROP POLICY|DISABLE ROW LEVEL SECURITY/i);
});

test("frontend reads no longer include legacy null-owned records", async () => {
  const paths = ["src/App.tsx", "src/services/documents.ts", "src/services/knowledgeChat.ts", "src/services/search.ts"];
  for (const path of paths) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /workspace_id\.is\.null|legacyCompatibleWorkspaceFilter/);
    assert.match(source, /\.eq\("workspace_id",/);
  }
});

test.after(() => setActiveWorkspaceId(null));
