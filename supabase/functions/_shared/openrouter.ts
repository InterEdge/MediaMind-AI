// ─────────────────────────────────────────────────────────────────────
// OpenRouter API Key Helper
// ─────────────────────────────────────────────────────────────────────
// Shared across all AI Edge Functions so key-loading logic lives in one
// place. Future functions (AI Search, AI Chat, Analytics, etc.) should
// import `getOpenRouterApiKey` instead of reading Deno.env directly.
//
// Required Supabase Edge Function secrets:
//   1. OPENROUTER_API_KEY          — primary key (required for normal use)
//   2. OPENROUTER_API_KEY_BACKUP   — backup key  (optional but recommended)
//
// Fallback exists so the application keeps working when the primary key
// is missing, revoked, or hits its rate limit. The backup key is tried
// automatically — no code changes or redeployment needed.
// ─────────────────────────────────────────────────────────────────────

/**
 * Loads the OpenRouter API key with automatic fallback.
 *
 * Tries OPENROUTER_API_KEY first (primary). If it is missing or empty,
 * falls back to OPENROUTER_API_KEY_BACKUP.
 *
 * @returns the active API key, or null if neither is configured.
 */
export function getOpenRouterApiKey(): string | null {
  // Primary key — the default key configured for the project.
  const primaryKey = Deno.env.get("OPENROUTER_API_KEY");

  // Backup key — used automatically when the primary is missing or empty,
  // e.g. revoked, rotated, or rate-limited.
  const backupKey = Deno.env.get("OPENROUTER_API_KEY_BACKUP");

  return primaryKey ?? backupKey ?? null;
}
