REVOKE EXECUTE ON FUNCTION public.club_week_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.club_league() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_club_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_week_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_league() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_club_by_code(text) TO authenticated;