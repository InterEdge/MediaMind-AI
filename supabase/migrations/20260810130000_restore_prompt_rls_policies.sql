/*
  Restore the permissive Prompt Library policies required by the current
  single-tenant MVP. Replace these with ownership/workspace-scoped policies
  before the multi-user beta.

  Existing table grants are intentionally unchanged.
*/

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_library_select" ON public.prompts;
CREATE POLICY "prompt_library_select"
  ON public.prompts
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "prompt_library_insert" ON public.prompts;
CREATE POLICY "prompt_library_insert"
  ON public.prompts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "prompt_library_update" ON public.prompts;
CREATE POLICY "prompt_library_update"
  ON public.prompts
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "prompt_library_delete" ON public.prompts;
CREATE POLICY "prompt_library_delete"
  ON public.prompts
  FOR DELETE
  TO anon, authenticated
  USING (true);
