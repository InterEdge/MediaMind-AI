/*
  Phase 7.1 notification metadata and idempotency foundation.
  All additions are nullable or have backward-compatible defaults.
*/

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_record_id uuid,
  ADD COLUMN IF NOT EXISTS related_record_type text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_event_key
  ON public.notifications (event_key)
  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_read_created_at
  ON public.notifications (read, created_at DESC);
