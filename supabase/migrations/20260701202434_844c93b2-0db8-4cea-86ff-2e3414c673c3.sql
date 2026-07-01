
-- =========================================================
-- Challenges: templates
-- =========================================================
CREATE TABLE public.challenges (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🎯',
  period text NOT NULL CHECK (period IN ('daily','weekly')),
  goal_type text NOT NULL CHECK (goal_type IN ('reps','sessions','streak','pr','duration_sec')),
  goal_value integer NOT NULL CHECK (goal_value > 0),
  xp_reward integer NOT NULL DEFAULT 50,
  exercise_id text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges readable by authenticated"
  ON public.challenges FOR SELECT TO authenticated USING (true);

-- =========================================================
-- User challenge progress
-- =========================================================
CREATE TABLE public.user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id text NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id, period_start)
);

CREATE INDEX user_challenges_user_period_idx
  ON public.user_challenges (user_id, period_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_challenges TO authenticated;
GRANT ALL ON public.user_challenges TO service_role;

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own user_challenges"
  ON public.user_challenges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own user_challenges"
  ON public.user_challenges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own user_challenges"
  ON public.user_challenges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own user_challenges"
  ON public.user_challenges FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_challenges_updated_at
  BEFORE UPDATE ON public.user_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Coach advice cache (rate-limit)
-- =========================================================
CREATE TABLE public.coach_advice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advice text NOT NULL,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coach_advice_user_created_idx
  ON public.coach_advice (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.coach_advice TO authenticated;
GRANT ALL ON public.coach_advice TO service_role;

ALTER TABLE public.coach_advice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own coach_advice"
  ON public.coach_advice FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own coach_advice"
  ON public.coach_advice FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own coach_advice"
  ON public.coach_advice FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- Helper: current period start (day for daily, ISO week Monday for weekly)
-- =========================================================
CREATE OR REPLACE FUNCTION public.challenge_period_start(_period text, _day date)
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _period = 'daily' THEN _day
    WHEN _period = 'weekly' THEN date_trunc('week', _day)::date
    ELSE _day
  END;
$$;

-- =========================================================
-- Progress trigger on workouts
-- =========================================================
CREATE OR REPLACE FUNCTION public.on_workout_progress_challenges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (NEW.created_at AT TIME ZONE 'UTC')::date;
  _c public.challenges%ROWTYPE;
  _period_start date;
  _delta integer;
  _uc_id uuid;
  _new_progress integer;
  _was_completed timestamptz;
  _prev_best integer;
BEGIN
  SELECT best_count INTO _prev_best FROM public.profiles WHERE id = NEW.user_id;
  IF _prev_best IS NULL THEN _prev_best := 0; END IF;

  FOR _c IN SELECT * FROM public.challenges WHERE active = true LOOP
    -- Exercise filter (nullable = any exercise)
    IF _c.exercise_id IS NOT NULL AND _c.exercise_id <> NEW.exercise_id THEN
      CONTINUE;
    END IF;

    _period_start := public.challenge_period_start(_c.period, _today);

    _delta := CASE _c.goal_type
      WHEN 'reps' THEN NEW.count
      WHEN 'sessions' THEN 1
      WHEN 'duration_sec' THEN GREATEST(0, (NEW.duration_ms / 1000)::int)
      WHEN 'pr' THEN CASE WHEN NEW.count > _prev_best THEN 1 ELSE 0 END
      WHEN 'streak' THEN 1  -- any workout today ticks streak-hold
      ELSE 0
    END;

    IF _delta <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.user_challenges (user_id, challenge_id, period_start, progress)
    VALUES (NEW.user_id, _c.id, _period_start, 0)
    ON CONFLICT (user_id, challenge_id, period_start) DO NOTHING;

    SELECT id, completed_at INTO _uc_id, _was_completed
    FROM public.user_challenges
    WHERE user_id = NEW.user_id AND challenge_id = _c.id AND period_start = _period_start;

    IF _was_completed IS NOT NULL THEN CONTINUE; END IF;

    _new_progress := LEAST(_c.goal_value, (SELECT progress FROM public.user_challenges WHERE id = _uc_id) + _delta);

    IF _new_progress >= _c.goal_value THEN
      UPDATE public.user_challenges
        SET progress = _c.goal_value, completed_at = now(), updated_at = now()
        WHERE id = _uc_id;
      -- Bonus XP
      UPDATE public.profiles
        SET xp = xp + _c.xp_reward,
            level = public.calc_level(xp + _c.xp_reward),
            updated_at = now()
        WHERE id = NEW.user_id;
    ELSE
      UPDATE public.user_challenges
        SET progress = _new_progress, updated_at = now()
        WHERE id = _uc_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workouts_progress_challenges
  AFTER INSERT ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.on_workout_progress_challenges();

-- =========================================================
-- Seed challenges
-- =========================================================
INSERT INTO public.challenges (id, title, description, icon, period, goal_type, goal_value, xp_reward, exercise_id, sort_order) VALUES
  ('daily_50_pushups',   '50 Push-Ups',         'Schaffe heute 50 Push-Ups.',              '💪', 'daily',  'reps',        50,  50,  'pushup', 10),
  ('daily_100_reps',     '100 Reps gesamt',     'Sammle 100 Wiederholungen über alle Übungen.', '🔥', 'daily', 'reps',   100, 60,  NULL,     20),
  ('daily_3_sessions',   '3 Sessions',          'Starte heute drei separate Trainings.',   '⚡', 'daily',  'sessions',   3,   40,  NULL,     30),
  ('daily_streak_hold',  'Streak halten',       'Trainiere heute – Streak bleibt stabil.', '🧯', 'daily',  'streak',     1,   30,  NULL,     40),
  ('daily_new_pr',       'Neuer Bestwert',      'Knacke deinen Push-Up-Rekord.',           '🏆', 'daily',  'pr',         1,   80,  'pushup', 50),
  ('weekly_300_pushups', '300 Push-Ups',        'Diese Woche 300 Push-Ups.',               '🎯', 'weekly', 'reps',       300, 200, 'pushup', 10),
  ('weekly_1000_reps',   '1000 Reps',           '1000 Wiederholungen gesamt.',             '🚀', 'weekly', 'reps',       1000,300, NULL,     20),
  ('weekly_5_days',      '5 Trainingstage',     'Trainiere an 5 verschiedenen Tagen.',     '📅', 'weekly', 'sessions',   5,   250, NULL,     30),
  ('weekly_pr',          'Wochen-PR',           'Setze diese Woche einen neuen Push-Up-PR.', '👑', 'weekly', 'pr',       1,   200, 'pushup', 40);
