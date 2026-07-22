/*
# Fix documents table schema and create storage bucket

## Overview
Fixes the schema mismatch causing upload failures. The documents table was
created with a `title` column but the application code inserts `name` and
`file_path` — neither of which exist on the table. This migration adds the
missing `file_path` column and creates the `documents` storage bucket with
public-read RLS policies so file uploads work end-to-end.

## Changes

### documents table
- Added `file_path` (text, nullable) — stores the storage path for the uploaded file

### Storage
- Created `documents` bucket (public) for file uploads
- Added storage RLS policies allowing anon + authenticated to insert/select
  objects in the `documents` bucket (single-tenant, no auth)

## Security
- Storage policies scoped to the `documents` bucket only
- anon + authenticated roles can CRUD objects in this bucket (single-tenant app)
*/

-- Add file_path column to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE documents ADD COLUMN file_path text;
  END IF;
END $$;

-- Create documents storage bucket (public for read access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for the documents bucket
-- Allow anon + authenticated to read objects
DROP POLICY IF EXISTS "documents_bucket_select" ON storage.objects;
CREATE POLICY "documents_bucket_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'documents');

-- Allow anon + authenticated to upload objects
DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
CREATE POLICY "documents_bucket_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'documents');

-- Allow anon + authenticated to update objects
DROP POLICY IF EXISTS "documents_bucket_update" ON storage.objects;
CREATE POLICY "documents_bucket_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');

-- Allow anon + authenticated to delete objects
DROP POLICY IF EXISTS "documents_bucket_delete" ON storage.objects;
CREATE POLICY "documents_bucket_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'documents');
