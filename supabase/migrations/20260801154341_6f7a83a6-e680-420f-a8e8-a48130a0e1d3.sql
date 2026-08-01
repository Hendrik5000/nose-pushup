
DROP TRIGGER IF EXISTS workouts_after_insert_gamify ON public.workouts;
DROP TRIGGER IF EXISTS trg_workouts_progress_challenges ON public.workouts;
DROP TRIGGER IF EXISTS trg_on_battle_finished ON public.battles;
ALTER TABLE public.daily_stats REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_stats;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
