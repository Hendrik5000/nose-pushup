
-- Lock down battle result fields: revoke direct UPDATE, keep only guest_id updatable so joinBattle still works.
REVOKE UPDATE ON public.battles FROM authenticated;
GRANT UPDATE (guest_id) ON public.battles TO authenticated;

-- Exclude anonymous auth users from user_challenges policies
DROP POLICY IF EXISTS "Users view own user_challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users update own user_challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users delete own user_challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users insert own user_challenges" ON public.user_challenges;

CREATE POLICY "Users view own user_challenges" ON public.user_challenges
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Users insert own user_challenges" ON public.user_challenges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Users update own user_challenges" ON public.user_challenges
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE))
  WITH CHECK (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Users delete own user_challenges" ON public.user_challenges
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));
