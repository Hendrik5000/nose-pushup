BEGIN;

-- Existing waiting battles remain private unless explicitly created for public matchmaking.
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- One bounded rolling-window counter per user and invitation type. The row lock makes
-- the limit consistent across server instances and direct authenticated RPC calls.
CREATE TABLE IF NOT EXISTS public.invitation_join_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_kind TEXT NOT NULL CHECK (invitation_kind IN ('battle', 'club')),
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count SMALLINT NOT NULL CHECK (attempt_count BETWEEN 1 AND 8),
  PRIMARY KEY (user_id, invitation_kind)
);

ALTER TABLE public.invitation_join_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.invitation_join_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_invitation_join_attempt(p_kind TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id UUID := (SELECT auth.uid());
  _window_started_at TIMESTAMPTZ;
  _attempt_count SMALLINT;
  _now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  _inserted BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('battle', 'club') THEN
    RAISE EXCEPTION 'Invalid invitation type' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.invitation_join_limits (
    user_id, invitation_kind, window_started_at, attempt_count
  ) VALUES (_user_id, p_kind, _now, 1)
  ON CONFLICT (user_id, invitation_kind) DO NOTHING
  RETURNING TRUE INTO _inserted;

  IF COALESCE(_inserted, false) THEN
    RETURN;
  END IF;

  SELECT limits.window_started_at, limits.attempt_count
    INTO _window_started_at, _attempt_count
    FROM public.invitation_join_limits AS limits
   WHERE limits.user_id = _user_id
     AND limits.invitation_kind = p_kind
   FOR UPDATE;

  _now := pg_catalog.clock_timestamp();
  IF _window_started_at <= _now - INTERVAL '1 minute' THEN
    UPDATE public.invitation_join_limits
       SET window_started_at = _now, attempt_count = 1
     WHERE user_id = _user_id AND invitation_kind = p_kind;
  ELSIF _attempt_count >= 8 THEN
    RAISE EXCEPTION 'Too many invitation attempts; wait one minute' USING ERRCODE = 'P0001';
  ELSE
    UPDATE public.invitation_join_limits
       SET attempt_count = attempt_count + 1
     WHERE user_id = _user_id AND invitation_kind = p_kind;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_invitation_join_attempt(TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- Only explicit public-queue rows can be claimed by random matchmaking.
CREATE OR REPLACE FUNCTION public.claim_public_battle(_mode TEXT, _duration_s INTEGER)
RETURNS TABLE (id UUID, code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id UUID := (SELECT auth.uid());
  _battle_id UUID;
  _code TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _mode IS NULL OR _mode NOT IN ('timed', 'first_to', 'sprint', 'endurance')
     OR _duration_s IS NULL OR _duration_s < 15 OR _duration_s > 600 THEN
    RAISE EXCEPTION 'Invalid matchmaking request' USING ERRCODE = '22023';
  END IF;

  SELECT battle.id, battle.code
    INTO _battle_id, _code
    FROM public.battles AS battle
   WHERE battle.is_public = true
     AND battle.status = 'waiting'
     AND battle.guest_id IS NULL
     AND battle.host_id <> _user_id
     AND battle.is_bot = false
     AND battle.mode = _mode
     AND battle.duration_s = _duration_s
   ORDER BY battle.created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.battles AS battle
     SET guest_id = _user_id
   WHERE battle.id = _battle_id
     AND battle.status = 'waiting'
     AND battle.guest_id IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT _battle_id, _code;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_public_battle(TEXT, INTEGER) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.claim_public_battle(TEXT, INTEGER) TO authenticated;

-- Remove direct guest_id updates; invitation joins now go through the rate-limited RPC.
REVOKE UPDATE ON TABLE public.battles FROM authenticated;
REVOKE UPDATE (guest_id) ON TABLE public.battles FROM authenticated;
DROP POLICY IF EXISTS "battles join as guest" ON public.battles;
DROP POLICY IF EXISTS "battles update participants" ON public.battles;

-- Restore only the two legitimate state transitions through identity-checked RPCs.
CREATE OR REPLACE FUNCTION public.start_battle(_battle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id UUID := (SELECT auth.uid());
  _battle public.battles%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT battle.*
    INTO _battle
    FROM public.battles AS battle
   WHERE battle.id = _battle_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF _battle.host_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Nur der Host kann starten' USING ERRCODE = '42501';
  END IF;
  IF _battle.status <> 'waiting' THEN
    RAISE EXCEPTION 'Battle nicht im Wartezustand' USING ERRCODE = 'P0001';
  END IF;
  IF _battle.guest_id IS NULL AND NOT _battle.is_bot THEN
    RAISE EXCEPTION 'Noch kein Gegner' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.battles AS battle
     SET status = 'active', started_at = pg_catalog.clock_timestamp()
   WHERE battle.id = _battle_id AND battle.status = 'waiting';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle nicht mehr startbar' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.start_battle(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.start_battle(UUID) TO authenticated;

-- Online scores come from the immutable tap ledger; only a bot's simulated score
-- is supplied by the host client. The row lock makes finishing idempotent.
CREATE OR REPLACE FUNCTION public.finish_battle(
  _battle_id UUID,
  _guest_count INTEGER DEFAULT 0
)
RETURNS TABLE (winner_id UUID, host_count INTEGER, guest_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id UUID := (SELECT auth.uid());
  _battle public.battles%ROWTYPE;
  _host_count INTEGER;
  _guest_count_actual INTEGER;
  _winner_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _guest_count IS NULL OR _guest_count < 0 OR _guest_count > 10000 THEN
    RAISE EXCEPTION 'Invalid battle score' USING ERRCODE = '22023';
  END IF;

  SELECT battle.*
    INTO _battle
    FROM public.battles AS battle
   WHERE battle.id = _battle_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF _user_id IS DISTINCT FROM _battle.host_id
     AND _user_id IS DISTINCT FROM _battle.guest_id THEN
    RAISE EXCEPTION 'Kein Teilnehmer' USING ERRCODE = '42501';
  END IF;
  IF _battle.status = 'finished' THEN
    RETURN QUERY SELECT _battle.winner_id, _battle.host_count, _battle.guest_count;
    RETURN;
  END IF;
  IF _battle.status <> 'active' THEN
    RAISE EXCEPTION 'Battle nicht aktiv' USING ERRCODE = 'P0001';
  END IF;

  SELECT LEAST(COALESCE(SUM(rep.count), 0), 10000)::INTEGER
    INTO _host_count
    FROM public.battle_reps AS rep
   WHERE rep.battle_id = _battle.id AND rep.user_id = _battle.host_id;

  IF _battle.is_bot THEN
    _guest_count_actual := _guest_count;
  ELSE
    SELECT LEAST(COALESCE(SUM(rep.count), 0), 10000)::INTEGER
      INTO _guest_count_actual
      FROM public.battle_reps AS rep
     WHERE rep.battle_id = _battle.id AND rep.user_id = _battle.guest_id;
  END IF;

  IF _host_count > _guest_count_actual THEN
    _winner_id := _battle.host_id;
  ELSIF _guest_count_actual > _host_count THEN
    _winner_id := _battle.guest_id;
  END IF;

  UPDATE public.battles AS battle
     SET status = 'finished',
         host_count = _host_count,
         guest_count = _guest_count_actual,
         winner_id = _winner_id
   WHERE battle.id = _battle.id AND battle.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle nicht mehr aktiv' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY SELECT _winner_id, _host_count, _guest_count_actual;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_battle(UUID, INTEGER) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finish_battle(UUID, INTEGER) TO authenticated;

DROP FUNCTION IF EXISTS public.join_battle_by_code(TEXT);
CREATE FUNCTION public.join_battle_by_code(_code TEXT)
RETURNS TABLE (success BOOLEAN, joined_id UUID, error_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id UUID := (SELECT auth.uid());
  _normalized_code TEXT;
  _battle public.battles%ROWTYPE;
  _joined_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.claim_invitation_join_attempt('battle');
  _normalized_code := pg_catalog.upper(pg_catalog.btrim(coalesce(_code, '')));
  IF _normalized_code !~ '^[A-Z0-9]{4,16}$' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'invalid_code'::TEXT;
    RETURN;
  END IF;

  SELECT battle.*
    INTO _battle
    FROM public.battles AS battle
   WHERE battle.code = _normalized_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;
  IF _battle.host_id = _user_id THEN
    RETURN QUERY SELECT TRUE, _battle.id, NULL::TEXT;
    RETURN;
  END IF;
  IF _battle.status <> 'waiting' OR _battle.guest_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'unavailable'::TEXT;
    RETURN;
  END IF;

  UPDATE public.battles AS battle
     SET guest_id = _user_id
   WHERE battle.id = _battle.id
     AND battle.status = 'waiting'
     AND battle.guest_id IS NULL
  RETURNING battle.id INTO _joined_id;

  IF _joined_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'unavailable'::TEXT;
    RETURN;
  END IF;
  RETURN QUERY SELECT TRUE, _joined_id, NULL::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.join_battle_by_code(TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.join_battle_by_code(TEXT) TO authenticated;

-- Replace the old club RPC with an authenticated, database-rate-limited implementation.
DROP FUNCTION IF EXISTS public.join_club_by_code(TEXT);
CREATE FUNCTION public.join_club_by_code(_code TEXT)
RETURNS TABLE (success BOOLEAN, club_id UUID, error_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id UUID := (SELECT auth.uid());
  _normalized_code TEXT;
  _club public.clubs%ROWTYPE;
  _member_count INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.claim_invitation_join_attempt('club');
  _normalized_code := pg_catalog.upper(pg_catalog.btrim(coalesce(_code, '')));
  IF _normalized_code !~ '^[A-Z0-9]{4,16}$' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'invalid_code'::TEXT;
    RETURN;
  END IF;

  SELECT club.*
    INTO _club
    FROM public.clubs AS club
   WHERE club.code = _normalized_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.club_members AS member
     WHERE member.club_id = _club.id AND member.user_id = _user_id
  ) THEN
    RETURN QUERY SELECT TRUE, _club.id, NULL::TEXT;
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::INTEGER
    INTO _member_count
    FROM public.club_members AS member
   WHERE member.club_id = _club.id;
  IF _member_count >= 30 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'full'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (_club.id, _user_id, 'member');

  RETURN QUERY SELECT TRUE, _club.id, NULL::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.join_club_by_code(TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.join_club_by_code(TEXT) TO authenticated;

COMMIT;
