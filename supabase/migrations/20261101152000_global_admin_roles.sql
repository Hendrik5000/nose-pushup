BEGIN;

CREATE TABLE public.global_role_assignments (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (role_name ~ '^[a-z][a-z0-9_]{0,31}$'),
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_name)
);

ALTER TABLE public.global_role_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.global_role_assignments FROM PUBLIC, anon, authenticated, service_role;

-- This function reveals only whether the caller has one role. It never returns role assignments
-- and derives the subject from Supabase's verified auth.uid(), not a caller-supplied user ID.
CREATE OR REPLACE FUNCTION public.has_global_role(p_role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_role_name IS NULL OR p_role_name !~ '^[a-z][a-z0-9_]{0,31}$' THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.global_role_assignments AS assignment
      WHERE assignment.user_id = (SELECT auth.uid())
        AND assignment.role_name = p_role_name
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.has_global_role(TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_global_role(TEXT) TO authenticated;

-- Role changes are checked twice: the verified JWT identity at the database boundary and
-- the server-function boundary. Only Hendrik may mutate assignments; no caller supplies an actor.
CREATE OR REPLACE FUNCTION public.grant_global_role(p_user_id UUID, p_role_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_role_name IS NULL OR p_role_name !~ '^[a-z][a-z0-9_]{0,31}$' THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Target profile does not exist' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.global_role_assignments (user_id, role_name, granted_by)
  VALUES (p_user_id, p_role_name, (SELECT auth.uid()))
  ON CONFLICT (user_id, role_name) DO UPDATE
    SET granted_by = EXCLUDED.granted_by,
        granted_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.grant_global_role(UUID, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.grant_global_role(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_global_role(p_user_id UUID, p_role_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_role_name IS NULL OR p_role_name !~ '^[a-z][a-z0-9_]{0,31}$' THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID AND p_role_name = 'admin' THEN
    RAISE EXCEPTION 'The role authority cannot revoke its own admin role' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.global_role_assignments
  WHERE user_id = p_user_id AND role_name = p_role_name;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_global_role(UUID, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_global_role(UUID, TEXT) TO authenticated;

COMMIT;
