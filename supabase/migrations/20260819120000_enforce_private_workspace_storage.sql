/*
  Phase 8.4 storage enforcement. Run scripts/migrate-document-storage.mjs first.
  This migration aborts before policy/bucket changes if any document object has
  not been copied and verified at its workspace-prefixed path.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.documents AS document
    WHERE document.file_path IS NOT NULL
      AND (
        split_part(document.file_path, '/', 1) <> document.workspace_id::text
        OR NOT EXISTS (
          SELECT 1
          FROM storage.objects AS object
          WHERE object.bucket_id = 'documents'
            AND object.name = document.file_path
        )
      )
  ) THEN
    RAISE EXCEPTION 'Document storage migration is incomplete; run and verify migrate-document-storage.mjs first';
  END IF;
END;
$$;

UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

CREATE OR REPLACE FUNCTION public.storage_object_workspace_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN split_part(object_name, '/', 1)::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_object_workspace_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_object_workspace_id(text) TO authenticated;

DROP POLICY IF EXISTS "documents_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous uploads flreew_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous viewing flreew_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads flreew_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow viewing files flreew_0" ON storage.objects;

CREATE POLICY "documents_workspace_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_workspace_member(public.storage_object_workspace_id(name))
);

CREATE POLICY "documents_workspace_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_workspace_member(public.storage_object_workspace_id(name))
);

CREATE POLICY "documents_workspace_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_workspace_member(public.storage_object_workspace_id(name))
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_workspace_member(public.storage_object_workspace_id(name))
);

CREATE POLICY "documents_workspace_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_workspace_member(public.storage_object_workspace_id(name))
);
