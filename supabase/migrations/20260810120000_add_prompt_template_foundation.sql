/*
  Phase 3C.1 prompt template foundation.
  All prompt defaults are nullable so existing prompt records remain valid.
*/

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS default_audience text,
  ADD COLUMN IF NOT EXISTS default_tone text,
  ADD COLUMN IF NOT EXISTS default_objective text,
  ADD COLUMN IF NOT EXISTS default_output_length text;

CREATE OR REPLACE FUNCTION public.increment_prompt_uses(p_prompt_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.prompts
  SET uses = COALESCE(uses, 0) + 1
  WHERE id = p_prompt_id;
$$;

REVOKE ALL ON FUNCTION public.increment_prompt_uses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_prompt_uses(uuid) TO anon, authenticated;
