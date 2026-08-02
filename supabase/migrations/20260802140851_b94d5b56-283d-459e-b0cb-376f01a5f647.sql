CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS TABLE(achievement_id text, xp_reward integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prof profiles%ROWTYPE;
  _total_reps integer;
  _total_runs integer;
  _friends integer;
  _challenges integer;
  _pr_count integer;
  _ach achievements%ROWTYPE;
BEGIN
  SELECT * INTO _prof FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(total_reps), 0) INTO _total_reps FROM public.daily_stats WHERE user_id = _user_id;
  SELECT COUNT(*) INTO _total_runs FROM public.runs WHERE user_id = _user_id;
  SELECT COUNT(*) INTO _friends FROM public.friendships WHERE status = 'accepted' AND (requester_id = _user_id OR addressee_id = _user_id);
  SELECT COUNT(*) INTO _challenges FROM public.user_challenges WHERE user_id = _user_id AND completed_at IS NOT NULL;
  SELECT COUNT(*) INTO _pr_count FROM jsonb_object_keys(COALESCE(_prof.personal_bests, '{}'::jsonb));

  FOR _ach IN SELECT * FROM public.achievements ORDER BY sort_order LOOP
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = _user_id AND achievement_id = _ach.id) THEN
      CONTINUE;
    END IF;

    IF (_ach.condition_type = 'total_reps' AND _total_reps >= _ach.condition_value)
       OR (_ach.condition_type = 'current_streak' AND _prof.current_streak >= _ach.condition_value)
       OR (_ach.condition_type = 'level' AND _prof.level >= _ach.condition_value)
       OR (_ach.condition_type = 'battle_wins' AND _prof.battle_wins >= _ach.condition_value)
       OR (_ach.condition_type = 'challenges_completed' AND _challenges >= _ach.condition_value)
       OR (_ach.condition_type = 'friends_count' AND _friends >= _ach.condition_value)
       OR (_ach.condition_type = 'runs_count' AND _total_runs >= _ach.condition_value)
       OR (_ach.condition_type = 'pr_count' AND _pr_count >= _ach.condition_value)
    THEN
      INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at) VALUES (_user_id, _ach.id, now())
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
      UPDATE public.profiles SET xp = xp + _ach.xp_reward, level = public.calc_level(xp + _ach.xp_reward), updated_at = now() WHERE id = _user_id;
      achievement_id := _ach.id;
      xp_reward := _ach.xp_reward;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;