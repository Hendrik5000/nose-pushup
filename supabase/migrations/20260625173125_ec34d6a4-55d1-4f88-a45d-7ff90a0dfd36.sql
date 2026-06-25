
-- Etappe 1: XP, Level, Streaks, daily stats
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_workout_date date,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS streak_freezes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_freeze_week date;

-- Daily aggregated stats for fast dashboards
CREATE TABLE IF NOT EXISTS public.daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  total_reps integer NOT NULL DEFAULT 0,
  sessions integer NOT NULL DEFAULT 0,
  total_duration_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_stats TO authenticated;
GRANT ALL ON public.daily_stats TO service_role;

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_stats" ON public.daily_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_stats" ON public.daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_stats" ON public.daily_stats
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS daily_stats_user_day_idx ON public.daily_stats (user_id, day DESC);

-- XP per rep -> level formula: level = floor(sqrt(xp/100)) + 1, capped at 50
CREATE OR REPLACE FUNCTION public.calc_level(_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(50, GREATEST(1, FLOOR(SQRT(GREATEST(_xp,0)::numeric / 100))::int + 1));
$$;

-- Trigger after workout insert: bump XP, level, streak, daily_stats
CREATE OR REPLACE FUNCTION public.on_workout_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (NEW.created_at AT TIME ZONE 'UTC')::date;
  _prof public.profiles%ROWTYPE;
  _gained_xp integer;
  _new_xp integer;
  _new_level integer;
  _new_streak integer;
BEGIN
  -- Only count rep-based exercises toward XP for now (push-ups, sit-ups, squats, burpees)
  _gained_xp := CASE
    WHEN NEW.exercise_id = 'plank' THEN GREATEST(1, (NEW.duration_ms / 1000)::int) -- 1 XP per sec
    ELSE NEW.count * 10
  END;

  -- Upsert daily stats
  INSERT INTO public.daily_stats (user_id, day, total_reps, sessions, total_duration_ms)
  VALUES (NEW.user_id, _today, NEW.count, 1, NEW.duration_ms)
  ON CONFLICT (user_id, day) DO UPDATE SET
    total_reps = public.daily_stats.total_reps + EXCLUDED.total_reps,
    sessions = public.daily_stats.sessions + 1,
    total_duration_ms = public.daily_stats.total_duration_ms + EXCLUDED.total_duration_ms,
    updated_at = now();

  -- Load profile
  SELECT * INTO _prof FROM public.profiles WHERE id = NEW.user_id;
  IF NOT FOUND THEN
    -- Create profile shell if somehow missing
    INSERT INTO public.profiles (id) VALUES (NEW.user_id);
    SELECT * INTO _prof FROM public.profiles WHERE id = NEW.user_id;
  END IF;

  -- Streak
  IF _prof.last_workout_date IS NULL THEN
    _new_streak := 1;
  ELSIF _prof.last_workout_date = _today THEN
    _new_streak := GREATEST(_prof.current_streak, 1);
  ELSIF _prof.last_workout_date = _today - INTERVAL '1 day' THEN
    _new_streak := _prof.current_streak + 1;
  ELSIF _prof.last_workout_date = _today - INTERVAL '2 days'
        AND (_prof.streak_freeze_week IS NULL OR _prof.streak_freeze_week < date_trunc('week', _today)::date)
        AND _prof.streak_freezes > 0 THEN
    _new_streak := _prof.current_streak + 1;
    UPDATE public.profiles
      SET streak_freezes = streak_freezes - 1,
          streak_freeze_week = date_trunc('week', _today)::date
      WHERE id = NEW.user_id;
  ELSE
    _new_streak := 1;
  END IF;

  _new_xp := _prof.xp + _gained_xp;
  _new_level := public.calc_level(_new_xp);

  UPDATE public.profiles SET
    xp = _new_xp,
    level = _new_level,
    current_streak = _new_streak,
    longest_streak = GREATEST(_prof.longest_streak, _new_streak),
    last_workout_date = _today,
    updated_at = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workouts_after_insert_gamify ON public.workouts;
CREATE TRIGGER workouts_after_insert_gamify
AFTER INSERT ON public.workouts
FOR EACH ROW EXECUTE FUNCTION public.on_workout_inserted();

-- Backfill: replay existing workouts into daily_stats + XP/level/streak (best-effort)
-- Reset gamification fields first to avoid double-count when re-running
UPDATE public.profiles SET xp = 0, level = 1, current_streak = 0, longest_streak = 0, last_workout_date = NULL;
DELETE FROM public.daily_stats;

-- Rebuild daily_stats
INSERT INTO public.daily_stats (user_id, day, total_reps, sessions, total_duration_ms)
SELECT user_id,
       (created_at AT TIME ZONE 'UTC')::date AS day,
       SUM(count)::int,
       COUNT(*)::int,
       SUM(duration_ms)::bigint
FROM public.workouts
GROUP BY user_id, (created_at AT TIME ZONE 'UTC')::date;

-- Rebuild XP / level / streaks per user
DO $$
DECLARE
  _u uuid;
  _xp integer;
  _streak integer;
  _longest integer;
  _last date;
  _prev date;
  _row record;
BEGIN
  FOR _u IN SELECT DISTINCT user_id FROM public.workouts LOOP
    _xp := 0;
    _streak := 0;
    _longest := 0;
    _last := NULL;
    _prev := NULL;
    FOR _row IN
      SELECT day, total_reps
      FROM public.daily_stats
      WHERE user_id = _u
      ORDER BY day ASC
    LOOP
      _xp := _xp + _row.total_reps * 10;
      IF _prev IS NULL OR _row.day = _prev + INTERVAL '1 day' THEN
        _streak := COALESCE(_streak,0) + 1;
      ELSE
        _streak := 1;
      END IF;
      IF _streak > _longest THEN _longest := _streak; END IF;
      _prev := _row.day;
      _last := _row.day;
    END LOOP;

    UPDATE public.profiles SET
      xp = _xp,
      level = public.calc_level(_xp),
      current_streak = CASE
        WHEN _last = CURRENT_DATE OR _last = CURRENT_DATE - INTERVAL '1 day' THEN _streak
        ELSE 0
      END,
      longest_streak = _longest,
      last_workout_date = _last
    WHERE id = _u;
  END LOOP;
END$$;
