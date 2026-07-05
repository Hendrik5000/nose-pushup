
CREATE OR REPLACE FUNCTION public.on_workout_inserted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _today date := (NEW.created_at AT TIME ZONE 'UTC')::date;
  _prof public.profiles%ROWTYPE;
  _gained_xp integer;
  _new_xp integer;
  _new_level integer;
  _new_streak integer;
  _cur_pb integer;
  _new_pb jsonb;
BEGIN
  _gained_xp := CASE
    WHEN NEW.exercise_id = 'plank' THEN GREATEST(1, (NEW.duration_ms / 1000)::int)
    ELSE NEW.count * 10
  END;

  INSERT INTO public.daily_stats (user_id, day, total_reps, sessions, total_duration_ms)
  VALUES (NEW.user_id, _today, NEW.count, 1, NEW.duration_ms)
  ON CONFLICT (user_id, day) DO UPDATE SET
    total_reps = public.daily_stats.total_reps + EXCLUDED.total_reps,
    sessions = public.daily_stats.sessions + 1,
    total_duration_ms = public.daily_stats.total_duration_ms + EXCLUDED.total_duration_ms,
    updated_at = now();

  SELECT * INTO _prof FROM public.profiles WHERE id = NEW.user_id;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id) VALUES (NEW.user_id);
    SELECT * INTO _prof FROM public.profiles WHERE id = NEW.user_id;
  END IF;

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

  -- Personal best per exercise, sourced from workout rows (never trust client).
  _cur_pb := COALESCE((_prof.personal_bests ->> NEW.exercise_id)::int, 0);
  IF NEW.count > _cur_pb THEN
    _new_pb := COALESCE(_prof.personal_bests, '{}'::jsonb) || jsonb_build_object(NEW.exercise_id, NEW.count);
  ELSE
    _new_pb := _prof.personal_bests;
  END IF;

  UPDATE public.profiles SET
    xp = _new_xp,
    level = _new_level,
    current_streak = _new_streak,
    longest_streak = GREATEST(_prof.longest_streak, _new_streak),
    last_workout_date = _today,
    personal_bests = _new_pb,
    best_count = CASE WHEN NEW.exercise_id = 'pushup' AND NEW.count > _prof.best_count THEN NEW.count ELSE _prof.best_count END,
    updated_at = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on workouts
DROP TRIGGER IF EXISTS on_workout_inserted_trg ON public.workouts;
CREATE TRIGGER on_workout_inserted_trg
  AFTER INSERT ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.on_workout_inserted();

DROP TRIGGER IF EXISTS on_workout_progress_challenges_trg ON public.workouts;
CREATE TRIGGER on_workout_progress_challenges_trg
  AFTER INSERT ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.on_workout_progress_challenges();

DROP TRIGGER IF EXISTS on_battle_finished_trg ON public.battles;
CREATE TRIGGER on_battle_finished_trg
  AFTER UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.on_battle_finished();
