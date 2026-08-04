-- Trigger + internal SECURITY DEFINER functions must never be callable via the Data API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_battle_finished() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_workout_inserted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_workout_progress_challenges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_check_achievements_battle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_check_achievements_challenge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_check_achievements_workout() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- check_achievements is an intentional RPC, but only for signed-in users (it self-checks auth.uid()).
REVOKE ALL ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO authenticated;