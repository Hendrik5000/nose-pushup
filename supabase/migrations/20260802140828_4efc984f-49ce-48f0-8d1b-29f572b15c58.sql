CREATE TABLE public.achievements (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏅',
  category text NOT NULL,
  condition_type text NOT NULL,
  condition_value integer NOT NULL DEFAULT 1,
  xp_reward integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements readable by authenticated" ON public.achievements FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  seen boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own achievements" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own achievements" ON public.user_achievements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own achievements" ON public.user_achievements FOR DELETE TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.achievements (id, title, description, icon, category, condition_type, condition_value, xp_reward, sort_order) VALUES
('reps_10', '10 Push-Ups', '10 Push-Ups insgesamt geschafft', '💪', 'reps', 'total_reps', 10, 10, 1),
('reps_100', '100 Push-Ups', '100 Push-Ups insgesamt geschafft', '💯', 'reps', 'total_reps', 100, 50, 2),
('reps_1000', '1.000 Push-Ups', '1.000 Push-Ups insgesamt geschafft', '🔥', 'reps', 'total_reps', 1000, 200, 3),
('reps_10000', '10.000 Push-Ups', '10.000 Push-Ups insgesamt geschafft', '👑', 'reps', 'total_reps', 10000, 1000, 4),
('reps_50000', '50.000 Push-Ups', '50.000 Push-Ups insgesamt geschafft', '🏆', 'reps', 'total_reps', 50000, 5000, 5),
('streak_7', '7-Tage-Streak', '7 Tage am Stück trainiert', '📅', 'streak', 'current_streak', 7, 50, 10),
('streak_30', '30-Tage-Streak', '30 Tage am Stück trainiert', '📆', 'streak', 'current_streak', 30, 200, 11),
('streak_100', '100-Tage-Streak', '100 Tage am Stück trainiert', '🗓️', 'streak', 'current_streak', 100, 1000, 12),
('streak_365', 'Jahres-Streak', '365 Tage am Stück trainiert', '🌟', 'streak', 'current_streak', 365, 5000, 13),
('level_10', 'Level 10', 'Level 10 erreicht', '⭐', 'level', 'level', 10, 100, 20),
('level_25', 'Level 25', 'Level 25 erreicht', '🌟', 'level', 'level', 25, 300, 21),
('level_50', 'Level 50', 'Level 50 erreicht', '✨', 'level', 'level', 50, 1000, 22),
('battle_win_1', 'Erster Sieg', 'Das erste Battle gewonnen', '⚔️', 'battle', 'battle_wins', 1, 25, 30),
('battle_win_10', 'Battle-Haudegen', '10 Battles gewonnen', '🛡️', 'battle', 'battle_wins', 10, 150, 31),
('battle_win_50', 'Battle-Legende', '50 Battles gewonnen', '👑', 'battle', 'battle_wins', 50, 500, 32),
('battle_win_100', 'Unbesiegbar', '100 Battles gewonnen', '🏆', 'battle', 'battle_wins', 100, 1500, 33),
('challenge_5', 'Challenge-Sammler', '5 Challenges abgeschlossen', '🎯', 'challenge', 'challenges_completed', 5, 50, 40),
('challenge_25', 'Challenge-Meister', '25 Challenges abgeschlossen', '🏅', 'challenge', 'challenges_completed', 25, 200, 41),
('challenge_100', 'Challenge-Legende', '100 Challenges abgeschlossen', '🥇', 'challenge', 'challenges_completed', 100, 1000, 42),
('friend_1', 'Erster Freund', 'Erste Freundschaft geschlossen', '🤝', 'social', 'friends_count', 1, 25, 50),
('friend_5', 'Soziales Netzwerk', '5 Freunde hinzugefügt', '👥', 'social', 'friends_count', 5, 100, 51),
('friend_10', 'Beliebt', '10 Freunde hinzugefügt', '🌐', 'social', 'friends_count', 10, 250, 52),
('pr_first', 'Neuer PB', 'Ersten Personal Best aufgestellt', '🚀', 'pr', 'pr_count', 1, 25, 60),
('pr_10', 'PB-Sammler', '10 unterschiedliche Übungen mit PB', '📈', 'pr', 'pr_count', 10, 100, 61),
('run_1', 'Erster Lauf', 'Ersten Lauf aufgezeichnet', '🏃', 'run', 'runs_count', 1, 25, 70);

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
  SELECT COALESCE(jsonb_object_keys(_prof.personal_bests), NULL) INTO _pr_count FROM public.profiles WHERE id = _user_id;
  IF _pr_count IS NULL THEN _pr_count := 0; END IF;

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

CREATE OR REPLACE FUNCTION public.trigger_check_achievements_workout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER workouts_check_achievements
AFTER INSERT ON public.workouts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_achievements_workout();

CREATE OR REPLACE FUNCTION public.trigger_check_achievements_battle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished' AND NEW.winner_id IS NOT NULL THEN
    PERFORM public.check_achievements(NEW.winner_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER battles_check_achievements
AFTER UPDATE OF status ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_achievements_battle();

CREATE OR REPLACE FUNCTION public.trigger_check_achievements_challenge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS DISTINCT FROM NEW.completed_at THEN
    PERFORM public.check_achievements(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_challenges_check_achievements
AFTER UPDATE OF completed_at ON public.user_challenges
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_achievements_challenge();
