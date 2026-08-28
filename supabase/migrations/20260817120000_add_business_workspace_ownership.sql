-- Phase 8.2 ownership plumbing. Columns intentionally remain nullable so
-- historical single-tenant rows stay available until the controlled backfill.
-- Existing permissive business-table RLS policies are intentionally unchanged.

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS documents_workspace_id_idx ON public.documents (workspace_id);
CREATE INDEX IF NOT EXISTS chat_sessions_workspace_id_idx ON public.chat_sessions (workspace_id);
CREATE INDEX IF NOT EXISTS drafts_workspace_id_idx ON public.drafts (workspace_id);
CREATE INDEX IF NOT EXISTS posts_workspace_id_idx ON public.posts (workspace_id);
CREATE INDEX IF NOT EXISTS notifications_workspace_id_idx ON public.notifications (workspace_id);
CREATE INDEX IF NOT EXISTS prompts_workspace_id_idx ON public.prompts (workspace_id);
CREATE INDEX IF NOT EXISTS activities_workspace_id_idx ON public.activities (workspace_id);

COMMENT ON COLUMN public.documents.workspace_id IS 'Nullable during Phase 8 ownership backfill.';
COMMENT ON COLUMN public.chat_sessions.workspace_id IS 'Nullable during Phase 8 ownership backfill.';
COMMENT ON COLUMN public.drafts.workspace_id IS 'Nullable during Phase 8 ownership backfill.';
COMMENT ON COLUMN public.posts.workspace_id IS 'Nullable during Phase 8 ownership backfill.';
COMMENT ON COLUMN public.notifications.workspace_id IS 'Nullable during Phase 8 ownership backfill.';
COMMENT ON COLUMN public.prompts.workspace_id IS 'Nullable during Phase 8 ownership backfill.';
COMMENT ON COLUMN public.activities.workspace_id IS 'Nullable during Phase 8 ownership backfill.';
