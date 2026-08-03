/*
# Add search indexes to documents table

## Overview
Adds a GIN index on the `extracted_text` column using the `pg_trgm`
extension to accelerate case-insensitive partial-word searches (ILIKE
with wildcards). Also adds a B-tree index on `category` and `type` to
speed up filter queries. These indexes do not change any existing RLS
policies — they are purely performance improvements.

## Changes

### Extensions
- Enables `pg_trgm` (trigram matching) for fast fuzzy text search

### Indexes (all IF NOT EXISTS — safe to re-run)
- `idx_documents_extracted_text_trgm` — GIN trigram index on
  `extracted_text` for fast ILIKE '%query%' searches
- `idx_documents_summary_trgm` — GIN trigram index on `summary`
- `idx_documents_title_trgm` — GIN trigram index on `title`
- `idx_documents_category` — B-tree index on `category` for filter queries
- `idx_documents_type` — B-tree index on `type` for filter queries

## Security
- No changes to RLS policies. Existing anon+authenticated CRUD policies
  remain unchanged. Indexes are transparent to access control.
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_trgm
  ON documents USING gin (extracted_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_summary_trgm
  ON documents USING gin (summary gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
  ON documents USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_category
  ON documents (category);

CREATE INDEX IF NOT EXISTS idx_documents_type
  ON documents (type);
