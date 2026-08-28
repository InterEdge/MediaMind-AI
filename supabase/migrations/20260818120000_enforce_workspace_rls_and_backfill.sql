/*
  Phase 8.3: atomically assign legacy data to the verified beta workspace,
  enforce workspace ownership, and replace permissive business-table RLS.

  Owner resolution:
  - If the project has exactly one auth user and that user has exactly one
    personal owner workspace, no operator setting is needed.
  - Otherwise run this migration in a session configured with:
      SET mediamind.beta_owner_email = 'owner@example.com';
      SET mediamind.beta_workspace_id = '00000000-0000-0000-0000-000000000000';
    The workspace setting is optional when the selected owner has exactly one
    personal owner workspace. Both settings are validated before any write.
*/

DO $$
DECLARE
  owner_email_setting text := NULLIF(current_setting('mediamind.beta_owner_email', true), '');
  workspace_id_setting text := NULLIF(current_setting('mediamind.beta_workspace_id', true), '');
  beta_owner_id uuid;
  beta_workspace_id uuid;
  candidate_count integer;
BEGIN
  IF owner_email_setting IS NOT NULL THEN
    SELECT COUNT(*), MIN(id::text)::uuid
      INTO candidate_count, beta_owner_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(owner_email_setting);

    IF candidate_count <> 1 THEN
      RAISE EXCEPTION 'Phase 8.3 expected exactly one auth user for beta-owner email %, found %',
        owner_email_setting, candidate_count;
    END IF;
  ELSE
    SELECT COUNT(*), MIN(id::text)::uuid
      INTO candidate_count, beta_owner_id
    FROM auth.users;

    IF candidate_count <> 1 THEN
      RAISE EXCEPTION
        'Phase 8.3 cannot infer the beta owner from % auth users. Set mediamind.beta_owner_email explicitly.',
        candidate_count;
    END IF;
  END IF;

  IF workspace_id_setting IS NOT NULL THEN
    BEGIN
      beta_workspace_id := workspace_id_setting::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'mediamind.beta_workspace_id must be a valid UUID';
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM public.workspaces AS w
      JOIN public.workspace_members AS wm
        ON wm.workspace_id = w.id
      WHERE w.id = beta_workspace_id
        AND w.created_by = beta_owner_id
        AND wm.user_id = beta_owner_id
        AND wm.role = 'owner'
    ) THEN
      RAISE EXCEPTION
        'Workspace % is not a personal owner workspace for beta owner %',
        beta_workspace_id, beta_owner_id;
    END IF;
  ELSE
    SELECT COUNT(*), MIN(w.id::text)::uuid
      INTO candidate_count, beta_workspace_id
    FROM public.workspaces AS w
    JOIN public.workspace_members AS wm
      ON wm.workspace_id = w.id
    WHERE w.created_by = beta_owner_id
      AND wm.user_id = beta_owner_id
      AND wm.role = 'owner';

    IF candidate_count <> 1 THEN
      RAISE EXCEPTION
        'Phase 8.3 found % personal owner workspaces for beta owner %. Set mediamind.beta_workspace_id explicitly.',
        candidate_count, beta_owner_id;
    END IF;
  END IF;

  UPDATE public.documents SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.chat_sessions SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.drafts SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.posts SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.notifications SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.prompts SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.activities SET workspace_id = beta_workspace_id WHERE workspace_id IS NULL;

  IF EXISTS (SELECT 1 FROM public.documents WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.chat_sessions WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.drafts WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.posts WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.notifications WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.prompts WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.activities WHERE workspace_id IS NULL)
  THEN
    RAISE EXCEPTION 'Phase 8.3 backfill verification failed: NULL workspace ownership remains';
  END IF;
END;
$$;

ALTER TABLE public.documents ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.chat_sessions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.drafts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.posts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.prompts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Remove every historical permissive policy by its exact repository name.
DROP POLICY IF EXISTS "anon_crud_documents_sel" ON public.documents;
DROP POLICY IF EXISTS "anon_crud_documents_ins" ON public.documents;
DROP POLICY IF EXISTS "anon_crud_documents_upd" ON public.documents;
DROP POLICY IF EXISTS "anon_crud_documents_del" ON public.documents;
DROP POLICY IF EXISTS "dev_anon_select_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_insert_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_update_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_delete_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_select_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "dev_anon_insert_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "dev_anon_update_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "dev_anon_delete_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "anon_crud_drafts_sel" ON public.drafts;
DROP POLICY IF EXISTS "anon_crud_drafts_ins" ON public.drafts;
DROP POLICY IF EXISTS "anon_crud_drafts_upd" ON public.drafts;
DROP POLICY IF EXISTS "anon_crud_drafts_del" ON public.drafts;
DROP POLICY IF EXISTS "anon_crud_posts_sel" ON public.posts;
DROP POLICY IF EXISTS "anon_crud_posts_ins" ON public.posts;
DROP POLICY IF EXISTS "anon_crud_posts_upd" ON public.posts;
DROP POLICY IF EXISTS "anon_crud_posts_del" ON public.posts;
DROP POLICY IF EXISTS "anon_crud_notifications_sel" ON public.notifications;
DROP POLICY IF EXISTS "anon_crud_notifications_ins" ON public.notifications;
DROP POLICY IF EXISTS "anon_crud_notifications_upd" ON public.notifications;
DROP POLICY IF EXISTS "anon_crud_notifications_del" ON public.notifications;
DROP POLICY IF EXISTS "anon_crud_prompts_sel" ON public.prompts;
DROP POLICY IF EXISTS "anon_crud_prompts_ins" ON public.prompts;
DROP POLICY IF EXISTS "anon_crud_prompts_upd" ON public.prompts;
DROP POLICY IF EXISTS "anon_crud_prompts_del" ON public.prompts;
DROP POLICY IF EXISTS "prompt_library_select" ON public.prompts;
DROP POLICY IF EXISTS "prompt_library_insert" ON public.prompts;
DROP POLICY IF EXISTS "prompt_library_update" ON public.prompts;
DROP POLICY IF EXISTS "prompt_library_delete" ON public.prompts;
DROP POLICY IF EXISTS "anon_crud_activities_sel" ON public.activities;
DROP POLICY IF EXISTS "anon_crud_activities_ins" ON public.activities;
DROP POLICY IF EXISTS "anon_crud_activities_upd" ON public.activities;
DROP POLICY IF EXISTS "anon_crud_activities_del" ON public.activities;

CREATE POLICY "documents_workspace_select" ON public.documents
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "documents_workspace_insert" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "documents_workspace_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "documents_workspace_delete" ON public.documents
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE POLICY "chat_sessions_workspace_select" ON public.chat_sessions
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "chat_sessions_workspace_insert" ON public.chat_sessions
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "chat_sessions_workspace_update" ON public.chat_sessions
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "chat_sessions_workspace_delete" ON public.chat_sessions
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE POLICY "drafts_workspace_select" ON public.drafts
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "drafts_workspace_insert" ON public.drafts
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "drafts_workspace_update" ON public.drafts
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "drafts_workspace_delete" ON public.drafts
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE POLICY "posts_workspace_select" ON public.posts
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "posts_workspace_insert" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "posts_workspace_update" ON public.posts
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "posts_workspace_delete" ON public.posts
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE POLICY "notifications_workspace_select" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "notifications_workspace_insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "notifications_workspace_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "notifications_workspace_delete" ON public.notifications
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE POLICY "prompts_workspace_select" ON public.prompts
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "prompts_workspace_insert" ON public.prompts
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "prompts_workspace_update" ON public.prompts
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "prompts_workspace_delete" ON public.prompts
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE POLICY "activities_workspace_select" ON public.activities
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "activities_workspace_insert" ON public.activities
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "activities_workspace_update" ON public.activities
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "activities_workspace_delete" ON public.activities
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

-- Messages inherit access from their parent session; no redundant workspace_id.
CREATE POLICY "chat_messages_workspace_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions AS session
      WHERE session.id = chat_messages.session_id
        AND public.is_workspace_member(session.workspace_id)
    )
  );
CREATE POLICY "chat_messages_workspace_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions AS session
      WHERE session.id = chat_messages.session_id
        AND public.is_workspace_member(session.workspace_id)
    )
  );
CREATE POLICY "chat_messages_workspace_update" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions AS session
      WHERE session.id = chat_messages.session_id
        AND public.is_workspace_member(session.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions AS session
      WHERE session.id = chat_messages.session_id
        AND public.is_workspace_member(session.workspace_id)
    )
  );
CREATE POLICY "chat_messages_workspace_delete" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions AS session
      WHERE session.id = chat_messages.session_id
        AND public.is_workspace_member(session.workspace_id)
    )
  );

REVOKE ALL PRIVILEGES ON
  public.documents,
  public.chat_sessions,
  public.chat_messages,
  public.drafts,
  public.posts,
  public.notifications,
  public.prompts,
  public.activities
FROM anon;

-- Remove non-CRUD capabilities such as TRUNCATE before granting the exact
-- browser privileges used by the authenticated application.
REVOKE ALL PRIVILEGES ON
  public.documents,
  public.chat_sessions,
  public.chat_messages,
  public.drafts,
  public.posts,
  public.notifications,
  public.prompts,
  public.activities
FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.documents,
  public.chat_sessions,
  public.chat_messages,
  public.drafts,
  public.posts,
  public.notifications,
  public.prompts,
  public.activities
TO authenticated;

-- Keep prompt usage caller-scoped. RLS on public.prompts governs the UPDATE.
CREATE OR REPLACE FUNCTION public.increment_prompt_uses(p_prompt_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.prompts
  SET uses = COALESCE(uses, 0) + 1
  WHERE id = p_prompt_id
    AND public.is_workspace_member(workspace_id);
$$;

REVOKE ALL ON FUNCTION public.increment_prompt_uses(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_prompt_uses(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_prompt_uses(uuid) TO authenticated;
