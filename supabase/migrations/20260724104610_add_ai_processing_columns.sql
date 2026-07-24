/*
# Add AI processing columns to documents table

## Overview
Adds four new columns to the `documents` table to support AI document
processing: extracted_text (full text extracted from the file), keywords
(AI-extracted 10-20 keywords), ai_status (granular processing stage), and
renames the existing tags column usage. The existing `summary` and `tags`
columns are retained for backward compatibility.

## Changes

### documents table — new columns
- `extracted_text` (text, nullable) — the full text content extracted from
  the uploaded file (PDF, DOCX, or TXT). Truncated to a reasonable length
  for storage.
- `keywords` (text[], default '{}') — 10-20 AI-extracted keywords/tags
  representing the key topics in the document.
- `ai_status` (text, default 'pending') — granular AI processing stage:
  one of 'pending', 'extracting', 'ai_processing', 'ready', 'failed'.
  This is distinct from the existing `status` column which tracks the
  overall document lifecycle.

## Security
- No changes to RLS policies. Existing anon+authenticated CRUD policies
  on the documents table cover the new columns automatically.
*/

-- Add extracted_text column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'extracted_text'
  ) THEN
    ALTER TABLE documents ADD COLUMN extracted_text text;
  END IF;
END $$;

-- Add keywords column (separate from existing tags column)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'keywords'
  ) THEN
    ALTER TABLE documents ADD COLUMN keywords text[] DEFAULT '{}';
  END IF;
END $$;

-- Add ai_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'ai_status'
  ) THEN
    ALTER TABLE documents ADD COLUMN ai_status text DEFAULT 'pending';
  END IF;
END $$;
