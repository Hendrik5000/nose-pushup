-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
--
-- Friend codes + Postfach (in-app inbox).
--
--  * Every registered user has a private friend code (8 characters, no
--    ambiguous characters). Entering a code only creates a PENDING request;
--    the other person must accept it in their Postfach.
--  * Friendships can no longer be created or accepted by direct table writes:
--    clients must use the RPCs below (closes: self-inserted "accepted" rows and
--    rewriting requester/addressee on UPDATE).
--  * public.postfach_items is the single inbox: friend requests, accepted
--    notices, battle invitations, missed calls. Rows are written only by
--    SECURITY DEFINER triggers/functions, never by clients.
--
-- Requires: 20261026090000_friendships_unordered_pair_index.sql.
-- Optional bridge to friend battle invitations: see postfach_install_battle_bridge().

DO $friend_codes_preflight$
BEGIN
  IF pg_catalog.to_regclass('auth.users') IS NULL
    OR pg_catalog.to_regclass('public.profiles') IS NULL
    OR pg_catalog.to_regclass('public.friendships') IS NULL THEN
    RAISE EXCEPTION 'FRIEND_CODES_SCHEMA_MISMATCH: auth.users, public.profiles or public.friendships missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' AND tablename = 'friendships'
      AND indexname = 'friendships_one_unordered_pair_idx'
  ) THEN
    RAISE EXCEPTION 'FRIEND_CODES_SCHEMA_MISMATCH: apply 20261026090000_friendships_unordered_pair_index.sql first';
  END IF;
END;
$friend_codes_preflight$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True only for a signed-in, non-anonymous account.
CREATE OR REPLACE FUNCTION public.is_registered_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

REVOKE ALL ON FUNCTION public.is_registered_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_registered_user() TO authenticated;

-- Random 8-character code from an alphabet without I, L, O, 0, 1 (31 symbols).
-- Rejection sampling avoids modulo bias.
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public
AS $$
DECLARE
  alphabet CONSTANT text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  result text := '';
  b integer;
  i integer;
BEGIN
  WHILE pg_catalog.length(result) < 8 LOOP
    bytes := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    FOR i IN 0..15 LOOP
      -- bytes 6 and 8 carry fixed UUID version/variant bits
      CONTINUE WHEN i IN (6, 8);
      b := pg_catalog.get_byte(bytes, i);
      CONTINUE WHEN b >= 248;
      result := result || pg_catalog.substr(alphabet, (b % 31) + 1, 1);
      EXIT WHEN pg_catalog.length(result) = 8;
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_friend_code() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Friend codes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friend_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  CONSTRAINT friend_codes_format CHECK (code ~ '^[A-HJ-KM-NP-Z2-9]{8}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_codes_code_idx ON public.friend_codes (code);

ALTER TABLE public.friend_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friend_codes FROM PUBLIC, anon, authenticated;

-- Failed lookups are counted so codes cannot be guessed in bulk.
CREATE TABLE IF NOT EXISTS public.friend_code_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS friend_code_attempts_user_idx
  ON public.friend_code_attempts (user_id, attempted_at DESC);

ALTER TABLE public.friend_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friend_code_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_friend_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  existing text;
  attempt integer := 0;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;

  SELECT code INTO existing FROM public.friend_codes WHERE user_id = me;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  LOOP
    attempt := attempt + 1;
    BEGIN
      INSERT INTO public.friend_codes (user_id, code)
      VALUES (me, public.generate_friend_code())
      ON CONFLICT (user_id) DO NOTHING;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt >= 8 THEN RAISE; END IF;
    END;
  END LOOP;

  SELECT code INTO existing FROM public.friend_codes WHERE user_id = me;
  RETURN existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_my_friend_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  fresh text;
  attempt integer := 0;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.get_my_friend_code();

  LOOP
    attempt := attempt + 1;
    fresh := public.generate_friend_code();
    BEGIN
      UPDATE public.friend_codes
      SET code = fresh, rotated_at = now()
      WHERE user_id = me;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt >= 8 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN fresh;
END;
$$;

-- ---------------------------------------------------------------------------
-- Friendship hardening: no direct client INSERT/UPDATE any more.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users send friend requests" ON public.friendships;
DROP POLICY IF EXISTS "Addressee updates status" ON public.friendships;
REVOKE INSERT, UPDATE ON public.friendships FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.friendships_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.requester_id = NEW.addressee_id THEN
    RAISE EXCEPTION 'friendship_self_not_allowed' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'friendship_must_start_pending' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
      OR NEW.addressee_id IS DISTINCT FROM OLD.addressee_id THEN
      RAISE EXCEPTION 'friendship_parties_immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'accepted' AND OLD.status NOT IN ('pending', 'accepted') THEN
      RAISE EXCEPTION 'friendship_accept_requires_pending' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friendships_guard_trg ON public.friendships;
CREATE TRIGGER friendships_guard_trg
  BEFORE INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_guard();

-- ---------------------------------------------------------------------------
-- Postfach
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.postfach_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'friend_request', 'friend_accepted', 'battle_invitation', 'battle_accepted', 'missed_call'
  )),
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ref_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  resolved_at timestamptz,
  resolution text CHECK (resolution IS NULL OR resolution IN (
    'accepted', 'declined', 'cancelled', 'expired', 'blocked'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS postfach_items_unique_ref_idx
  ON public.postfach_items (user_id, kind, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS postfach_items_user_created_idx
  ON public.postfach_items (user_id, created_at DESC);

ALTER TABLE public.postfach_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS postfach_items_select_own ON public.postfach_items;
CREATE POLICY postfach_items_select_own ON public.postfach_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS postfach_items_update_own ON public.postfach_items;
CREATE POLICY postfach_items_update_own ON public.postfach_items
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS postfach_items_delete_own ON public.postfach_items;
CREATE POLICY postfach_items_delete_own ON public.postfach_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.postfach_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.postfach_items TO authenticated;
-- Clients may only mark an item as read; everything else is written by triggers.
GRANT UPDATE (read_at) ON public.postfach_items TO authenticated;

CREATE OR REPLACE FUNCTION public.postfach_push(
  p_user uuid,
  p_kind text,
  p_from uuid,
  p_ref uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  INSERT INTO public.postfach_items (user_id, kind, from_user_id, ref_id, payload)
  VALUES (p_user, p_kind, p_from, p_ref, COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (user_id, kind, ref_id) WHERE ref_id IS NOT NULL DO NOTHING
$$;

REVOKE ALL ON FUNCTION public.postfach_push(uuid, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.postfach_resolve(
  p_user uuid,
  p_kind text,
  p_ref uuid,
  p_resolution text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.postfach_items
  SET resolved_at = now(),
      resolution = p_resolution,
      read_at = COALESCE(read_at, now())
  WHERE user_id = p_user AND kind = p_kind AND ref_id = p_ref AND resolved_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.postfach_resolve(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Friendship lifecycle -> Postfach.
CREATE OR REPLACE FUNCTION public.friendships_postfach_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  who_name text;
  who_avatar text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      SELECT display_name, avatar_url INTO who_name, who_avatar
      FROM public.profiles WHERE id = NEW.requester_id;
      PERFORM public.postfach_push(
        NEW.addressee_id, 'friend_request', NEW.requester_id, NEW.id,
        jsonb_build_object(
          'from_name', COALESCE(NULLIF(pg_catalog.btrim(who_name), ''), 'Neuer Kontakt'),
          'from_avatar_url', who_avatar
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status <> 'pending' THEN
      PERFORM public.postfach_resolve(
        NEW.addressee_id, 'friend_request', NEW.id,
        CASE WHEN NEW.status = 'accepted' THEN 'accepted'
             WHEN NEW.status = 'blocked' THEN 'blocked'
             ELSE 'declined' END
      );
      IF NEW.status = 'accepted' THEN
        SELECT display_name, avatar_url INTO who_name, who_avatar
        FROM public.profiles WHERE id = NEW.addressee_id;
        PERFORM public.postfach_push(
          NEW.requester_id, 'friend_accepted', NEW.addressee_id, NEW.id,
          jsonb_build_object(
            'from_name', COALESCE(NULLIF(pg_catalog.btrim(who_name), ''), 'Neuer Freund'),
            'from_avatar_url', who_avatar
          )
        );
      END IF;
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.postfach_resolve(OLD.addressee_id, 'friend_request', OLD.id, 'cancelled');
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.friendships_postfach_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS friendships_postfach_sync_trg ON public.friendships;
CREATE TRIGGER friendships_postfach_sync_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_postfach_sync();

-- ---------------------------------------------------------------------------
-- Friend request RPCs
-- ---------------------------------------------------------------------------

-- Returns jsonb {status: ...}. Expected outcomes are returned (not raised) so
-- that failed-attempt counting is not rolled back with the transaction.
--   sent | already_friends | already_sent | incoming_pending | own_code |
--   invalid_code | too_many_attempts | too_many_pending | unavailable
CREATE OR REPLACE FUNCTION public.send_friend_request_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  norm text;
  owner uuid;
  existing public.friendships%ROWTYPE;
  failures integer;
  pending_out integer;
  new_id uuid;
  owner_name text;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.friend_code_attempts
  WHERE user_id = me AND attempted_at < now() - interval '2 days';

  SELECT count(*) INTO failures
  FROM public.friend_code_attempts
  WHERE user_id = me AND NOT succeeded AND attempted_at > now() - interval '1 hour';
  IF failures >= 10 THEN
    RETURN jsonb_build_object('status', 'too_many_attempts');
  END IF;

  norm := pg_catalog.upper(pg_catalog.regexp_replace(COALESCE(p_code, ''), '[\s\-]', '', 'g'));
  IF norm !~ '^[A-HJ-KM-NP-Z2-9]{8}$' THEN
    INSERT INTO public.friend_code_attempts (user_id, succeeded) VALUES (me, false);
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  SELECT user_id INTO owner FROM public.friend_codes WHERE code = norm;
  IF owner IS NULL THEN
    INSERT INTO public.friend_code_attempts (user_id, succeeded) VALUES (me, false);
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;
  IF owner = me THEN
    RETURN jsonb_build_object('status', 'own_code');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(LEAST(me, owner)::text || GREATEST(me, owner)::text, 0)
  );

  SELECT * INTO existing
  FROM public.friendships
  WHERE (requester_id = me AND addressee_id = owner)
     OR (requester_id = owner AND addressee_id = me);

  IF FOUND THEN
    IF existing.status = 'accepted' THEN
      RETURN jsonb_build_object('status', 'already_friends', 'friendship_id', existing.id);
    ELSIF existing.status = 'pending' THEN
      IF existing.requester_id = me THEN
        RETURN jsonb_build_object('status', 'already_sent', 'friendship_id', existing.id);
      END IF;
      RETURN jsonb_build_object('status', 'incoming_pending', 'friendship_id', existing.id);
    ELSIF existing.status = 'blocked' THEN
      RETURN jsonb_build_object('status', 'unavailable');
    ELSIF existing.status = 'declined' THEN
      -- 7 day cool-down after being declined; the decliner may always re-invite.
      IF existing.requester_id = me AND existing.updated_at > now() - interval '7 days' THEN
        RETURN jsonb_build_object('status', 'unavailable');
      END IF;
      DELETE FROM public.friendships WHERE id = existing.id;
    END IF;
  END IF;

  SELECT count(*) INTO pending_out
  FROM public.friendships WHERE requester_id = me AND status = 'pending';
  IF pending_out >= 30 THEN
    RETURN jsonb_build_object('status', 'too_many_pending');
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (me, owner, 'pending')
  RETURNING id INTO new_id;

  INSERT INTO public.friend_code_attempts (user_id, succeeded) VALUES (me, true);

  SELECT display_name INTO owner_name FROM public.profiles WHERE id = owner;
  RETURN jsonb_build_object(
    'status', 'sent',
    'friendship_id', new_id,
    'to_name', COALESCE(NULLIF(pg_catalog.btrim(owner_name), ''), 'deinem Freund')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_friend_request(p_friendship_id uuid, p_accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  new_status text;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;

  new_status := CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
  UPDATE public.friendships
  SET status = new_status, updated_at = now()
  WHERE id = p_friendship_id AND addressee_id = me AND status = 'pending';

  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  RETURN new_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_friend_request(p_friendship_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.friendships
  WHERE id = p_friendship_id AND requester_id = me AND status = 'pending';
  RETURN FOUND;
END;
$$;

-- Outgoing pending requests with the addressee's name (not readable via RLS
-- until the request is accepted).
CREATE OR REPLACE FUNCTION public.get_my_sent_friend_requests()
RETURNS TABLE (friendship_id uuid, to_user_id uuid, to_name text, to_avatar_url text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT f.id, f.addressee_id, COALESCE(NULLIF(pg_catalog.btrim(p.display_name), ''), 'Kontakt'),
         p.avatar_url, f.created_at
  FROM public.friendships f
  LEFT JOIN public.profiles p ON p.id = f.addressee_id
  WHERE f.requester_id = auth.uid() AND f.status = 'pending'
  ORDER BY f.created_at DESC
$$;

REVOKE ALL ON FUNCTION
  public.get_my_friend_code(),
  public.regenerate_my_friend_code(),
  public.send_friend_request_by_code(text),
  public.respond_to_friend_request(uuid, boolean),
  public.withdraw_friend_request(uuid),
  public.get_my_sent_friend_requests()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.get_my_friend_code(),
  public.regenerate_my_friend_code(),
  public.send_friend_request_by_code(text),
  public.respond_to_friend_request(uuid, boolean),
  public.withdraw_friend_request(uuid),
  public.get_my_sent_friend_requests()
TO authenticated;

-- ---------------------------------------------------------------------------
-- Optional bridge: friend battle invitations -> Postfach.
-- The trigger function is table-agnostic; only CREATE TRIGGER needs the table.
-- If 20261026093000_friend_battle_invitations.sql is applied later, run
--   SELECT public.postfach_install_battle_bridge();
-- once afterwards.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.battle_invitations_postfach_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  who_name text;
  who_avatar text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      SELECT display_name, avatar_url INTO who_name, who_avatar
      FROM public.profiles WHERE id = NEW.sender_id;
      PERFORM public.postfach_push(
        NEW.recipient_id, 'battle_invitation', NEW.sender_id, NEW.id,
        jsonb_build_object(
          'from_name', COALESCE(NULLIF(pg_catalog.btrim(who_name), ''), 'Freund'),
          'from_avatar_url', who_avatar,
          'mode', NEW.mode,
          'duration_s', NEW.duration_s,
          'target_reps', NEW.target_reps,
          'expires_at', NEW.expires_at
        )
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    PERFORM public.postfach_resolve(
      NEW.recipient_id, 'battle_invitation', NEW.id,
      CASE NEW.status WHEN 'accepted' THEN 'accepted' WHEN 'declined' THEN 'declined'
                      WHEN 'expired' THEN 'expired' ELSE 'cancelled' END
    );
    IF NEW.status = 'accepted' THEN
      SELECT display_name, avatar_url INTO who_name, who_avatar
      FROM public.profiles WHERE id = NEW.recipient_id;
      PERFORM public.postfach_push(
        NEW.sender_id, 'battle_accepted', NEW.recipient_id, NEW.id,
        jsonb_build_object(
          'from_name', COALESCE(NULLIF(pg_catalog.btrim(who_name), ''), 'Freund'),
          'from_avatar_url', who_avatar,
          'mode', NEW.mode,
          'battle_id', NEW.battle_id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.battle_invitations_postfach_sync() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.postfach_install_battle_bridge()
RETURNS text
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF pg_catalog.to_regclass('public.friend_battle_invitations') IS NULL THEN
    RETURN 'skipped: public.friend_battle_invitations does not exist yet';
  END IF;
  DROP TRIGGER IF EXISTS battle_invitations_postfach_sync_trg ON public.friend_battle_invitations;
  CREATE TRIGGER battle_invitations_postfach_sync_trg
    AFTER INSERT OR UPDATE ON public.friend_battle_invitations
    FOR EACH ROW EXECUTE FUNCTION public.battle_invitations_postfach_sync();
  RETURN 'installed';
END;
$$;

REVOKE ALL ON FUNCTION public.postfach_install_battle_bridge() FROM PUBLIC, anon, authenticated;

SELECT public.postfach_install_battle_bridge();

-- ---------------------------------------------------------------------------
-- Realtime (only when the standard Supabase publication exists)
-- ---------------------------------------------------------------------------

DO $postfach_realtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'postfach_items'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.postfach_items;
  END IF;
END;
$postfach_realtime$;
