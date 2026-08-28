import { supabase } from "../lib/supabase";
import { requireActiveWorkspaceId } from "../utils/workspaceOwnership";

export async function invokeAuthenticatedEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Failed to read authenticated session: ${error.message}`);
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("You must be signed in to use this feature.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ ...body, workspaceId: requireActiveWorkspaceId() }),
  });
}
