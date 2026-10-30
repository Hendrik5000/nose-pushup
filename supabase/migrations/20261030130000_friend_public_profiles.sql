-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
--
-- RPC used by the battle invitation client (src/lib/battle-invitation-client.ts):
-- name and avatar of the caller's ACCEPTED friends. It was referenced by the client but
-- not defined by any earlier migration. Requested ids that are not accepted friends of the
-- caller are silently omitted, so it cannot be used to look up strangers.

DO $friend_profiles_preflight$
BEGIN
  IF pg_catalog.to_regclass('public.friendships') IS NULL
    OR pg_catalog.to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'FRIEND_PROFILES_SCHEMA_MISMATCH: friendships and profiles are required';
  END IF;
END;
$friend_profiles_preflight$;

CREATE OR REPLACE FUNCTION public.get_friend_public_profiles(p_user_ids uuid[])
RETURNS TABLE (id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT f.friend_id,
         NULLIF(pg_catalog.btrim(p.display_name), ''),
         p.avatar_url
  FROM (
    SELECT DISTINCT CASE WHEN fs.requester_id = auth.uid() THEN fs.addressee_id ELSE fs.requester_id END AS friend_id
    FROM public.friendships fs
    WHERE fs.status = 'accepted'
      AND auth.uid() IS NOT NULL
      AND (fs.requester_id = auth.uid() OR fs.addressee_id = auth.uid())
  ) f
  LEFT JOIN public.profiles p ON p.id = f.friend_id
  WHERE f.friend_id = ANY (p_user_ids[1:200])
$$;

REVOKE ALL ON FUNCTION public.get_friend_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_public_profiles(uuid[]) TO authenticated;
