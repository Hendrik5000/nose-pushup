-- Remove client write access to user_challenges: progress/completed_at are
-- computed exclusively by the server-side workout trigger (security definer).
DROP POLICY IF EXISTS "Users insert own user_challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users update own user_challenges" ON public.user_challenges;

REVOKE INSERT, UPDATE ON public.user_challenges FROM authenticated;
REVOKE ALL ON public.user_challenges FROM anon;

GRANT SELECT, DELETE ON public.user_challenges TO authenticated;
GRANT ALL ON public.user_challenges TO service_role;