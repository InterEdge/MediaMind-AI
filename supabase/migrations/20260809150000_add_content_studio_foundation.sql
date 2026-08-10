/*
  Content Studio foundation metadata.
  All columns are nullable/additive so existing drafts and posts remain valid.
  Existing RLS policies are intentionally unchanged.
*/

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES prompts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS hashtags text[],
  ADD COLUMN IF NOT EXISTS generation_config jsonb;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS draft_id uuid REFERENCES drafts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
