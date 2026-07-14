/*
# MediaMind AI — Core Schema

## Overview
Creates the full data model for the MediaMind AI SaaS platform: documents,
drafts, posts, prompts, activities, and notifications. Single-tenant (no auth)
so all policies use `TO anon, authenticated`.

## Tables

### documents
- id (uuid PK)
- title (text) — document name
- type (text) — e.g. "Case Study", "Playbook", "Report", "Whitepaper"
- category (text) — e.g. "Advertising", "Strategy", "Creative"
- file_size (text) — human-readable size
- status (text) — "Processing", "Indexed", "Ready", "Archived"
- summary (text) — AI-generated summary
- tags (text[]) — searchable tags
- uploaded_at (timestamptz)

### drafts
- id (uuid PK)
- title (text)
- content (text) — full draft body
- platform (text) — "LinkedIn", "Twitter", "Blog", "Email"
- status (text) — "Draft", "In Review", "Approved", "Published"
- word_count (int)
- ai_generated (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)

### posts
- id (uuid PK)
- title (text)
- content (text)
- platform (text)
- status (text) — "Scheduled", "Published", "Draft", "Failed"
- scheduled_at (timestamptz)
- engagement_score (int) — 0-100 AI quality score
- hashtags (text[])
- created_at (timestamptz)

### prompts
- id (uuid PK)
- name (text)
- category (text) — "LinkedIn", "Advertising", "Proposal", "Strategy"
- template (text) — the prompt template with {{variables}}
- description (text)
- uses (int) — times used
- is_favorite (boolean)
- created_at (timestamptz)

### activities
- id (uuid PK)
- type (text) — "upload", "draft", "generate", "schedule", "publish", "login"
- description (text)
- metadata (jsonb)
- created_at (timestamptz)

### notifications
- id (uuid PK)
- type (text) — "info", "success", "warning"
- title (text)
- message (text)
- read (boolean default false)
- created_at (timestamptz)

## Security
- RLS enabled on every table.
- All tables allow anon + authenticated full CRUD (single-tenant, no auth).
*/

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'Report',
  category text NOT NULL DEFAULT 'General',
  file_size text NOT NULL DEFAULT '0 KB',
  status text NOT NULL DEFAULT 'Ready',
  summary text,
  tags text[] DEFAULT '{}',
  uploaded_at timestamptz DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_documents_sel" ON documents;
CREATE POLICY "anon_crud_documents_sel" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_documents_ins" ON documents;
CREATE POLICY "anon_crud_documents_ins" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_documents_upd" ON documents;
CREATE POLICY "anon_crud_documents_upd" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_documents_del" ON documents;
CREATE POLICY "anon_crud_documents_del" ON documents FOR DELETE TO anon, authenticated USING (true);

-- Drafts
CREATE TABLE IF NOT EXISTS drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'LinkedIn',
  status text NOT NULL DEFAULT 'Draft',
  word_count int DEFAULT 0,
  ai_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_drafts_sel" ON drafts;
CREATE POLICY "anon_crud_drafts_sel" ON drafts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_drafts_ins" ON drafts;
CREATE POLICY "anon_crud_drafts_ins" ON drafts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_drafts_upd" ON drafts;
CREATE POLICY "anon_crud_drafts_upd" ON drafts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_drafts_del" ON drafts;
CREATE POLICY "anon_crud_drafts_del" ON drafts FOR DELETE TO anon, authenticated USING (true);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'LinkedIn',
  status text NOT NULL DEFAULT 'Draft',
  scheduled_at timestamptz,
  engagement_score int DEFAULT 0,
  hashtags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_posts_sel" ON posts;
CREATE POLICY "anon_crud_posts_sel" ON posts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_posts_ins" ON posts;
CREATE POLICY "anon_crud_posts_ins" ON posts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_posts_upd" ON posts;
CREATE POLICY "anon_crud_posts_upd" ON posts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_posts_del" ON posts;
CREATE POLICY "anon_crud_posts_del" ON posts FOR DELETE TO anon, authenticated USING (true);

-- Prompts
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'LinkedIn',
  template text NOT NULL DEFAULT '',
  description text,
  uses int DEFAULT 0,
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_prompts_sel" ON prompts;
CREATE POLICY "anon_crud_prompts_sel" ON prompts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_prompts_ins" ON prompts;
CREATE POLICY "anon_crud_prompts_ins" ON prompts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_prompts_upd" ON prompts;
CREATE POLICY "anon_crud_prompts_upd" ON prompts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_prompts_del" ON prompts;
CREATE POLICY "anon_crud_prompts_del" ON prompts FOR DELETE TO anon, authenticated USING (true);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'generate',
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_activities_sel" ON activities;
CREATE POLICY "anon_crud_activities_sel" ON activities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_activities_ins" ON activities;
CREATE POLICY "anon_crud_activities_ins" ON activities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_activities_upd" ON activities;
CREATE POLICY "anon_crud_activities_upd" ON activities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_activities_del" ON activities;
CREATE POLICY "anon_crud_activities_del" ON activities FOR DELETE TO anon, authenticated USING (true);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_notifications_sel" ON notifications;
CREATE POLICY "anon_crud_notifications_sel" ON notifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_notifications_ins" ON notifications;
CREATE POLICY "anon_crud_notifications_ins" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_notifications_upd" ON notifications;
CREATE POLICY "anon_crud_notifications_upd" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_notifications_del" ON notifications;
CREATE POLICY "anon_crud_notifications_del" ON notifications FOR DELETE TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
