/*
  Phase 8.1 authentication and personal-workspace foundation.
  Existing business tables and their policies are intentionally unchanged.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces (created_by);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members (user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member"
ON public.workspaces FOR SELECT TO authenticated
USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS "workspace_members_select_relevant" ON public.workspace_members;
CREATE POLICY "workspace_members_select_relevant"
ON public.workspace_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id));

REVOKE ALL ON public.profiles, public.workspaces, public.workspace_members FROM anon;
REVOKE ALL ON public.profiles, public.workspaces, public.workspace_members FROM authenticated;
GRANT SELECT ON public.profiles, public.workspaces, public.workspace_members TO authenticated;
GRANT UPDATE (display_name, updated_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_display_name text;
  personal_workspace_id uuid;
BEGIN
  resolved_display_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
    'MediaMind User'
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, resolved_display_name)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO personal_workspace_id
  FROM public.workspaces
  WHERE created_by = NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF personal_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, created_by)
    VALUES (resolved_display_name || '''s Workspace', NEW.id)
    RETURNING id INTO personal_workspace_id;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (personal_workspace_id, NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner', updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

/* Provision any auth users that predate this migration without touching business data. */
DO $$
DECLARE
  existing_user auth.users%ROWTYPE;
  resolved_display_name text;
  personal_workspace_id uuid;
BEGIN
  FOR existing_user IN SELECT * FROM auth.users LOOP
    resolved_display_name := COALESCE(
      NULLIF(BTRIM(existing_user.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(SPLIT_PART(COALESCE(existing_user.email, ''), '@', 1), ''),
      'MediaMind User'
    );

    INSERT INTO public.profiles (id, display_name)
    VALUES (existing_user.id, resolved_display_name)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO personal_workspace_id
    FROM public.workspaces
    WHERE created_by = existing_user.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF personal_workspace_id IS NULL THEN
      INSERT INTO public.workspaces (name, created_by)
      VALUES (resolved_display_name || '''s Workspace', existing_user.id)
      RETURNING id INTO personal_workspace_id;
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (personal_workspace_id, existing_user.id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;
