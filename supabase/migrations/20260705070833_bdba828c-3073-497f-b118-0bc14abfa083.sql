
-- 1) profile_stat_tamper: restrict UPDATE on profiles to safe columns via column privileges
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (display_name, avatar_url, theme) ON public.profiles TO authenticated;

-- 2) SUPA_auth_allow_anonymous_sign_ins: scope RLS policies to authenticated role
DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;
CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3) profiles_restricted_to_self_only: allow accepted friends and battle counterparts to read the profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Friends can view profile" ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = profiles.id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = profiles.id)
      )
  )
);
CREATE POLICY "Battle opponents can view profile" ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.battles b
    WHERE (b.host_id = auth.uid() AND b.guest_id = profiles.id)
       OR (b.guest_id = auth.uid() AND b.host_id = profiles.id)
  )
);

-- 4) battle_score_trust: default rep insert count to 1 so the server can sum the ledger
ALTER TABLE public.battle_reps ALTER COLUMN count SET DEFAULT 1;
