/*
  Phase 8.3 corrective cleanup for live policy drift.

  This migration changes policies and grants only. It does not mutate business
  rows and intentionally preserves every *_workspace_* policy created by
  20260818120000_enforce_workspace_rls_and_backfill.sql.
*/

-- Repository-history policies: core single-tenant CRUD.
DROP POLICY IF EXISTS "anon_crud_documents_sel" ON public.documents;
DROP POLICY IF EXISTS "anon_crud_documents_ins" ON public.documents;
DROP POLICY IF EXISTS "anon_crud_documents_upd" ON public.documents;
DROP POLICY IF EXISTS "anon_crud_documents_del" ON public.documents;
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
DROP POLICY IF EXISTS "anon_crud_activities_sel" ON public.activities;
DROP POLICY IF EXISTS "anon_crud_activities_ins" ON public.activities;
DROP POLICY IF EXISTS "anon_crud_activities_upd" ON public.activities;
DROP POLICY IF EXISTS "anon_crud_activities_del" ON public.activities;

-- Repository-history policies: temporary chat development access.
DROP POLICY IF EXISTS "dev_anon_select_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_insert_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_update_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_delete_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "dev_anon_select_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "dev_anon_insert_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "dev_anon_update_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "dev_anon_delete_chat_messages" ON public.chat_messages;

-- Repository-history policies: temporary Prompt Library access.
DROP POLICY IF EXISTS "prompt_library_select" ON public.prompts;
DROP POLICY IF EXISTS "prompt_library_insert" ON public.prompts;
DROP POLICY IF EXISTS "prompt_library_update" ON public.prompts;
DROP POLICY IF EXISTS "prompt_library_delete" ON public.prompts;

-- Live drift verified after Phase 8.3 backfill.
DROP POLICY IF EXISTS "Allow development activity reads" ON public.activities;
DROP POLICY IF EXISTS "Allow development activity writes" ON public.activities;
DROP POLICY IF EXISTS "Allow document insert" ON public.documents;
DROP POLICY IF EXISTS "Allow document read" ON public.documents;
DROP POLICY IF EXISTS "Allow public document deletes" ON public.documents;
DROP POLICY IF EXISTS "Allow public document reads" ON public.documents;
DROP POLICY IF EXISTS "Allow public document updates" ON public.documents;
DROP POLICY IF EXISTS "Allow public document uploads" ON public.documents;
DROP POLICY IF EXISTS "Allow public draft deletes" ON public.drafts;
DROP POLICY IF EXISTS "Allow public draft inserts" ON public.drafts;
DROP POLICY IF EXISTS "Allow public draft reads" ON public.drafts;
DROP POLICY IF EXISTS "Allow public draft updates" ON public.drafts;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

-- Defense in depth: RLS policies cannot grant access without table privileges.
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

