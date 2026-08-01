
-- 1. Body metrics on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,1),
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS daily_goal integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS share_activity boolean NOT NULL DEFAULT true;

GRANT UPDATE (birth_year, height_cm, weight_kg, sex, daily_goal, share_activity) ON public.profiles TO authenticated;

-- 2. Runs
CREATE TABLE IF NOT EXISTS public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distance_m integer NOT NULL DEFAULT 0,
  duration_ms bigint NOT NULL DEFAULT 0,
  calories integer NOT NULL DEFAULT 0,
  path jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own runs" ON public.runs;
CREATE POLICY "Users view own runs" ON public.runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own runs" ON public.runs;
CREATE POLICY "Users insert own runs" ON public.runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND distance_m BETWEEN 0 AND 300000 AND duration_ms BETWEEN 0 AND 86400000);
DROP POLICY IF EXISTS "Users delete own runs" ON public.runs;
CREATE POLICY "Users delete own runs" ON public.runs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Health entries (Health Connect / manual sync)
CREATE TABLE IF NOT EXISTS public.health_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  steps integer NOT NULL DEFAULT 0,
  active_kcal integer NOT NULL DEFAULT 0,
  weight_kg numeric(5,1),
  sleep_min integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_entries TO authenticated;
GRANT ALL ON public.health_entries TO service_role;
ALTER TABLE public.health_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own health entries" ON public.health_entries;
CREATE POLICY "Users manage own health entries" ON public.health_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND steps BETWEEN 0 AND 200000 AND active_kcal BETWEEN 0 AND 20000 AND sleep_min BETWEEN 0 AND 1440);
DROP TRIGGER IF EXISTS health_entries_updated_at ON public.health_entries;
CREATE TRIGGER health_entries_updated_at BEFORE UPDATE ON public.health_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Friends can see shared daily activity
DROP POLICY IF EXISTS "Friends view shared daily stats" ON public.daily_stats;
CREATE POLICY "Friends view shared daily stats" ON public.daily_stats FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    JOIN public.profiles p ON p.id = daily_stats.user_id
    WHERE f.status = 'accepted'
      AND p.share_activity = true
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = daily_stats.user_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = daily_stats.user_id)
      )
  )
);

-- 5. Guest (anonymous) users may use the app again
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND count > 0 AND count <= 1000);
DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;
CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own user_challenges" ON public.user_challenges;
CREATE POLICY "Users view own user_challenges" ON public.user_challenges FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own user_challenges" ON public.user_challenges;
CREATE POLICY "Users insert own user_challenges" ON public.user_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own user_challenges" ON public.user_challenges;
CREATE POLICY "Users update own user_challenges" ON public.user_challenges FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own user_challenges" ON public.user_challenges;
CREATE POLICY "Users delete own user_challenges" ON public.user_challenges FOR DELETE TO authenticated USING (auth.uid() = user_id);
