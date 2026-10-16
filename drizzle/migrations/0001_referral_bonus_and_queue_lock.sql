CREATE TABLE public.referral_bonuses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), referrer_id UUID NOT NULL, invited_id UUID NOT NULL UNIQUE, coins INTEGER NOT NULL DEFAULT 100, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
GRANT SELECT ON public.referral_bonuses TO authenticated;
GRANT ALL ON public.referral_bonuses TO service_role;
ALTER TABLE public.referral_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_bonuses_select_own ON public.referral_bonuses FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = invited_id);

CREATE OR REPLACE FUNCTION public.claim_queue_match(_mode text, _duration_s integer, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _opponent uuid;
BEGIN
  DELETE FROM public.battle_queue WHERE created_at < now() - interval '3 minutes';
  SELECT q.user_id INTO _opponent
  FROM public.battle_queue q
  WHERE q.mode = _mode AND q.duration_s = _duration_s AND q.battle_id IS NULL AND q.user_id <> _user_id
  ORDER BY q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  RETURN _opponent;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_queue_match(text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queue_match(text, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_referral_bonus(_invited_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer uuid;
BEGIN
  SELECT invited_by INTO _referrer FROM public.profiles WHERE id = _invited_id;
  IF _referrer IS NULL OR _referrer = _invited_id THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_bonuses WHERE invited_id = _invited_id) THEN RETURN; END IF;
  INSERT INTO public.referral_bonuses (referrer_id, invited_id, coins) VALUES (_referrer, _invited_id, 100);
  UPDATE public.profiles SET coins = coins + 100 WHERE id IN (_referrer, _invited_id);
END;
$$;
REVOKE ALL ON FUNCTION public.grant_referral_bonus(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_bonus(uuid) TO service_role;