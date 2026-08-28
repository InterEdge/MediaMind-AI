import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.57.4";

export class EdgeAuthorizationError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface AuthenticatedEdgeRequest {
  user: User;
  serviceClient: SupabaseClient;
}

export async function authenticateEdgeRequest(req: Request): Promise<AuthenticatedEdgeRequest> {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new EdgeAuthorizationError("Authentication required.", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(match[1]);
  if (error || !data.user) throw new EdgeAuthorizationError("Invalid or expired authentication token.", 401);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return {
    user: data.user,
    serviceClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function requireWorkspaceMembership(
  auth: AuthenticatedEdgeRequest,
  workspaceId: string | null | undefined,
): Promise<string> {
  if (!workspaceId) throw new EdgeAuthorizationError("A workspace is required.", 400);
  const { data, error } = await auth.serviceClient
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw new EdgeAuthorizationError("Workspace authorization could not be verified.", 500);
  if (!data) throw new EdgeAuthorizationError("You do not have access to this workspace.", 403);
  return workspaceId;
}

export function requireWorkspaceStoragePath(path: string | null, workspaceId: string): string {
  if (!path || path.split("/")[0] !== workspaceId) {
    throw new EdgeAuthorizationError("Document storage path does not match its workspace.", 403);
  }
  return path;
}

export function edgeAuthorizationResponse(error: unknown, corsHeaders: Record<string, string>): Response | null {
  if (!(error instanceof EdgeAuthorizationError)) return null;
  return new Response(JSON.stringify({ error: error.message }), {
    status: error.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
