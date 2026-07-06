
-- 1) Cap battle_reps.count at 1 (tap-by-one ledger)
ALTER TABLE public.battle_reps ALTER COLUMN count SET DEFAULT 1;
UPDATE public.battle_reps SET count = 1 WHERE count <> 1;
ALTER TABLE public.battle_reps ADD CONSTRAINT battle_reps_count_eq_one CHECK (count = 1);

-- 2) Cap workouts.count at a realistic max
UPDATE public.workouts SET count = 1000 WHERE count > 1000;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_count_max CHECK (count >= 0 AND count <= 1000);

-- 3) Block anonymous auth users on workouts policies
DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;

CREATE POLICY "Users can view own workouts" ON public.workouts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Users can insert own workouts" ON public.workouts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Users can delete own workouts" ON public.workouts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

-- 5) Restrict profiles UPDATE to safe user-editable columns only via column-level grants.
-- Gamification columns (xp, level, streaks, best_count, personal_bests, battle_wins/losses,
-- last_workout_date, streak_freezes, streak_freeze_week) are only writable by triggers /
-- service_role, never by the user directly.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, theme, updated_at) ON public.profiles TO authenticated;
