/*
# Create chat_sessions and chat_messages tables

## Purpose
Supports the AI Knowledge Assistant feature by persisting conversation
sessions and individual messages (including AI source citations as JSONB).

## New Tables

### chat_sessions
- `id` (uuid, primary key, default gen_random_uuid())
- `title` (text, not null) — short label auto-generated from the first question
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now()) — bumped on new messages

### chat_messages
- `id` (uuid, primary key, default gen_random_uuid())
- `session_id` (uuid, not null, references chat_sessions.id ON DELETE CASCADE)
- `role` (text, not null) — 'user' or 'assistant'
- `content` (text, not null) — the message text
- `sources` (jsonb, nullable) — array of source citation objects for assistant messages
- `created_at` (timestamptz, default now())

## Indexes
- `idx_chat_messages_session_id` on chat_messages(session_id) for fast message lookups
- `idx_chat_messages_created_at` on chat_messages(created_at) for ordering
- `idx_chat_sessions_updated_at` on chat_sessions(updated_at) for history sorting

## Security — RLS enabled on both tables
- TEMPORARY DEVELOPMENT POLICIES: The app does not yet have authentication.
  These policies allow anon + authenticated full CRUD so the anon-key frontend
  can read and write its own data. When authentication is added, these MUST be
  replaced with user-scoped policies using auth.uid() ownership checks.
- RLS is enabled (not disabled) — all access goes through these explicit policies.
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE), no FOR ALL shortcuts.
*/

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  sources jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ── chat_sessions policies (TEMPORARY — anon access, replace with auth.uid() when auth is added) ──

DROP POLICY IF EXISTS "dev_anon_select_chat_sessions" ON chat_sessions;
CREATE POLICY "dev_anon_select_chat_sessions"
ON chat_sessions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "dev_anon_insert_chat_sessions" ON chat_sessions;
CREATE POLICY "dev_anon_insert_chat_sessions"
ON chat_sessions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_update_chat_sessions" ON chat_sessions;
CREATE POLICY "dev_anon_update_chat_sessions"
ON chat_sessions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_delete_chat_sessions" ON chat_sessions;
CREATE POLICY "dev_anon_delete_chat_sessions"
ON chat_sessions FOR DELETE
TO anon, authenticated USING (true);

-- ── chat_messages policies (TEMPORARY — anon access, replace with auth.uid() when auth is added) ──

DROP POLICY IF EXISTS "dev_anon_select_chat_messages" ON chat_messages;
CREATE POLICY "dev_anon_select_chat_messages"
ON chat_messages FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "dev_anon_insert_chat_messages" ON chat_messages;
CREATE POLICY "dev_anon_insert_chat_messages"
ON chat_messages FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_update_chat_messages" ON chat_messages;
CREATE POLICY "dev_anon_update_chat_messages"
ON chat_messages FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_delete_chat_messages" ON chat_messages;
CREATE POLICY "dev_anon_delete_chat_messages"
ON chat_messages FOR DELETE
TO anon, authenticated USING (true);

-- Auto-update updated_at on new message
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS trigger AS $$
BEGIN
  UPDATE chat_sessions SET updated_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_chat_session_timestamp ON chat_messages;
CREATE TRIGGER trg_update_chat_session_timestamp
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_chat_session_timestamp();
