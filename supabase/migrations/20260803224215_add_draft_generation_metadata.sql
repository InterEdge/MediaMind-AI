/*
# Add generation metadata columns to drafts table

## Overview
Adds four new columns to the `drafts` table to store AI generation
metadata: source document IDs, the generation prompt used, tone, and
target audience. These allow tracing a draft back to the documents
and settings that produced it.

## Changes

### drafts table — new columns
- `source_document_ids` (uuid[], default '{}') — array of document IDs
  that were used as context for AI generation
- `generation_prompt` (text, nullable) — the full prompt/configuration
  sent to the AI (content type, tone, audience, topic, instructions)
- `tone` (text, nullable) — the tone setting used for generation
- `target_audience` (text, nullable) — the target audience setting

## Security
- No changes to RLS policies. Existing CRUD policies on drafts cover
  the new columns automatically.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'source_document_ids'
  ) THEN
    ALTER TABLE drafts ADD COLUMN source_document_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'generation_prompt'
  ) THEN
    ALTER TABLE drafts ADD COLUMN generation_prompt text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'tone'
  ) THEN
    ALTER TABLE drafts ADD COLUMN tone text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'target_audience'
  ) THEN
    ALTER TABLE drafts ADD COLUMN target_audience text;
  END IF;
END $$;
