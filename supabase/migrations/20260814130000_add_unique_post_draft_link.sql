/*
  Phase 3E.2 enforces one linked post per draft for MVP scheduling.
  Existing posts without a draft link remain unaffected.
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_unique_draft_id
  ON public.posts (draft_id)
  WHERE draft_id IS NOT NULL;
