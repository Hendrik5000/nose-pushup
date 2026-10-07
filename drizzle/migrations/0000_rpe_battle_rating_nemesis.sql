-- Feature: RPE-Tracking am Workout (1-10, optional)
ALTER TABLE public.workouts ADD COLUMN rpe integer;
COMMENT ON COLUMN public.workouts.rpe IS 'Subjektive Belastung 1-10, optional nach dem Satz erfasst';

-- Battle-Wertung (Elo) im oeffentlichen Profil-View fuer die Battle-Liga
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, display_name, avatar_url, level, xp, current_streak, longest_streak,
       best_count, battle_wins, battle_losses, battle_rating
FROM public.profiles;

-- Nemesis-Abzeichen: 5 Siege gegen denselben Gegner
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS TABLE(_achievement_id text, _xp_reward integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _prof profiles%ROWTYPE;
  _total_reps integer;
  _total_runs integer;
  _friends integer;
  _challenges integer;
  _pr_count integer;
  _nemesis integer;
  _ach achievements%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN;
  END IF;

  SELECT * INTO _prof FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(total_reps), 0) INTO _total_reps FROM public.daily_stats WHERE user_id = _user_id;
  SELECT COUNT(*) INTO _total_runs FROM public.runs WHERE user_id = _user_id;
  SELECT COUNT(*) INTO _friends FROM public.friendships WHERE status = 'accepted' AND (requester_id = _user_id OR addressee_id = _user_id);
  SELECT COUNT(*) INTO _challenges FROM public.user_challenges WHERE user_id = _user_id AND completed_at IS NOT NULL;
  SELECT COUNT(*) INTO _pr_count FROM jsonb_object_keys(COALESCE(_prof.personal_bests, '{}'::jsonb));
  SELECT COALESCE(MAX(cnt), 0) INTO _nemesis FROM (
    SELECT COUNT(*) AS cnt FROM public.battles
    WHERE winner_id = _user_id AND status = 'finished' AND is_bot = false
    GROUP BY CASE WHEN host_id = _user_id THEN guest_id ELSE host_id END
  ) t;

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
       OR (_ach.condition_type = 'nemesis' AND _nemesis >= _ach.condition_value)
    THEN
      INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at) VALUES (_user_id, _ach.id, now())
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
      UPDATE public.profiles SET xp = xp + _ach.xp_reward, level = public.calc_level(xp + _ach.xp_reward), updated_at = now() WHERE id = _user_id;
      _achievement_id := _ach.id;
      _xp_reward := _ach.xp_reward;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;