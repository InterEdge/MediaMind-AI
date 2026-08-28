import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { requireResolvedWorkspace, validateLoginCredentials, validateSignUpCredentials, type AuthCredentials, type SignUpCredentials } from "../utils/auth";

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMembership {
  workspace_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
  updated_at: string;
}

export interface ResolvedAuthWorkspace {
  profile: Profile;
  workspace: Workspace;
  membership: WorkspaceMembership;
}

export async function restoreSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Failed to restore session: ${error.message}`);
  return data.session;
}

export async function loginWithPassword(credentials: AuthCredentials): Promise<void> {
  const normalized = validateLoginCredentials(credentials);
  const { error } = await supabase.auth.signInWithPassword(normalized);
  if (error) throw new Error(error.message);
}

export async function signUpWithPassword(credentials: SignUpCredentials): Promise<{ confirmationRequired: boolean }> {
  const normalized = validateSignUpCredentials(credentials);
  const { data, error } = await supabase.auth.signUp({
    email: normalized.email,
    password: normalized.password,
    options: { data: { display_name: normalized.displayName } },
  });
  if (error) throw new Error(error.message);
  return { confirmationRequired: !data.session };
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function resolveAuthWorkspace(user: User): Promise<ResolvedAuthWorkspace> {
  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("workspace_members").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (profileResult.error) throw new Error(`Failed to load profile: ${profileResult.error.message}`);
  if (membershipResult.error) throw new Error(`Failed to load workspace membership: ${membershipResult.error.message}`);
  if (!membershipResult.data) throw new Error("Your workspace has not been provisioned. Please contact support.");

  const membership = membershipResult.data as WorkspaceMembership;
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", membership.workspace_id)
    .maybeSingle();
  if (workspaceError) throw new Error(`Failed to load workspace: ${workspaceError.message}`);
  const resolved = requireResolvedWorkspace(profileResult.data, membership, workspace);

  return {
    profile: resolved.profile as Profile,
    workspace: resolved.workspace as Workspace,
    membership: resolved.membership,
  };
}
