
REVOKE EXECUTE ON FUNCTION public.on_workout_progress_challenges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_workout_inserted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.challenge_period_start(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.challenge_period_start(text, date) TO authenticated;
