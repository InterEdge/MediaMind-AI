import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared Edge auth validates bearer JWT before creating the privileged client", async () => {
  const source = await read("supabase/functions/_shared/edgeAuth.ts");
  const getUserIndex = source.indexOf("auth.getUser");
  const serviceRoleIndex = source.indexOf("SUPABASE_SERVICE_ROLE_KEY");
  assert.match(source, /Authorization/);
  assert.match(source, /Invalid or expired authentication token/);
  assert.ok(getUserIndex >= 0 && serviceRoleIndex > getUserIndex);
  assert.match(source, /workspace_members/);
  assert.match(source, /\.eq\("user_id", auth\.user\.id\)/);
});

test("all protected Edge handlers authenticate and return authorization responses", async () => {
  for (const name of ["generate-content", "knowledge-chat", "process-document"]) {
    const source = await read(`supabase/functions/${name}/index.ts`);
    assert.match(source, /authenticateEdgeRequest\(req\)/, `${name} must authenticate the caller`);
    assert.match(source, /edgeAuthorizationResponse\(err, corsHeaders\)/, `${name} must preserve 401\/403 responses`);
  }
});

test("generate-content validates workspace, prompt, and every selected document", async () => {
  const source = await read("supabase/functions/generate-content/index.ts");
  assert.match(source, /requireWorkspaceMembership\(auth, body\.workspaceId\)/);
  assert.match(source, /from\("prompts"\)[\s\S]+\.eq\("workspace_id", workspaceId\)/);
  assert.match(source, /from\("documents"\)[\s\S]+\.in\("id", requestedIds\)[\s\S]+\.eq\("workspace_id", workspaceId\)/);
  assert.match(source, /\(docs \?\? \[\]\)\.length !== requestedIds\.length/);
});

test("knowledge-chat retrieval is restricted to the authorized workspace", async () => {
  const source = await read("supabase/functions/knowledge-chat/index.ts");
  assert.match(source, /requireWorkspaceMembership\(auth, body\.workspaceId\)/);
  assert.match(source, /from\("documents"\)[\s\S]+\.eq\("workspace_id", workspaceId\)/);
});

test("process-document validates metadata workspace and prefixed storage path before download", async () => {
  const source = await read("supabase/functions/process-document/index.ts");
  const membershipIndex = source.indexOf("requireWorkspaceMembership(auth, doc.workspace_id)");
  const pathIndex = source.indexOf("requireWorkspaceStoragePath(doc.file_path, doc.workspace_id)");
  const downloadIndex = source.indexOf(".download(doc.file_path)");
  assert.ok(membershipIndex >= 0 && pathIndex > membershipIndex && downloadIndex > pathIndex);
  assert.match(source, /workspaceId !== doc\.workspace_id/);
  assert.match(source, /workspace_id: doc\.workspace_id/);
});

test("frontend Edge requests use the user access token, never the anon key as bearer", async () => {
  const source = await read("src/services/edgeFunctions.ts");
  assert.match(source, /data\.session\?\.access_token/);
  assert.match(source, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.doesNotMatch(source, /Authorization: `Bearer \$\{anonKey\}`/);
  assert.match(source, /workspaceId: requireActiveWorkspaceId\(\)/);
});

test("storage migration is private, authenticated-only, and membership scoped", async () => {
  const sql = await read("supabase/migrations/20260819120000_enforce_private_workspace_storage.sql");
  assert.match(sql, /UPDATE storage\.buckets[\s\S]+SET public = false[\s\S]+WHERE id = 'documents'/);
  assert.match(sql, /Document storage migration is incomplete/);
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`CREATE POLICY "documents_workspace_storage_${operation}"`, "i"));
  }
  assert.doesNotMatch(sql, /CREATE POLICY[\s\S]{0,120}TO anon/i);
  assert.match(sql, /public\.is_workspace_member\(public\.storage_object_workspace_id\(name\)\)/);
  for (const legacyPolicy of [
    "Allow anonymous uploads flreew_0",
    "Allow anonymous viewing flreew_0",
    "Allow uploads flreew_0",
    "Allow viewing files flreew_0",
  ]) {
    assert.match(sql, new RegExp(`DROP POLICY IF EXISTS "${legacyPolicy}" ON storage\\.objects`, "i"));
  }
});

test("legacy object migration copies and verifies before metadata update without deleting sources", async () => {
  const source = await read("scripts/migrate-document-storage.mjs");
  const copyIndex = source.indexOf("bucket.copy");
  const verifyIndex = source.indexOf("bucket.download(destination)");
  const updateIndex = source.indexOf('.from("documents")', verifyIndex);
  assert.ok(copyIndex >= 0 && verifyIndex > copyIndex && updateIndex > verifyIndex);
  assert.doesNotMatch(source, /bucket\.remove/);
  assert.match(source, /legacyObjectsDeleted: 0/);
});

test("signed URLs are short-lived values and are never persisted", async () => {
  const source = await read("src/services/documents.ts");
  assert.match(source, /createDocumentSignedUrl/);
  assert.match(source, /expiresIn = 300/);
  assert.match(source, /createSignedUrl\(document\.file_path, expiresIn\)/);
  const signedUrlStart = source.indexOf("createDocumentSignedUrl");
  const signedUrlFunction = source.slice(signedUrlStart, source.indexOf("export async function", signedUrlStart + 10));
  assert.doesNotMatch(signedUrlFunction, /\.insert\(|\.update\(/);
});
