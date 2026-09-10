REVOKE ALL ON FUNCTION public.is_club_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;