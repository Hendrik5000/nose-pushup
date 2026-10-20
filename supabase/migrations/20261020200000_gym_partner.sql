-- Two-person gym sessions. Every read and mutation is through caller-JWT RPCs;
-- the browser role never receives direct table privileges.
CREATE TABLE public.gym_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A deleted host must never cascade-delete the surviving partner's history.
  host_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','closed')),
  invite_code text UNIQUE,
  invite_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK (host_id IS NOT NULL OR status = 'closed'),
  CHECK ((status = 'closed') OR closed_at IS NULL),
  CHECK (invite_code IS NULL OR (status = 'waiting' AND invite_expires_at IS NOT NULL))
);

CREATE TABLE public.gym_memberships (
  session_id uuid NOT NULL REFERENCES public.gym_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias text NOT NULL CHECK (char_length(alias) BETWEEN 1 AND 40 AND alias !~ '[[:cntrl:]]'),
  sharing boolean NOT NULL DEFAULT false,
  visit_share_counts boolean NOT NULL DEFAULT false,
  visit_share_days boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- This small lock table expresses the cross-session invariant: one open session
-- per auth account. RPCs serialize on the account advisory lock before changing it.
CREATE TABLE public.gym_active_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.gym_sessions(id) ON DELETE CASCADE,
  UNIQUE (session_id, user_id),
  FOREIGN KEY (session_id, user_id)
    REFERENCES public.gym_memberships(session_id, user_id) ON DELETE CASCADE
);

CREATE TABLE public.gym_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  exercise text NOT NULL CHECK (char_length(exercise) BETWEEN 1 AND 80 AND exercise !~ '[[:cntrl:]]'),
  reps integer NOT NULL CHECK (reps BETWEEN 1 AND 1000),
  weight_kg numeric(9,3) NOT NULL CHECK (
    weight_kg BETWEEN 0 AND 1000 AND weight_kg * 4 = trunc(weight_kg * 4)
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, user_id)
    REFERENCES public.gym_memberships(session_id, user_id) ON DELETE CASCADE
);
CREATE INDEX gym_sets_session_user_created_idx ON public.gym_sets(session_id, user_id, created_at, id);
CREATE INDEX gym_memberships_user_joined_idx ON public.gym_memberships(user_id, joined_at DESC);

-- Personal attendance calendar, independent of sessions and sharing.
CREATE TABLE public.gym_visits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL CHECK (day >= DATE '2000-01-01'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.gym_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_active_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_visits ENABLE ROW LEVEL SECURITY;
-- No direct SELECT/INSERT/UPDATE/DELETE policy exists. SECURITY DEFINER RPCs
-- below are the only supported access path; no browser role can bypass them.
REVOKE ALL ON TABLE public.gym_sessions, public.gym_memberships,
  public.gym_active_memberships, public.gym_sets, public.gym_visits FROM PUBLIC, anon, authenticated;

-- Runs before auth FK cascades, in the deleting transaction. Preserve each
-- survivor's own sets/membership/calendar, but end the relationship completely.
-- The deleted account's membership, sets and visits are then removed by FKs.
-- No account ID or alias is copied into the retained session/history.
CREATE OR REPLACE FUNCTION public.gym_detach_deleted_account()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE affected_session uuid;
BEGIN
  -- Match the session locks used by RPCs; deterministic order for old histories.
  FOR affected_session IN
    SELECT s.id FROM public.gym_sessions s
    WHERE s.host_id = OLD.id OR EXISTS (
      SELECT 1 FROM public.gym_memberships m
      WHERE m.session_id = s.id AND m.user_id = OLD.id
    )
    ORDER BY s.id FOR UPDATE OF s
  LOOP
    UPDATE public.gym_sessions
      SET status = 'closed', invite_code = NULL, invite_expires_at = NULL,
        closed_at = coalesce(closed_at, clock_timestamp()),
        host_id = CASE WHEN host_id = OLD.id THEN NULL ELSE host_id END
      WHERE id = affected_session;
    UPDATE public.gym_memberships
      SET sharing = false, visit_share_counts = false, visit_share_days = false
      WHERE session_id = affected_session;
    DELETE FROM public.gym_active_memberships WHERE session_id = affected_session;
  END LOOP;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.gym_detach_deleted_account() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER gym_detach_account_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.gym_detach_deleted_account();

CREATE OR REPLACE FUNCTION public.gym_snapshot_payload(
  p_session_id uuid, p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  me uuid := auth.uid();
  s public.gym_sessions%ROWTYPE;
  mine public.gym_memberships%ROWTYPE;
  partner public.gym_memberships%ROWTYPE;
  partner_id uuid;
  own_sets jsonb;
  partner_stats jsonb;
  partner_visit_stats jsonb;
  partner_visit_days jsonb;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_today IS NULL OR p_today < CURRENT_DATE - 1 OR p_today > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'invalid_snapshot_date';
  END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND OR s.status NOT IN ('waiting','active') THEN RETURN NULL; END IF;
  SELECT * INTO mine FROM public.gym_memberships WHERE session_id = s.id AND user_id = me;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_session_member'; END IF;
  SELECT m.user_id INTO partner_id FROM public.gym_memberships m
    WHERE m.session_id = s.id AND m.user_id <> me LIMIT 1;
  IF partner_id IS NOT NULL THEN
    SELECT * INTO partner FROM public.gym_memberships WHERE session_id = s.id AND user_id = partner_id;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'exercise', x.exercise, 'reps', x.reps,
      'weightKg', x.weight_kg, 'createdAt', x.created_at
    ) ORDER BY x.created_at, x.id), '[]'::jsonb)
    INTO own_sets FROM public.gym_sets x WHERE x.session_id = s.id AND x.user_id = me;
  IF partner_id IS NOT NULL AND partner.sharing THEN
    SELECT jsonb_build_object(
      'sets', count(*), 'reps', coalesce(sum(x.reps), 0),
      'volumeKg', coalesce(sum(x.reps * x.weight_kg), 0)
    ) INTO partner_stats FROM public.gym_sets x
      WHERE x.session_id = s.id AND x.user_id = partner_id;
  END IF;
  IF partner_id IS NOT NULL AND partner.visit_share_counts THEN
    SELECT jsonb_build_object(
      'weekDays', count(*) FILTER (WHERE v.day BETWEEN
        date_trunc('week', p_today::timestamp)::date AND
        (date_trunc('week', p_today::timestamp)::date + 6)),
      'monthDays', count(*) FILTER (WHERE v.day >= date_trunc('month', p_today::timestamp)::date
        AND v.day < (date_trunc('month', p_today::timestamp)::date + interval '1 month')::date)
    ) INTO partner_visit_stats FROM public.gym_visits v
      WHERE v.user_id = partner_id;
  END IF;
  IF partner_id IS NOT NULL AND partner.visit_share_days THEN
    SELECT coalesce(jsonb_agg(to_char(v.day, 'YYYY-MM-DD') ORDER BY v.day), '[]'::jsonb)
      INTO partner_visit_days FROM public.gym_visits v
      WHERE v.user_id = partner_id
        AND v.day >= date_trunc('month', p_today::timestamp)::date
        AND v.day < (date_trunc('month', p_today::timestamp)::date + interval '1 month')::date;
  END IF;
  RETURN jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'inviteCode', CASE WHEN s.host_id = me AND s.status = 'waiting'
      AND s.invite_expires_at > clock_timestamp() THEN s.invite_code ELSE NULL END,
    'inviteExpiresAt', CASE WHEN s.host_id = me AND s.status = 'waiting'
      AND s.invite_expires_at > clock_timestamp() THEN s.invite_expires_at ELSE NULL END,
    'own', jsonb_build_object('userId', me, 'alias', mine.alias,
      'sharing', mine.sharing, 'sets', own_sets,
      'visitSharing', jsonb_build_object('counts', mine.visit_share_counts, 'days', mine.visit_share_days)),
    'partner', CASE WHEN partner_id IS NULL THEN NULL ELSE jsonb_build_object(
      'alias', partner.alias, 'sharing', partner.sharing,
      'stats', CASE WHEN partner.sharing THEN partner_stats ELSE NULL END,
      'visitSharing', jsonb_build_object('counts', partner.visit_share_counts, 'days', partner.visit_share_days),
      'visitStats', CASE WHEN partner.visit_share_counts THEN partner_visit_stats ELSE NULL END,
      'visitDays', CASE WHEN partner.visit_share_days THEN partner_visit_days ELSE NULL END
    ) END
  );
END $$;

CREATE OR REPLACE FUNCTION public.gym_create_session(p_alias text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  me uuid := auth.uid();
  existing_session uuid;
  code text;
  new_session uuid;
  expires_at timestamptz := clock_timestamp() + interval '15 minutes';
  attempt integer;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_alias IS NULL OR char_length(btrim(p_alias)) NOT BETWEEN 1 AND 40
    OR btrim(p_alias) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_alias'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(me::text));
  SELECT session_id INTO existing_session FROM public.gym_active_memberships WHERE user_id = me;
  IF existing_session IS NOT NULL THEN
    -- An expired, unjoined invite is retired here so this account can start over.
    UPDATE public.gym_sessions SET status = 'closed', invite_code = NULL,
      invite_expires_at = NULL, closed_at = clock_timestamp()
      WHERE id = existing_session AND status = 'waiting' AND invite_expires_at <= clock_timestamp();
    IF FOUND THEN
      UPDATE public.gym_memberships SET sharing = false, visit_share_counts = false,
        visit_share_days = false WHERE session_id = existing_session;
      DELETE FROM public.gym_active_memberships WHERE session_id = existing_session;
    ELSE RAISE EXCEPTION 'active_session_exists'; END IF;
  END IF;
  FOR attempt IN 1..8 LOOP
    -- UUID randomness is generated by PostgreSQL's cryptographic OS-backed RNG.
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    new_session := gen_random_uuid();
    INSERT INTO public.gym_sessions(id, host_id, invite_code, invite_expires_at)
      VALUES (new_session, me, code, expires_at)
      ON CONFLICT (invite_code) DO NOTHING;
    IF FOUND THEN EXIT; END IF;
    new_session := NULL;
  END LOOP;
  IF new_session IS NULL THEN RAISE EXCEPTION 'invite_generation_failed'; END IF;
  INSERT INTO public.gym_memberships(session_id, user_id, alias)
    VALUES (new_session, me, btrim(p_alias));
  INSERT INTO public.gym_active_memberships(user_id, session_id) VALUES (me, new_session);
  RETURN public.gym_snapshot_payload(new_session);
END $$;

CREATE OR REPLACE FUNCTION public.gym_join_session(p_code text, p_alias text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  me uuid := auth.uid();
  s public.gym_sessions%ROWTYPE;
  member_count integer;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_alias IS NULL OR char_length(btrim(p_alias)) NOT BETWEEN 1 AND 40
    OR btrim(p_alias) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_alias'; END IF;
  IF p_code IS NULL OR upper(btrim(p_code)) !~ '^[0-9A-F]{12}$' THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(me::text));
  SELECT * INTO s FROM public.gym_sessions
    WHERE invite_code = upper(btrim(p_code)) FOR UPDATE;
  IF NOT FOUND OR s.status <> 'waiting' OR s.invite_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'invite_unavailable';
  END IF;
  IF s.host_id = me THEN RAISE EXCEPTION 'host_cannot_join_own_session'; END IF;
  IF EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE user_id = me) THEN
    RAISE EXCEPTION 'active_session_exists';
  END IF;
  SELECT count(*) INTO member_count FROM public.gym_memberships WHERE session_id = s.id;
  IF member_count >= 2 THEN RAISE EXCEPTION 'session_full'; END IF;
  INSERT INTO public.gym_memberships(session_id, user_id, alias)
    VALUES (s.id, me, btrim(p_alias));
  INSERT INTO public.gym_active_memberships(user_id, session_id) VALUES (me, s.id);
  UPDATE public.gym_sessions SET status = 'active', invite_code = NULL,
    invite_expires_at = NULL WHERE id = s.id;
  RETURN public.gym_snapshot_payload(s.id);
END $$;

CREATE OR REPLACE FUNCTION public.gym_get_snapshot(p_today date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); v_session_id uuid; s public.gym_sessions%ROWTYPE;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_today IS NULL OR p_today < CURRENT_DATE - 1 OR p_today > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'invalid_snapshot_date';
  END IF;
  SELECT a.session_id INTO v_session_id FROM public.gym_active_memberships a WHERE a.user_id = me;
  IF v_session_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id = v_session_id FOR UPDATE;
  IF s.status = 'waiting' AND s.invite_expires_at <= clock_timestamp() THEN
    UPDATE public.gym_sessions SET status = 'closed', invite_code = NULL,
      invite_expires_at = NULL, closed_at = clock_timestamp() WHERE id = v_session_id;
    UPDATE public.gym_memberships SET sharing = false,
      visit_share_counts = false, visit_share_days = false WHERE session_id = v_session_id;
    DELETE FROM public.gym_active_memberships a WHERE a.session_id = v_session_id;
    RETURN NULL;
  END IF;
  RETURN public.gym_snapshot_payload(v_session_id, p_today);
END $$;

CREATE OR REPLACE FUNCTION public.gym_set_sharing(p_session_id uuid, p_share boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); s public.gym_sessions%ROWTYPE;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_share IS NULL THEN RAISE EXCEPTION 'invalid_sharing_consent'; END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.status NOT IN ('waiting','active') OR NOT EXISTS (
      SELECT 1 FROM public.gym_memberships WHERE session_id = p_session_id AND user_id = me
    ) THEN RAISE EXCEPTION 'not_open_session_member'; END IF;
  UPDATE public.gym_memberships SET sharing = p_share
    WHERE session_id = p_session_id AND user_id = me;
END $$;

CREATE OR REPLACE FUNCTION public.gym_set_visit_sharing(
  p_session_id uuid, p_counts boolean, p_days boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); s public.gym_sessions%ROWTYPE;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_counts IS NULL OR p_days IS NULL THEN RAISE EXCEPTION 'invalid_visit_sharing_consent'; END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.status NOT IN ('waiting','active') OR NOT EXISTS (
      SELECT 1 FROM public.gym_memberships WHERE session_id = p_session_id AND user_id = me
    ) THEN RAISE EXCEPTION 'not_open_session_member'; END IF;
  UPDATE public.gym_memberships SET visit_share_counts = p_counts, visit_share_days = p_days
    WHERE session_id = p_session_id AND user_id = me;
END $$;

CREATE OR REPLACE FUNCTION public.gym_add_set(
  p_session_id uuid, p_exercise text, p_reps integer, p_weight_kg numeric,
  p_visit_day date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); s public.gym_sessions%ROWTYPE;
  entry public.gym_sets%ROWTYPE; own_set_count integer;
  effective_day date := coalesce(p_visit_day, CURRENT_DATE);
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_exercise IS NULL OR char_length(btrim(p_exercise)) NOT BETWEEN 1 AND 80
    OR btrim(p_exercise) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_exercise'; END IF;
  IF p_reps IS NULL OR p_reps NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid_reps'; END IF;
  IF p_weight_kg IS NULL OR p_weight_kg NOT BETWEEN 0 AND 1000
    OR p_weight_kg * 4 <> trunc(p_weight_kg * 4) THEN RAISE EXCEPTION 'invalid_weight_kg'; END IF;
  IF effective_day < CURRENT_DATE - 1 OR effective_day > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'invalid_visit_date';
  END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'active' OR NOT EXISTS (
      SELECT 1 FROM public.gym_memberships WHERE session_id = p_session_id AND user_id = me
    ) THEN RAISE EXCEPTION 'not_active_session_member'; END IF;
  SELECT count(*) INTO own_set_count FROM public.gym_sets
    WHERE session_id = p_session_id AND user_id = me;
  IF own_set_count >= 500 THEN RAISE EXCEPTION 'session_set_limit'; END IF;
  INSERT INTO public.gym_sets(session_id, user_id, exercise, reps, weight_kg)
    VALUES (p_session_id, me, btrim(p_exercise), p_reps, p_weight_kg) RETURNING * INTO entry;
  INSERT INTO public.gym_visits(user_id, day) VALUES (me, effective_day) ON CONFLICT (user_id, day) DO NOTHING;
  RETURN jsonb_build_object('id', entry.id, 'exercise', entry.exercise,
    'reps', entry.reps, 'weightKg', entry.weight_kg, 'createdAt', entry.created_at);
END $$;

CREATE OR REPLACE FUNCTION public.gym_delete_set(p_session_id uuid, p_set_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); s public.gym_sessions%ROWTYPE;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.status = 'closed' OR NOT EXISTS (SELECT 1 FROM public.gym_memberships
      WHERE session_id = p_session_id AND user_id = me) THEN RAISE EXCEPTION 'not_session_member'; END IF;
  DELETE FROM public.gym_sets WHERE id = p_set_id AND session_id = p_session_id AND user_id = me;
END $$;

CREATE OR REPLACE FUNCTION public.gym_close_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); s public.gym_sessions%ROWTYPE;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.gym_memberships
      WHERE session_id = p_session_id AND user_id = me) THEN RAISE EXCEPTION 'not_session_member'; END IF;
  IF s.status <> 'closed' THEN
    UPDATE public.gym_sessions SET status = 'closed', invite_code = NULL,
      invite_expires_at = NULL, closed_at = clock_timestamp() WHERE id = p_session_id;
    UPDATE public.gym_memberships SET sharing = false, visit_share_counts = false,
      visit_share_days = false WHERE session_id = p_session_id;
    DELETE FROM public.gym_active_memberships WHERE session_id = p_session_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gym_get_visits(p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); result jsonb;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start < DATE '2000-01-01'
    OR p_end < DATE '2000-01-01' OR p_end < p_start OR p_end - p_start > 365 THEN
    RAISE EXCEPTION 'invalid_visit_range';
  END IF;
  SELECT coalesce(jsonb_agg(to_char(v.day, 'YYYY-MM-DD') ORDER BY v.day), '[]'::jsonb)
    INTO result FROM public.gym_visits v
    WHERE v.user_id = me AND v.day BETWEEN p_start AND p_end;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.gym_set_visit(p_day date, p_attended boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  IF p_day IS NULL OR p_day < DATE '2000-01-01' OR p_day > CURRENT_DATE + 1
    OR p_attended IS NULL THEN RAISE EXCEPTION 'invalid_visit'; END IF;
  IF p_attended THEN
    INSERT INTO public.gym_visits(user_id, day) VALUES (me, p_day) ON CONFLICT (user_id, day) DO NOTHING;
  ELSE
    DELETE FROM public.gym_visits WHERE user_id = me AND day = p_day;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gym_get_history()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE me uuid := auth.uid(); result jsonb;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean THEN
    RAISE EXCEPTION 'real_account_required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'sessionId', h.session_id, 'exercise', h.exercise,
      'reps', h.reps, 'weightKg', h.weight_kg, 'createdAt', h.created_at
    ) ORDER BY h.created_at DESC, h.id DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT x.id, x.session_id, x.exercise, x.reps, x.weight_kg, x.created_at
    FROM public.gym_sets x
    JOIN public.gym_sessions s ON s.id = x.session_id AND s.status = 'closed'
    WHERE x.user_id = me
    ORDER BY x.created_at DESC, x.id DESC
    LIMIT 500
  ) h;
  RETURN result;
END $$;

-- Internal serializer is callable only by these owner's RPCs, never by clients.
REVOKE ALL ON FUNCTION public.gym_snapshot_payload(uuid,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_create_session(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_join_session(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_get_snapshot(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_set_sharing(uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_set_visit_sharing(uuid,boolean,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_add_set(uuid,text,integer,numeric,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_delete_set(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_close_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_get_visits(date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_set_visit(date,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gym_get_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gym_create_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_join_session(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_get_snapshot(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_set_sharing(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_set_visit_sharing(uuid,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_add_set(uuid,text,integer,numeric,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_delete_set(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_close_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_get_visits(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_set_visit(date,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_get_history() TO authenticated;
