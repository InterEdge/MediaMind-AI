import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20260816120000_add_auth_workspace_foundation.sql", import.meta.url), "utf8");
const triggerFunction = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.handle_new_auth_user()"), sql.indexOf("REVOKE ALL ON FUNCTION public.handle_new_auth_user()"));

test("new auth users are provisioned by an unconditional provider-independent insert trigger", () => {
  assert.match(sql, /CREATE TRIGGER on_auth_user_created\s+AFTER INSERT ON auth\.users\s+FOR EACH ROW EXECUTE FUNCTION public\.handle_new_auth_user\(\)/);
  assert.doesNotMatch(triggerFunction, /provider|email_confirmed_at|encrypted_password|raw_app_meta_data/i);
  assert.match(triggerFunction, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.handle_new_auth_user\(\) FROM PUBLIC/);
});

test("provisioning binds profile, personal workspace, and owner membership to the new user ID", () => {
  assert.match(triggerFunction, /INSERT INTO public\.profiles \(id, display_name\)\s+VALUES \(NEW\.id, resolved_display_name\)/);
  assert.match(triggerFunction, /INSERT INTO public\.workspaces \(name, created_by\)[\s\S]*?NEW\.id\)\s+RETURNING id INTO personal_workspace_id/);
  assert.match(triggerFunction, /INSERT INTO public\.workspace_members \(workspace_id, user_id, role\)\s+VALUES \(personal_workspace_id, NEW\.id, 'owner'\)/);
  assert.doesNotMatch(triggerFunction, /EXCEPTION\s+WHEN/i);
});

test("Google metadata without display_name safely falls back to email then a generic name", () => {
  assert.match(triggerFunction, /COALESCE\(\s+NULLIF\(BTRIM\(NEW\.raw_user_meta_data ->> 'display_name'\), ''\),\s+NULLIF\(SPLIT_PART\(COALESCE\(NEW\.email, ''\), '@', 1\), ''\),\s+'MediaMind User'/);
});

test("provisioning reuses an existing personal workspace and guards duplicate profile and membership rows", () => {
  assert.match(triggerFunction, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(triggerFunction, /WHERE created_by = NEW\.id[\s\S]*?IF personal_workspace_id IS NULL THEN/);
  assert.match(triggerFunction, /ON CONFLICT \(workspace_id, user_id\)/);
  assert.match(sql, /PRIMARY KEY \(workspace_id, user_id\)/);
});

test("workspace access is based on authenticated membership and clients cannot provision ownership", () => {
  assert.match(sql, /WHERE workspace_id = target_workspace_id\s+AND user_id = auth\.uid\(\)/);
  assert.match(sql, /ON public\.profiles FOR SELECT TO authenticated\s+USING \(id = auth\.uid\(\)\)/);
  assert.match(sql, /ON public\.workspaces FOR SELECT TO authenticated\s+USING \(public\.is_workspace_member\(id\)\)/);
  assert.match(sql, /REVOKE ALL ON public\.profiles, public\.workspaces, public\.workspace_members FROM authenticated/);
  assert.doesNotMatch(sql, /GRANT[^;]*(?:INSERT|ALL)[^;]*TO authenticated/i);
});
