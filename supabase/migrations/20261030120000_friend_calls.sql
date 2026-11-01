-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
--
-- 1:1 voice/video calls between accepted friends (WebRTC).
--  * public.calls holds call state; public.call_signals carries SDP/ICE
--    messages and is protected by RLS (only the two participants can read).
--  * Clients never write these tables directly; they use the RPCs below.
--  * Ringing calls expire after 60 seconds; an unanswered/cancelled call
--    creates a "missed call" item in the callee's Postfach.
--
-- Requires 20261030100000_friend_codes_postfach.sql and
-- 20261030110000_nexus_friend_chat_images.sql.

DO $friend_calls_preflight$
BEGIN
  IF pg_catalog.to_regclass('public.postfach_items') IS NULL
    OR pg_catalog.to_regclass('public.conversations') IS NULL
    OR pg_catalog.to_regprocedure('public.are_friends(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'FRIEND_CALLS_SCHEMA_MISMATCH: apply the friend code and friend chat migrations first';
  END IF;
END;
$friend_calls_preflight$;

CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('audio', 'video')),
  status text NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing', 'accepted', 'declined', 'cancelled', 'missed', 'ended', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT calls_not_self CHECK (caller_id <> callee_id)
);

CREATE INDEX IF NOT EXISTS calls_caller_idx ON public.calls (caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calls_callee_idx ON public.calls (callee_id, created_at DESC);
-- Backstop: a person can have only one open call per role.
CREATE UNIQUE INDEX IF NOT EXISTS calls_one_open_as_caller_idx
  ON public.calls (caller_id) WHERE status IN ('ringing', 'accepted');
CREATE UNIQUE INDEX IF NOT EXISTS calls_one_open_as_callee_idx
  ON public.calls (callee_id) WHERE status IN ('ringing', 'accepted');

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calls_select_participants ON public.calls;
CREATE POLICY calls_select_participants ON public.calls
  FOR SELECT TO authenticated USING (auth.uid() IN (caller_id, callee_id));
REVOKE ALL ON public.calls FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.calls TO authenticated;

CREATE TABLE IF NOT EXISTS public.call_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('offer', 'answer', 'candidate')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT call_signals_payload_size CHECK (pg_catalog.octet_length(payload::text) <= 16384)
);

CREATE INDEX IF NOT EXISTS call_signals_call_idx ON public.call_signals (call_id, id);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
-- Participants read only what the other side sent.
DROP POLICY IF EXISTS call_signals_select_peer ON public.call_signals;
CREATE POLICY call_signals_select_peer ON public.call_signals
  FOR SELECT TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_id AND auth.uid() IN (c.caller_id, c.callee_id)
    )
  );
REVOKE ALL ON public.call_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.call_signals TO authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Ringing > 60s => missed. Accepted > 6h without end => ended (abandoned).
CREATE OR REPLACE FUNCTION public.calls_expire_stale(p_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.calls
  SET status = CASE WHEN status = 'ringing' THEN 'missed' ELSE 'ended' END,
      ended_at = now()
  WHERE (caller_id = p_user OR callee_id = p_user)
    AND (
      (status = 'ringing' AND created_at < now() - interval '60 seconds')
      OR (status = 'accepted' AND COALESCE(answered_at, created_at) < now() - interval '6 hours')
    )
$$;

REVOKE ALL ON FUNCTION public.calls_expire_stale(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.calls_postfach_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  who_name text;
  who_avatar text;
BEGIN
  IF OLD.status = 'ringing' AND NEW.status IN ('missed', 'cancelled') THEN
    SELECT display_name, avatar_url INTO who_name, who_avatar
    FROM public.profiles WHERE id = NEW.caller_id;
    PERFORM public.postfach_push(
      NEW.callee_id, 'missed_call', NEW.caller_id, NEW.id,
      jsonb_build_object(
        'from_name', COALESCE(NULLIF(pg_catalog.btrim(who_name), ''), 'Freund'),
        'from_avatar_url', who_avatar,
        'call_kind', NEW.kind
      )
    );
  END IF;
  -- Signals are only useful while the call is open.
  IF NEW.status NOT IN ('ringing', 'accepted') AND OLD.status IN ('ringing', 'accepted') THEN
    DELETE FROM public.call_signals WHERE call_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.calls_postfach_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS calls_postfach_sync_trg ON public.calls;
CREATE TRIGGER calls_postfach_sync_trg
  AFTER UPDATE OF status ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.calls_postfach_sync();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Returns jsonb {status: 'ringing'|'callee_busy'|'already_in_call'|'not_friends'|'invalid_kind', call_id?}
CREATE OR REPLACE FUNCTION public.start_call(p_callee uuid, p_kind text, p_conversation uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  new_id uuid;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('audio', 'video') THEN
    RETURN jsonb_build_object('status', 'invalid_kind');
  END IF;
  IF p_callee IS NULL OR p_callee = me OR NOT public.are_friends(me, p_callee) THEN
    RETURN jsonb_build_object('status', 'not_friends');
  END IF;

  PERFORM public.calls_expire_stale(me);
  PERFORM public.calls_expire_stale(p_callee);

  IF EXISTS (
    SELECT 1 FROM public.calls
    WHERE status IN ('ringing', 'accepted') AND (caller_id = me OR callee_id = me)
  ) THEN
    RETURN jsonb_build_object('status', 'already_in_call');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.calls
    WHERE status IN ('ringing', 'accepted') AND (caller_id = p_callee OR callee_id = p_callee)
  ) THEN
    RETURN jsonb_build_object('status', 'callee_busy');
  END IF;

  INSERT INTO public.calls (caller_id, callee_id, conversation_id, kind)
  VALUES (
    me, p_callee,
    CASE WHEN p_conversation IS NOT NULL AND public.can_post_in_conversation(p_conversation)
         THEN p_conversation END,
    p_kind
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('status', 'ringing', 'call_id', new_id);
END;
$$;

-- Callee accepts/declines. Returns 'accepted' | 'declined' | 'missed' | 'stale'.
CREATE OR REPLACE FUNCTION public.respond_to_call(p_call_id uuid, p_accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  call_row public.calls%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO call_row FROM public.calls WHERE id = p_call_id AND callee_id = me FOR UPDATE;
  IF NOT FOUND OR call_row.status <> 'ringing' THEN
    RETURN 'stale';
  END IF;
  IF call_row.created_at < now() - interval '60 seconds' THEN
    UPDATE public.calls SET status = 'missed', ended_at = now() WHERE id = p_call_id;
    RETURN 'missed';
  END IF;
  IF NOT public.are_friends(me, call_row.caller_id) THEN
    UPDATE public.calls SET status = 'declined', ended_at = now() WHERE id = p_call_id;
    RETURN 'declined';
  END IF;

  IF p_accept THEN
    UPDATE public.calls SET status = 'accepted', answered_at = now() WHERE id = p_call_id;
    RETURN 'accepted';
  END IF;
  UPDATE public.calls SET status = 'declined', ended_at = now() WHERE id = p_call_id;
  RETURN 'declined';
END;
$$;

-- Either participant ends the call. Idempotent; returns the final status.
CREATE OR REPLACE FUNCTION public.end_call(p_call_id uuid, p_failed boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  call_row public.calls%ROWTYPE;
  final_status text;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO call_row FROM public.calls
  WHERE id = p_call_id AND (caller_id = me OR callee_id = me) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  IF call_row.status NOT IN ('ringing', 'accepted') THEN
    RETURN call_row.status;
  END IF;

  IF call_row.status = 'ringing' THEN
    final_status := CASE
      WHEN call_row.caller_id = me THEN 'cancelled'
      WHEN call_row.created_at < now() - interval '60 seconds' THEN 'missed'
      ELSE 'declined' END;
  ELSE
    final_status := CASE WHEN p_failed THEN 'failed' ELSE 'ended' END;
  END IF;

  UPDATE public.calls SET status = final_status, ended_at = now() WHERE id = p_call_id;
  RETURN final_status;
END;
$$;

-- WebRTC signalling message (offer / answer / ICE candidate).
CREATE OR REPLACE FUNCTION public.send_call_signal(p_call_id uuid, p_type text, p_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  call_row public.calls%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('offer', 'answer', 'candidate') OR p_payload IS NULL THEN
    RAISE EXCEPTION 'invalid_signal' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO call_row FROM public.calls
  WHERE id = p_call_id AND (caller_id = me OR callee_id = me);
  IF NOT FOUND OR call_row.status NOT IN ('ringing', 'accepted') THEN
    RETURN false;
  END IF;
  -- offers come from the caller, answers from the callee after acceptance
  IF (p_type = 'offer' AND call_row.caller_id <> me)
    OR (p_type = 'answer' AND (call_row.callee_id <> me OR call_row.status <> 'accepted')) THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM public.call_signals WHERE call_id = p_call_id) >= 400 THEN
    RETURN false;
  END IF;

  INSERT INTO public.call_signals (call_id, sender_id, type, payload)
  VALUES (p_call_id, me, p_type, p_payload);
  RETURN true;
END;
$$;

-- Incoming calls that are still ringing, with the caller's name (the caller's
-- profile is readable through the friendship, but this avoids a second round trip).
CREATE OR REPLACE FUNCTION public.get_my_incoming_calls()
RETURNS TABLE (
  call_id uuid,
  caller_id uuid,
  caller_name text,
  caller_avatar_url text,
  kind text,
  conversation_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  PERFORM public.calls_expire_stale(auth.uid());
  RETURN QUERY
  SELECT c.id, c.caller_id, COALESCE(NULLIF(pg_catalog.btrim(p.display_name), ''), 'Freund'),
         p.avatar_url, c.kind, c.conversation_id, c.created_at
  FROM public.calls c
  LEFT JOIN public.profiles p ON p.id = c.caller_id
  WHERE c.callee_id = auth.uid() AND c.status = 'ringing'
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION
  public.start_call(uuid, text, uuid),
  public.respond_to_call(uuid, boolean),
  public.end_call(uuid, boolean),
  public.send_call_signal(uuid, text, jsonb),
  public.get_my_incoming_calls()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.start_call(uuid, text, uuid),
  public.respond_to_call(uuid, boolean),
  public.end_call(uuid, boolean),
  public.send_call_signal(uuid, text, jsonb),
  public.get_my_incoming_calls()
TO authenticated;

DO $calls_realtime$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['calls', 'call_signals'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE pg_catalog.format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END;
$calls_realtime$;
