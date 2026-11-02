BEGIN;

-- Only the role manager may list admin assignments. No direct table access is granted.
CREATE OR REPLACE FUNCTION public.list_admin_role_assignments()
RETURNS TABLE (user_id UUID, granted_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT assignment.user_id, assignment.granted_at
  FROM public.global_role_assignments AS assignment
  WHERE assignment.role_name = 'admin'
  ORDER BY assignment.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_role_assignments() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_admin_role_assignments() TO authenticated;

COMMIT;
