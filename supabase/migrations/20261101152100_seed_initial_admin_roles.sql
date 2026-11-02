BEGIN;

-- Abort before either assignment if the two owner-confirmed Alo profile IDs are not present.
-- This migration is reviewed PR content only; it is not applied directly in this task.
DO $admin_seed_preflight$
DECLARE
  matching_profiles INTEGER;
BEGIN
  SELECT count(*)
    INTO matching_profiles
    FROM public.profiles
   WHERE id IN (
     'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID,
     '0c580e34-a3fd-4079-8c32-7624f699623a'::UUID
   );

  IF matching_profiles <> 2 THEN
    RAISE EXCEPTION 'ADMIN_PROFILE_ID_MISMATCH: expected both owner-confirmed profiles; no roles seeded';
  END IF;
END;
$admin_seed_preflight$;

INSERT INTO public.global_role_assignments (user_id, role_name, granted_by)
VALUES
  ('fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID, 'admin', 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID),
  ('0c580e34-a3fd-4079-8c32-7624f699623a'::UUID, 'admin', 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID)
ON CONFLICT (user_id, role_name) DO NOTHING;

COMMIT;
