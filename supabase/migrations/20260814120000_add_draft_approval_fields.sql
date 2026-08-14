/*
  Phase 3E.1 controlled draft approval metadata.
  Additive and nullable so existing and legacy draft rows remain valid.
*/

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;
