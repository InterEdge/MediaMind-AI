import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/20260818120000_enforce_workspace_rls_and_backfill.sql", import.meta.url);
const cleanupMigrationUrl = new URL("../supabase/migrations/20260818130000_cleanup_legacy_business_policies.sql", import.meta.url);
const businessTables = ["documents", "chat_sessions", "drafts", "posts", "notifications", "prompts", "activities"];

function memberCanAccess(memberships, userId, workspaceId) {
  return memberships.some((membership) => membership.userId === userId && membership.workspaceId === workspaceId);
}

test("workspace membership model isolates two users and workspaces", () => {
  const memberships = [
    { userId: "user-a", workspaceId: "workspace-a" },
    { userId: "user-b", workspaceId: "workspace-b" },
  ];
  assert.equal(memberCanAccess(memberships, "user-a", "workspace-a"), true);
  assert.equal(memberCanAccess(memberships, "user-b", "workspace-a"), false);
  assert.equal(memberCanAccess(memberships, "user-a", "workspace-b"), false);
});

test("backfill requires a safely inferred or explicit beta owner and validates workspace membership", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /current_setting\('mediamind\.beta_owner_email', true\)/);
  assert.match(sql, /current_setting\('mediamind\.beta_workspace_id', true\)/);
  assert.match(sql, /candidate_count <> 1/);
  assert.match(sql, /w\.created_by = beta_owner_id/);
  assert.match(sql, /wm\.user_id = beta_owner_id/);
  assert.match(sql, /wm\.role = 'owner'/);
});

test("all legacy-owned tables are backfilled and verified before NOT NULL enforcement", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const verificationIndex = sql.indexOf("backfill verification failed");
  for (const table of businessTables) {
    assert.match(sql, new RegExp(`UPDATE public\\.${table} SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL`, "i"));
    const notNullIndex = sql.indexOf(`ALTER TABLE public.${table} ALTER COLUMN workspace_id SET NOT NULL`);
    assert.ok(verificationIndex >= 0 && notNullIndex > verificationIndex, `${table} must become NOT NULL only after verification`);
  }
});

test("business tables expose membership-scoped authenticated CRUD policies only", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of businessTables) {
    for (const operation of ["select", "insert", "update", "delete"]) {
      assert.match(sql, new RegExp(`CREATE POLICY "${table}_workspace_${operation}" ON public\\.${table}`, "i"));
    }
  }
  assert.doesNotMatch(sql, /CREATE POLICY[\s\S]{0,160}TO anon/i);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON[\s\S]+FROM anon;/i);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON[\s\S]+FROM authenticated;/i);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON[\s\S]+TO authenticated;/i);
});

test("all exact historical permissive policy names are removed", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const names = [
    ...businessTables.filter((table) => table !== "chat_sessions").flatMap((table) =>
      ["sel", "ins", "upd", "del"].map((suffix) => `anon_crud_${table}_${suffix}`)),
    ...["select", "insert", "update", "delete"].flatMap((operation) => [
      `dev_anon_${operation}_chat_sessions`,
      `dev_anon_${operation}_chat_messages`,
      `prompt_library_${operation}`,
    ]),
  ];
  for (const name of names) assert.match(sql, new RegExp(`DROP POLICY IF EXISTS "${name}"`, "i"));
});

test("chat messages inherit membership through their parent session", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`CREATE POLICY "chat_messages_workspace_${operation}"`, "i"));
  }
  assert.match(sql, /session\.id = chat_messages\.session_id[\s\S]+public\.is_workspace_member\(session\.workspace_id\)/);
  assert.doesNotMatch(sql, /ALTER TABLE public\.chat_messages[\s\S]{0,100}ADD COLUMN[\s\S]{0,30}workspace_id/i);
});

test("prompt usage remains SECURITY INVOKER and membership scoped", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const functionSql = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.increment_prompt_uses"));
  assert.match(functionSql, /SECURITY INVOKER/);
  assert.match(functionSql, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(functionSql, /REVOKE ALL ON FUNCTION public\.increment_prompt_uses\(uuid\) FROM anon/);
  assert.match(functionSql, /GRANT EXECUTE ON FUNCTION public\.increment_prompt_uses\(uuid\) TO authenticated/);
});

test("notifications and activities use the same workspace isolation contract", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of ["notifications", "activities"]) {
    assert.match(sql, new RegExp(`${table}_workspace_select[\\s\\S]{0,160}public\\.is_workspace_member\\(workspace_id\\)`, "i"));
    assert.match(sql, new RegExp(`${table}_workspace_insert[\\s\\S]{0,160}public\\.is_workspace_member\\(workspace_id\\)`, "i"));
  }
});

test("corrective cleanup removes repository and verified live permissive policy names", async () => {
  const sql = await readFile(cleanupMigrationUrl, "utf8");
  const policies = [
    "Allow development activity reads",
    "Allow development activity writes",
    "Allow document insert",
    "Allow document read",
    "Allow public document deletes",
    "Allow public document reads",
    "Allow public document updates",
    "Allow public document uploads",
    "Allow public draft deletes",
    "Allow public draft inserts",
    "Allow public draft reads",
    "Allow public draft updates",
    "notifications_insert",
    "notifications_select",
    "notifications_update",
    "notifications_delete",
    "prompt_library_select",
    "dev_anon_select_chat_sessions",
    "dev_anon_select_chat_messages",
  ];
  for (const policy of policies) {
    assert.match(sql, new RegExp(`DROP POLICY IF EXISTS "${policy}"`, "i"));
  }
  for (const table of businessTables.filter((table) => table !== "chat_sessions")) {
    for (const suffix of ["sel", "ins", "upd", "del"]) {
      assert.match(sql, new RegExp(`DROP POLICY IF EXISTS "anon_crud_${table}_${suffix}"`, "i"));
    }
  }
});

test("corrective cleanup preserves workspace policies and removes anon table privileges", async () => {
  const sql = await readFile(cleanupMigrationUrl, "utf8");
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS "[^"]*_workspace_(select|insert|update|delete)"/i);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
  assert.doesNotMatch(sql, /UPDATE public\.|DELETE FROM public\.|INSERT INTO public\./i);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON[\s\S]+FROM anon;/i);
});
