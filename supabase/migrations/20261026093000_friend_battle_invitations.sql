-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
-- A friend invitation is private and does not allocate/start a battle until the
-- addressed recipient explicitly accepts it. Expiry is 24 hours; only its sender
-- can cancel while pending. No push delivery is implemented by this migration.

DO $friend_battle_invitation_preflight$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'auth.users', 'public.profiles', 'public.friendships', 'public.battles'
  ] LOOP
    IF pg_catalog.to_regclass(relation_name) IS NULL THEN
      RAISE EXCEPTION 'FRIEND_BATTLE_SCHEMA_MISMATCH: missing relation %', relation_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'friendships' AND column_name = 'requester_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'friendships' AND column_name = 'addressee_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'friendships' AND column_name = 'status'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'host_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'guest_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'code'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'status'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'duration_s'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'mode'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'target_reps'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'is_bot'
  ) THEN
    RAISE EXCEPTION 'FRIEND_BATTLE_SCHEMA_MISMATCH: required friendship, profile, anonymous-account, or battle columns are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' AND tablename = 'friendships'
      AND indexname = 'friendships_one_unordered_pair_idx'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.friendships'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.battles'::regclass AND relrowsecurity
  ) OR (
    SELECT count(*) FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'battles'
      AND cmd IN ('SELECT', 'ALL')
      AND roles && ARRAY['anon', 'authenticated', 'public']::name[]
  ) <> 1 OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'battles'
      AND policyname = 'battles select participants'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'FRIEND_BATTLE_SCHEMA_MISMATCH: unordered friendship uniqueness, RLS, or participant-only battle visibility is not verified';
  END IF;
END;
$friend_battle_invitation_preflight$;

CREATE TABLE public.friend_battle_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('timed', 'first_to', 'sprint', 'endurance')),
  duration_s integer NOT NULL CHECK (duration_s BETWEEN 15 AND 600),
  target_reps integer NOT NULL CHECK (target_reps BETWEEN 0 AND 500),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  battle_id uuid REFERENCES public.battles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (pg_catalog.clock_timestamp() + interval '24 hours'),
  responded_at timestamptz,
  CONSTRAINT friend_battle_invites_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT friend_battle_invites_expiry CHECK (expires_at > created_at),
  CONSTRAINT friend_battle_invites_pending_shape CHECK (
    status <> 'pending' OR (responded_at IS NULL AND battle_id IS NULL)
  ),
  CONSTRAINT friend_battle_invites_accepted_shape CHECK (
    status <> 'accepted' OR responded_at IS NOT NULL
  ),
  CONSTRAINT friend_battle_invites_nonaccepted_no_battle CHECK (
    status = 'accepted' OR battle_id IS NULL
  )
);

CREATE UNIQUE INDEX friend_battle_invites_one_pending_pair_idx
  ON public.friend_battle_invitations (
    LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)
  ) WHERE status = 'pending';
CREATE INDEX friend_battle_invites_inbox_idx
  ON public.friend_battle_invitations (recipient_id, expires_at)
  WHERE status = 'pending';

ALTER TABLE public.friend_battle_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.friend_battle_invitations
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_friend_battle_invitation(
  p_recipient_id uuid,
  p_mode text,
  p_duration_s integer,
  p_target_reps integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  me uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_friendship_id uuid;
  v_invitation_id uuid;
BEGIN
  IF me IS NULL
    OR COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    OR NOT EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = me AND COALESCE(u.is_anonymous, false) IS FALSE
    ) THEN
    RAISE EXCEPTION 'real_account_required' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_id IS NULL OR p_recipient_id = me THEN
    RAISE EXCEPTION 'friend_battle_recipient_required';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('timed', 'first_to', 'sprint', 'endurance')
    OR p_duration_s IS NULL OR p_duration_s NOT BETWEEN 15 AND 600
    OR p_target_reps IS NULL OR p_target_reps NOT BETWEEN 0 AND 500 THEN
    RAISE EXCEPTION 'friend_battle_settings_invalid';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('friend-battle:' || LEAST(me::text, p_recipient_id::text)
      || ':' || GREATEST(me::text, p_recipient_id::text))
  );

  -- Lock the unique accepted friendship against concurrent removal until this
  -- invite has been written. The indexed unordered pair makes ambiguity fail closed.
  SELECT f.id INTO v_friendship_id
  FROM public.friendships AS f
  WHERE ((f.requester_id = me AND f.addressee_id = p_recipient_id)
      OR (f.requester_id = p_recipient_id AND f.addressee_id = me))
    AND f.status = 'accepted'
  FOR SHARE;
  IF NOT FOUND OR (
    SELECT count(*) FROM public.friendships AS f
    WHERE (f.requester_id = me AND f.addressee_id = p_recipient_id)
       OR (f.requester_id = p_recipient_id AND f.addressee_id = me)
  ) <> 1 THEN
    RAISE EXCEPTION 'accepted_friendship_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users AS u
    WHERE u.id = p_recipient_id AND COALESCE(u.is_anonymous, false) IS FALSE
  ) THEN
    RAISE EXCEPTION 'registered_friend_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.friend_battle_invitations AS i
    SET status = 'expired', responded_at = v_now
  WHERE i.status = 'pending' AND i.expires_at <= v_now
    AND LEAST(i.sender_id, i.recipient_id) = LEAST(me, p_recipient_id)
    AND GREATEST(i.sender_id, i.recipient_id) = GREATEST(me, p_recipient_id);
  IF EXISTS (
    SELECT 1 FROM public.friend_battle_invitations AS i
    WHERE i.status = 'pending'
      AND LEAST(i.sender_id, i.recipient_id) = LEAST(me, p_recipient_id)
      AND GREATEST(i.sender_id, i.recipient_id) = GREATEST(me, p_recipient_id)
  ) THEN
    RAISE EXCEPTION 'friend_battle_invitation_already_pending';
  END IF;

  INSERT INTO public.friend_battle_invitations (
    sender_id, recipient_id, mode, duration_s, target_reps, created_at, expires_at
  ) VALUES (
    me, p_recipient_id, p_mode, p_duration_s, p_target_reps,
    v_now, v_now + interval '24 hours'
  ) RETURNING id INTO v_invitation_id;
  RETURN v_invitation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_pending_battle_invitations()
RETURNS TABLE (
  invitation_id uuid,
  sender_id uuid,
  sender_display_name text,
  sender_avatar_url text,
  mode text,
  duration_s integer,
  target_reps integer,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  me uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF me IS NULL
    OR COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    OR NOT EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = me AND COALESCE(u.is_anonymous, false) IS FALSE
    ) THEN
    RAISE EXCEPTION 'real_account_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.friend_battle_invitations AS i
    SET status = 'expired', responded_at = v_now
  WHERE i.recipient_id = me AND i.status = 'pending' AND i.expires_at <= v_now;
  UPDATE public.friend_battle_invitations AS i
    SET status = 'cancelled', responded_at = v_now
  WHERE i.recipient_id = me AND i.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships AS f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = i.sender_id AND f.addressee_id = me)
          OR (f.requester_id = me AND f.addressee_id = i.sender_id))
    );

  RETURN QUERY
  SELECT i.id, i.sender_id, p.display_name, p.avatar_url,
         i.mode, i.duration_s, i.target_reps, i.created_at, i.expires_at
  FROM public.friend_battle_invitations AS i
  JOIN public.profiles AS p ON p.id = i.sender_id
  WHERE i.recipient_id = me AND i.status = 'pending' AND i.expires_at > v_now
  ORDER BY i.created_at DESC
  LIMIT 100;
END;
$function$;

-- The sender can learn only the state of invitations they created. This lets a
-- future lobby resume the waiting battle after recipient acceptance without
-- opening the invitation table or exposing an unrelated user's inbox.
CREATE OR REPLACE FUNCTION public.get_my_sent_friend_battle_invitations()
RETURNS TABLE (
  invitation_id uuid,
  recipient_id uuid,
  status text,
  battle_id uuid,
  mode text,
  created_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  me uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF me IS NULL
    OR COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    OR NOT EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = me AND COALESCE(u.is_anonymous, false) IS FALSE
    ) THEN
    RAISE EXCEPTION 'real_account_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.friend_battle_invitations AS i
    SET status = 'expired', responded_at = v_now
  WHERE i.sender_id = me AND i.status = 'pending' AND i.expires_at <= v_now;
  UPDATE public.friend_battle_invitations AS i
    SET status = 'cancelled', responded_at = v_now
  WHERE i.sender_id = me AND i.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships AS f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = me AND f.addressee_id = i.recipient_id)
          OR (f.requester_id = i.recipient_id AND f.addressee_id = me))
    );

  RETURN QUERY
  SELECT i.id, i.recipient_id, i.status, i.battle_id, i.mode,
         i.created_at, i.expires_at, i.responded_at
  FROM public.friend_battle_invitations AS i
  WHERE i.sender_id = me
  ORDER BY i.created_at DESC
  LIMIT 100;
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_friend_battle_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
RETURNS TABLE (result text, battle_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  me uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_invite public.friend_battle_invitations%ROWTYPE;
  v_friendship_id uuid;
  v_battle_id uuid;
  v_code text;
  v_attempt integer;
BEGIN
  IF me IS NULL
    OR COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    OR NOT EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = me AND COALESCE(u.is_anonymous, false) IS FALSE
    ) THEN
    RAISE EXCEPTION 'real_account_required' USING ERRCODE = '42501';
  END IF;
  IF p_invitation_id IS NULL OR p_accept IS NULL THEN RETURN; END IF;

  SELECT i.* INTO v_invite
  FROM public.friend_battle_invitations AS i
  WHERE i.id = p_invitation_id AND i.recipient_id = me
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_invite.status <> 'pending' THEN RETURN; END IF;
  IF v_invite.expires_at <= v_now THEN
    UPDATE public.friend_battle_invitations AS i
      SET status = 'expired', responded_at = v_now WHERE i.id = v_invite.id;
    RETURN QUERY SELECT 'expired'::text, NULL::uuid;
    RETURN;
  END IF;

  IF p_accept IS FALSE THEN
    UPDATE public.friend_battle_invitations AS i
      SET status = 'declined', responded_at = v_now WHERE i.id = v_invite.id;
    RETURN QUERY SELECT 'declined'::text, NULL::uuid;
    RETURN;
  END IF;

  -- A friendship removed since the invitation was sent cancels rather than starts
  -- a battle. Lock the current relationship against a concurrent removal.
  SELECT f.id INTO v_friendship_id
  FROM public.friendships AS f
  WHERE ((f.requester_id = me AND f.addressee_id = v_invite.sender_id)
      OR (f.requester_id = v_invite.sender_id AND f.addressee_id = me))
    AND f.status = 'accepted'
  FOR SHARE;
  IF NOT FOUND OR (
    SELECT count(*) FROM public.friendships AS f
    WHERE (f.requester_id = me AND f.addressee_id = v_invite.sender_id)
       OR (f.requester_id = v_invite.sender_id AND f.addressee_id = me)
  ) <> 1 THEN
    UPDATE public.friend_battle_invitations AS i
      SET status = 'cancelled', responded_at = v_now WHERE i.id = v_invite.id;
    RETURN QUERY SELECT 'cancelled'::text, NULL::uuid;
    RETURN;
  END IF;

  FOR v_attempt IN 1..5 LOOP
    v_code := pg_catalog.upper(pg_catalog.substr(
      pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8
    ));
    BEGIN
      INSERT INTO public.battles (
        code, host_id, guest_id, status, duration_s, mode, target_reps, is_bot
      ) VALUES (
        v_code, v_invite.sender_id, me, 'waiting',
        v_invite.duration_s, v_invite.mode, v_invite.target_reps, false
      ) RETURNING id INTO v_battle_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  UPDATE public.friend_battle_invitations AS i
    SET status = 'accepted', battle_id = v_battle_id, responded_at = v_now
  WHERE i.id = v_invite.id;
  RETURN QUERY SELECT 'accepted'::text, v_battle_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_my_friend_battle_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  me uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_invite public.friend_battle_invitations%ROWTYPE;
BEGIN
  IF me IS NULL
    OR COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
    OR NOT EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = me AND COALESCE(u.is_anonymous, false) IS FALSE
    ) THEN
    RAISE EXCEPTION 'real_account_required' USING ERRCODE = '42501';
  END IF;
  IF p_invitation_id IS NULL THEN RETURN false; END IF;

  SELECT i.* INTO v_invite
  FROM public.friend_battle_invitations AS i
  WHERE i.id = p_invitation_id AND i.sender_id = me
  FOR UPDATE;
  IF NOT FOUND OR v_invite.status <> 'pending' THEN RETURN false; END IF;
  IF v_invite.expires_at <= v_now THEN
    UPDATE public.friend_battle_invitations AS i
      SET status = 'expired', responded_at = v_now WHERE i.id = v_invite.id;
    RETURN false;
  END IF;

  UPDATE public.friend_battle_invitations AS i
    SET status = 'cancelled', responded_at = v_now WHERE i.id = v_invite.id;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_friend_battle_invitation(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_pending_battle_invitations()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_sent_friend_battle_invitations()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.respond_to_friend_battle_invitation(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_my_friend_battle_invitation(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_friend_battle_invitation(uuid, text, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_pending_battle_invitations()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_sent_friend_battle_invitations()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_battle_invitation(uuid, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_friend_battle_invitation(uuid)
  TO authenticated;

DO $friend_battle_invitation_postconditions$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid = 'public.friend_battle_invitations'::regclass AND c.relrowsecurity
  ) OR has_table_privilege('authenticated', 'public.friend_battle_invitations', 'SELECT')
    OR has_table_privilege('authenticated', 'public.friend_battle_invitations', 'INSERT')
    OR has_table_privilege('authenticated', 'public.friend_battle_invitations', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.friend_battle_invitations', 'DELETE')
    OR has_table_privilege('anon', 'public.friend_battle_invitations', 'SELECT')
    OR has_table_privilege('service_role', 'public.friend_battle_invitations', 'SELECT')
    OR NOT has_function_privilege('authenticated',
      'public.create_friend_battle_invitation(uuid,text,integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated',
      'public.get_my_pending_battle_invitations()', 'EXECUTE')
    OR NOT has_function_privilege('authenticated',
      'public.get_my_sent_friend_battle_invitations()', 'EXECUTE')
    OR NOT has_function_privilege('authenticated',
      'public.respond_to_friend_battle_invitation(uuid,boolean)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated',
      'public.cancel_my_friend_battle_invitation(uuid)', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.create_friend_battle_invitation(uuid,text,integer,integer)', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.get_my_pending_battle_invitations()', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.get_my_sent_friend_battle_invitations()', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.respond_to_friend_battle_invitation(uuid,boolean)', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.cancel_my_friend_battle_invitation(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FRIEND_BATTLE_POSTCONDITION_FAILED: direct access or RPC grants are not restricted to the intended contract';
  END IF;
END;
$friend_battle_invitation_postconditions$;
