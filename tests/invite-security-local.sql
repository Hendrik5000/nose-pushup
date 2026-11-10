-- Synthetic-only contract for the battle/club invite security candidate.
-- Run only through invite-security-local-db.sh against its fresh socket-only PG16 cluster.
\set ON_ERROR_STOP on
\if :{?candidate_path}
\else
  \echo 'candidate_path is required; refusing to run the security fixture without a candidate'
  \quit 2
\endif

-- Minimal fixture: current pre-payload policies/grants reproduced from tracked
-- history; friend invitation RPCs are loaded unmodified from their tracked migration.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  is_anonymous boolean NOT NULL DEFAULT false,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}')
$$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  level integer NOT NULL DEFAULT 0,
  best_count integer NOT NULL DEFAULT 0,
  battle_wins integer NOT NULL DEFAULT 0,
  battle_losses integer NOT NULL DEFAULT 0,
  battle_rating integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX friendships_one_unordered_pair_idx
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Historical public.battles columns and participant/guest policies, with the
-- later column-level guest_id grant and participant-only SELECT correction.
CREATE TABLE public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished','cancelled')),
  duration_s integer NOT NULL DEFAULT 60,
  started_at timestamptz,
  ends_at timestamptz,
  host_count integer NOT NULL DEFAULT 0,
  guest_count integer NOT NULL DEFAULT 0,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_bot boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'timed' CHECK (mode IN ('timed','first_to','sprint','endurance')),
  target_reps integer NOT NULL DEFAULT 0,
  rematch_of uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.battles TO authenticated;
GRANT ALL ON public.battles TO service_role;
REVOKE UPDATE ON public.battles FROM authenticated;
GRANT UPDATE (guest_id) ON public.battles TO authenticated;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battles select participants" ON public.battles
  FOR SELECT TO authenticated USING (auth.uid() = host_id OR auth.uid() = guest_id);
CREATE POLICY "battles insert as host" ON public.battles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "battles join as guest" ON public.battles
  FOR UPDATE TO authenticated
  USING (status = 'waiting' AND guest_id IS NULL AND auth.uid() <> host_id)
  WITH CHECK (status = 'waiting' AND auth.uid() = guest_id);
CREATE TABLE public.battle_queue (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'timed',
  duration_s integer NOT NULL DEFAULT 60,
  battle_id uuid REFERENCES public.battles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.battle_queue TO authenticated;
GRANT ALL ON public.battle_queue TO service_role;
ALTER TABLE public.battle_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY battle_queue_select_self ON public.battle_queue FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Historical club/membership schema and the final tracked owner-only INSERT policy.
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  motto text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#38bdf8',
  code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_goal integer NOT NULL DEFAULT 1000 CHECK (weekly_goal BETWEEN 100 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);
CREATE FUNCTION public.is_club_member(_club_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = _club_id AND user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
GRANT SELECT, INSERT, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY clubs_select_member ON public.clubs FOR SELECT TO authenticated
  USING (public.is_club_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY clubs_insert_owner ON public.clubs FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY clubs_update_owner ON public.clubs FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY club_members_select ON public.club_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_member(club_id, auth.uid()));
CREATE POLICY club_members_insert_owner ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()
  ));
CREATE POLICY club_members_delete_self ON public.club_members FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE FUNCTION public.join_club_by_code(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _club public.clubs%ROWTYPE; _count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
  SELECT * INTO _club FROM public.clubs WHERE code = upper(trim(_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'Club nicht gefunden'; END IF;
  SELECT count(*) INTO _count FROM public.club_members WHERE club_id = _club.id;
  IF _count >= 30 THEN RAISE EXCEPTION 'Club ist voll'; END IF;
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (_club.id, auth.uid(), 'member') ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN _club.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_club_by_code(text) FROM anon;

-- Apply the exact tracked global-role schema/helper to the disposable cluster;
-- the administrator below is test-only data, not the local PostgreSQL superuser.
\ir ../supabase/migrations/20261101152000_global_admin_roles.sql

INSERT INTO auth.users (id, is_anonymous, email) VALUES
 ('10000000-0000-4000-8000-000000000001', false, 'owner@example.invalid'),
 ('20000000-0000-4000-8000-000000000002', false, 'invited@example.invalid'),
 ('30000000-0000-4000-8000-000000000003', false, 'outsider@example.invalid'),
 ('40000000-0000-4000-8000-000000000004', false, 'admin@example.invalid'),
 ('50000000-0000-4000-8000-000000000005', true, 'anon@example.invalid'),
 ('60000000-0000-4000-8000-000000000006', false, 'race-a@example.invalid'),
 ('70000000-0000-4000-8000-000000000007', false, 'race-b@example.invalid'),
 ('80000000-0000-4000-8000-000000000008', false, 'public-a@example.invalid'),
 ('90000000-0000-4000-8000-000000000009', false, 'public-b@example.invalid');
INSERT INTO auth.users (id, is_anonymous, email)
SELECT ('a1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, false, 'pool' || n || '@example.invalid'
FROM generate_series(1, 40) AS n;
INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT id, split_part(email, '@', 1), NULL FROM auth.users;
INSERT INTO public.friendships (requester_id, addressee_id, status)
VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'accepted');
INSERT INTO public.global_role_assignments (user_id, role_name, granted_by)
VALUES ('40000000-0000-4000-8000-000000000004', 'admin', '10000000-0000-4000-8000-000000000001');

INSERT INTO public.clubs (id, name, code, owner_id) VALUES
 ('c0000000-0000-4000-8000-000000000001', 'Invite Club', 'OLDCLUBCODE001', '10000000-0000-4000-8000-000000000001'),
 ('c0000000-0000-4000-8000-000000000002', 'Capacity Club', 'OLDCAPACITY001', '10000000-0000-4000-8000-000000000001');
INSERT INTO public.club_members (club_id, user_id, role)
VALUES ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
       ('c0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'owner');
INSERT INTO public.club_members (club_id, user_id, role)
SELECT 'c0000000-0000-4000-8000-000000000002',
       ('a1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'member'
FROM generate_series(1, 28) AS n;
INSERT INTO public.battles (id, code, host_id, status, duration_s, mode, target_reps) VALUES
 ('b0000000-0000-4000-8000-000000000001', 'OLDPRIVATE001', '10000000-0000-4000-8000-000000000001', 'waiting', 60, 'timed', 0),
 ('b0000000-0000-4000-8000-000000000002', 'OLDRACE00001', '10000000-0000-4000-8000-000000000001', 'waiting', 60, 'timed', 0),
 ('b0000000-0000-4000-8000-000000000003', 'ACTIVEHISTORY', '10000000-0000-4000-8000-000000000001', 'active', 60, 'timed', 0),
 ('b0000000-0000-4000-8000-000000000004', 'FINISHEDHIST', '10000000-0000-4000-8000-000000000001', 'finished', 60, 'timed', 0);

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='battles'
        AND cmd IN ('SELECT','ALL') AND roles && ARRAY['anon','authenticated','public']::name[]) <> 1
     OR has_table_privilege('authenticated','public.battles','UPDATE')
     OR NOT has_column_privilege('authenticated','public.battles','guest_id','UPDATE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='battles'
        AND policyname='battles join as guest' AND cmd='UPDATE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='club_members'
        AND policyname='club_members_insert_owner' AND with_check LIKE '%owner_id%') THEN
    RAISE EXCEPTION 'FIXTURE ERROR: historical battles/clubs policy or grant baseline drifted';
  END IF;
END;
$$;

-- Preserve existing recipient-bound friend RPCs and enforce a real pre-payload baseline.
\ir ../supabase/migrations/20261026093000_friend_battle_invitations.sql
\i :candidate_path

CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'TEST FAILED: %', label USING ERRCODE = 'P0001'; END IF; END;
$$;
CREATE FUNCTION pg_temp.assert_raises(statement text, allowed_states text[], label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
    IF actual_state = ANY (allowed_states) THEN RETURN; END IF;
    RAISE EXCEPTION 'TEST FAILED: % expected %, got %', label, allowed_states, actual_state USING ERRCODE = 'P0001';
  END;
  RAISE EXCEPTION 'TEST FAILED: % unexpectedly succeeded', label USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION pg_temp.assert_api_error(response jsonb, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF response->>'success' IS DISTINCT FROM 'false'
     OR coalesce(response->>'error', '') !~ '^[A-Z][A-Z0-9_]*$' THEN
    RAISE EXCEPTION 'TEST FAILED: % expected success=false and an uppercase error code, got %', label, response;
  END IF;
END;
$$;

-- Exact relevant authorization state remains participant-only after the candidate.
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM pg_policies
  WHERE schemaname='public' AND tablename='battles' AND cmd IN ('SELECT','ALL')
    AND roles && ARRAY['anon','authenticated','public']::name[]), 'baseline battle SELECT is participant-only');

-- Candidate effects: generated/rotated codes and history preservation.
SELECT pg_temp.assert_true((SELECT code ~ '^[0-9A-F]{32}$' FROM public.clubs
  WHERE id='c0000000-0000-4000-8000-000000000001'), 'existing club invite code is rotated to 32 uppercase hex');
SELECT pg_temp.assert_true((SELECT code ~ '^[0-9A-F]{32}$' FROM public.battles
  WHERE id='b0000000-0000-4000-8000-000000000001'), 'existing waiting battle code is rotated');
SELECT pg_temp.assert_true((SELECT code = 'ACTIVEHISTORY' FROM public.battles
  WHERE id='b0000000-0000-4000-8000-000000000003'), 'active history code remains untouched');
SELECT pg_temp.assert_true((SELECT code = 'FINISHEDHIST' FROM public.battles
  WHERE id='b0000000-0000-4000-8000-000000000004'), 'finished history code remains untouched');
SELECT pg_temp.assert_true((SELECT count(*)=29 FROM public.club_members
  WHERE club_id='c0000000-0000-4000-8000-000000000002'), 'existing 29 club memberships survive payload application');
SELECT pg_temp.assert_true((SELECT column_default LIKE '%true%'
  FROM information_schema.columns WHERE table_schema='public' AND table_name='battles' AND column_name='is_private'), 'private battle default is true');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.battles','UPDATE'), 'candidate keeps table UPDATE revoked');
SELECT pg_temp.assert_true(NOT has_column_privilege('authenticated','public.battles','guest_id','UPDATE'), 'candidate removes direct guest_id UPDATE grant');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='battles' AND policyname='battles join as guest'), 'candidate removes direct guest UPDATE policy');
SELECT pg_temp.assert_true(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='battles' AND policyname='battles insert as host'
  AND lower(with_check) LIKE '%host_id%' AND lower(with_check) LIKE '%guest_id is null%'
  AND lower(with_check) LIKE '%status%' AND lower(with_check) LIKE '%is_private%'),
  'direct battle INSERT is host-only, guestless, waiting and private');
SELECT pg_temp.assert_true(to_regclass('public.join_attempt_ratelimit') IS NOT NULL,
  'protected per-user/per-scope rate-limit table exists');
SELECT pg_temp.assert_true(to_regprocedure('public.check_and_record_join_attempt(text)') IS NOT NULL,
  'internal rate-limit helper exists with one scope argument');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.check_and_record_join_attempt(text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.check_and_record_join_attempt(text)','EXECUTE')
  AND NOT has_function_privilege('service_role','public.check_and_record_join_attempt(text)','EXECUTE'),
  'rate-limit helper cannot be directly executed by browser or service roles');
SELECT pg_temp.assert_true(NOT has_table_privilege('anon','public.join_attempt_ratelimit','SELECT')
  AND NOT has_table_privilege('authenticated','public.join_attempt_ratelimit','SELECT')
  AND NOT has_table_privilege('service_role','public.join_attempt_ratelimit','SELECT'),
  'rate-limit records are not directly readable by application roles');

-- Anon cannot invoke public RPCs; candidate private/internal helper functions are not executable by browser roles.
SET ROLE anon;
SELECT pg_temp.assert_raises($$SELECT public.join_club_by_invite_code('BAD')$$, ARRAY['42501'], 'anon cannot invoke invite club RPC');
SELECT pg_temp.assert_raises($$SELECT public.join_club_by_code('BAD')$$, ARRAY['42501'], 'anon cannot invoke legacy club wrapper');
SELECT pg_temp.assert_raises($$SELECT public.join_battle_by_code('BAD')$$, ARRAY['42501'], 'anon cannot invoke battle join RPC');
SELECT pg_temp.assert_raises($$SELECT public.find_public_battle_match('timed',60,0)$$, ARRAY['42501'], 'anon cannot enter public match');
SELECT pg_temp.assert_raises($$SELECT public.leave_public_battle_queue('b0000000-0000-4000-8000-000000000001')$$, ARRAY['42501'], 'anon cannot leave a queue');
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('private','internal')
    AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
), 'private helper functions are not directly executable by browser roles');

-- Forged IDs, guessed/legacy codes, and direct writes fail closed for unrelated
-- authenticated user and an unrelated global admin (ordinary role, not postgres).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","is_anonymous":false}',false);
SELECT pg_temp.assert_api_error(public.join_club_by_invite_code('NOT-A-REAL-CODE'), 'guessed club code is rejected');
SELECT pg_temp.assert_true(public.join_club_by_code('NOT-A-REAL-CODE') IS NULL, 'legacy wrapper returns NULL on invalid code');
SELECT pg_temp.assert_api_error(public.join_battle_by_code('NOT-A-REAL-CODE'), 'guessed battle code is rejected');
SELECT pg_temp.assert_api_error(public.join_battle_by_code('OLDPRIVATE001'), 'rotated legacy battle code is rejected');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000001'), 'private battle SELECT stays participant-only');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.clubs WHERE id='c0000000-0000-4000-8000-000000000001'), 'outsider cannot read the current club bearer code');
SELECT pg_temp.assert_api_error(public.join_battle_by_code('00000000000000000000000000000000'), 'well-formed unknown battle code grants no access');
SELECT pg_temp.assert_api_error(public.join_club_by_invite_code('00000000000000000000000000000000'), 'well-formed unknown club code grants no access');
SELECT pg_temp.assert_raises($$INSERT INTO public.club_members(club_id,user_id,role)
  VALUES ('c0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','member')$$,
  ARRAY['42501'], 'outsider cannot directly insert membership in a foreign club');
SELECT pg_temp.assert_raises($$UPDATE public.battles SET status='finished'
  WHERE id='b0000000-0000-4000-8000-000000000001'$$,
  ARRAY['42501'], 'authenticated caller cannot directly update battle result fields');
SELECT pg_temp.assert_raises($$UPDATE public.battles SET guest_id='30000000-0000-4000-8000-000000000003'
  WHERE id='b0000000-0000-4000-8000-000000000001'$$, ARRAY['42501'],
  'outsider cannot directly claim private battle guest slot');
SELECT pg_temp.assert_raises($$INSERT INTO public.battles(code,host_id,guest_id,status,is_private)
  VALUES ('FORGED-GUEST','30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','waiting',true)$$,
  ARRAY['42501'], 'direct battle INSERT cannot preassign a guest');
SELECT pg_temp.assert_raises($$INSERT INTO public.battles(code,host_id,guest_id,status,is_private)
  VALUES ('FORGED-PUBLIC','30000000-0000-4000-8000-000000000003',NULL,'waiting',false)$$,
  ARRAY['42501'], 'direct battle INSERT cannot forge a public battle');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT guest_id IS NULL FROM public.battles
  WHERE id='b0000000-0000-4000-8000-000000000001'), 'privileged observer confirms blocked outsider left guest slot empty');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000004',false);
SELECT set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000004","is_anonymous":false}',false);
SELECT pg_temp.assert_true(public.has_global_role('admin'), 'fixture administrator has a global role');
SELECT pg_temp.assert_api_error(public.join_battle_by_code('NOT-A-REAL-CODE'), 'unrelated global admin cannot bypass invite code checks');
SELECT pg_temp.assert_raises($$INSERT INTO public.club_members(club_id,user_id,role)
  VALUES ('c0000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','member')$$,
  ARRAY['42501'], 'unrelated global admin cannot bypass owner-only direct membership policy');
RESET ROLE;

-- A bearer of a current private battle code can claim the waiting guest slot,
-- but gains no administrative bypass; repeated own poll/claim is idempotent.
SELECT code AS invited_battle_code FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000001' \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
SELECT public.join_battle_by_code(:'invited_battle_code') AS invited_join \gset
SELECT pg_temp.assert_true((:'invited_join'::jsonb->>'success')::boolean
  AND (:'invited_join'::jsonb->>'joined')::boolean
  AND (:'invited_join'::jsonb->>'host_id')::uuid='10000000-0000-4000-8000-000000000001', 'known bearer joins private battle and receives correct host identity');
SELECT public.join_battle_by_code(:'invited_battle_code') AS invited_repeat \gset
SELECT pg_temp.assert_true((:'invited_repeat'::jsonb->>'success')::boolean
  AND NOT (:'invited_repeat'::jsonb->>'joined')::boolean, 'repeat join reports joined=false and is idempotent');
SELECT pg_temp.assert_true((SELECT guest_id='20000000-0000-4000-8000-000000000002'
  FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000001'), 'private battle claim persists only invited bearer');
RESET ROLE;

-- Valid bearer code joins a club. Owner remains the only actor who may directly add members.
SELECT code AS club_invite_code FROM public.clubs WHERE id='c0000000-0000-4000-8000-000000000001' \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","is_anonymous":false}',false);
SELECT public.join_club_by_invite_code(:'club_invite_code') AS club_join \gset
SELECT pg_temp.assert_true((:'club_join'::jsonb->>'success')::boolean
  AND (:'club_join'::jsonb->>'club_id')::uuid='c0000000-0000-4000-8000-000000000001', 'valid club bearer receives only its club id');
SELECT public.join_club_by_code('OLDCLUBCODE001') IS NULL AS old_club_null \gset
SELECT pg_temp.assert_true(:'old_club_null'::boolean, 'rotated legacy club code is rejected by secure wrapper');
RESET ROLE;

-- Friend invitation APIs remain recipient-bound and their accepted battle uses a 32-hex code trigger.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
SELECT public.create_friend_battle_invitation('20000000-0000-4000-8000-000000000002','timed',60,0) AS friend_invite \gset
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
SELECT battle_id AS friend_battle_id FROM public.respond_to_friend_battle_invitation(:'friend_invite'::uuid,true)
  WHERE result='accepted' \gset
SELECT pg_temp.assert_true((SELECT code ~ '^[0-9A-F]{32}$' FROM public.battles WHERE id=:'friend_battle_id'::uuid), 'preserved friend RPC creates a battle with 32-hex code');
RESET ROLE;

-- New INSERT and code-change trigger contract.
INSERT INTO public.battles (code, host_id, status) VALUES ('SHOULD-ROTATE', '10000000-0000-4000-8000-000000000001', 'waiting') RETURNING id AS inserted_battle_id \gset
SELECT pg_temp.assert_true((SELECT code ~ '^[0-9A-F]{32}$' FROM public.battles WHERE id=:'inserted_battle_id'::uuid), 'new battle INSERT trigger generates 32 uppercase hex');
UPDATE public.battles SET code='SHOULD-ROTATE-AGAIN' WHERE id=:'inserted_battle_id'::uuid;
SELECT pg_temp.assert_true((SELECT code ~ '^[0-9A-F]{32}$' AND code <> 'SHOULD-ROTATE-AGAIN'
  FROM public.battles WHERE id=:'inserted_battle_id'::uuid), 'battle code changes rotate through trigger');
INSERT INTO public.clubs (name, code, owner_id) VALUES ('New Club', 'SHOULD-ROTATE', '10000000-0000-4000-8000-000000000001') RETURNING id AS inserted_club_id \gset
SELECT pg_temp.assert_true((SELECT code ~ '^[0-9A-F]{32}$' FROM public.clubs WHERE id=:'inserted_club_id'::uuid), 'new club INSERT trigger generates 32 uppercase hex');
UPDATE public.clubs SET code='SHOULD-ROTATE-AGAIN' WHERE id=:'inserted_club_id'::uuid;
SELECT pg_temp.assert_true((SELECT code ~ '^[0-9A-F]{32}$' AND code <> 'SHOULD-ROTATE-AGAIN'
  FROM public.clubs WHERE id=:'inserted_club_id'::uuid), 'club code changes rotate through trigger');

-- Rate-limit checks use a fresh user and separate autocommitted RPC calls.
-- Normal error responses are committed, so the ninth attempt must observe prior failures.
\set rate_user 'a1000000-0000-4000-8000-000000000039'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'rate_user',false);
SELECT set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000039","is_anonymous":false}',false);
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate1 \gset
SELECT pg_temp.assert_api_error(:'rate1'::jsonb, 'rate attempt 1 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate2 \gset
SELECT pg_temp.assert_api_error(:'rate2'::jsonb, 'rate attempt 2 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate3 \gset
SELECT pg_temp.assert_api_error(:'rate3'::jsonb, 'rate attempt 3 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate4 \gset
SELECT pg_temp.assert_api_error(:'rate4'::jsonb, 'rate attempt 4 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate5 \gset
SELECT pg_temp.assert_api_error(:'rate5'::jsonb, 'rate attempt 5 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate6 \gset
SELECT pg_temp.assert_api_error(:'rate6'::jsonb, 'rate attempt 6 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate7 \gset
SELECT pg_temp.assert_api_error(:'rate7'::jsonb, 'rate attempt 7 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate8 \gset
SELECT pg_temp.assert_api_error(:'rate8'::jsonb, 'rate attempt 8 returns committed error');
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS rate9 \gset
SELECT pg_temp.assert_true(:'rate9'::jsonb->>'error'='RATE_LIMITED', 'ninth same-scope attempt is rate limited');
SELECT public.join_club_by_invite_code('INVALID-RATE-LIMIT-CLUB') AS other_scope \gset
SELECT pg_temp.assert_true(:'other_scope'::jsonb->>'success'='false'
  AND :'other_scope'::jsonb->>'error'<>'RATE_LIMITED', 'same user has an independent club-join scope');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 AND bool_and(cardinality(attempts)=8)
  FROM public.join_attempt_ratelimit WHERE user_id=:'rate_user'::uuid AND scope='battle'),
  'privileged observer confirms eight committed attempts without exposing protected state to users');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000038',false);
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000038","is_anonymous":false}',false);
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS isolated_user \gset
SELECT pg_temp.assert_true(:'isolated_user'::jsonb->>'success'='false'
  AND :'isolated_user'::jsonb->>'error'<>'RATE_LIMITED', 'another uid has an independent battle scope');
RESET ROLE;

-- Superuser-only fixture aging simulates expiry without waiting 60 seconds.
UPDATE public.join_attempt_ratelimit
SET attempts = ARRAY[clock_timestamp() - interval '61 seconds'],
    updated_at = clock_timestamp() - interval '61 seconds'
WHERE user_id='a1000000-0000-4000-8000-000000000039';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000039',false);
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000039","is_anonymous":false}',false);
SELECT public.join_battle_by_code('INVALID-RATE-LIMIT-CODE') AS after_expiry \gset
SELECT pg_temp.assert_true(:'after_expiry'::jsonb->>'success'='false'
  AND :'after_expiry'::jsonb->>'error'<>'RATE_LIMITED', 'limiter accepts a new attempt after rolling-window expiry');
RESET ROLE;

-- The legacy RPC is not an alternate unmetered entry point: its committed
-- failed calls consume exactly the same club bucket as the new API.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000036',false);
SELECT set_config('request.jwt.claims','{"is_anonymous":false}',false);
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT public.join_club_by_code('INVALID-LEGACY-CODE');
SELECT pg_temp.assert_true(public.join_club_by_invite_code(:'club_invite_code')->>'error'='RATE_LIMITED', 'eight legacy requests block a ninth new club API call');
RESET ROLE;

-- Anonymous identity is rejected even if JWT settings otherwise name a real user.
SELECT code AS anonymous_battle_code FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000002' \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000005',false);
SELECT set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000005","is_anonymous":true}',false);
SELECT pg_temp.assert_true(public.join_club_by_invite_code(:'club_invite_code')->>'error'='UNAUTHORIZED', 'anonymous account cannot use a valid club code');
SELECT pg_temp.assert_true(public.join_battle_by_code(:'anonymous_battle_code')->>'error'='UNAUTHORIZED', 'anonymous account cannot claim a valid battle code');
SELECT pg_temp.assert_true(public.join_club_by_code(:'club_invite_code') IS NULL, 'legacy wrapper rejects anonymous account with valid club code');
SELECT pg_temp.assert_true(public.find_public_battle_match('timed',60,0)->>'error'='UNAUTHORIZED', 'anonymous account cannot enter public queue');
SELECT pg_temp.assert_true(public.leave_public_battle_queue('b0000000-0000-4000-8000-000000000002')->>'error'='UNAUTHORIZED', 'anonymous account cannot use queue cancellation');
SELECT set_config('request.jwt.claims','{"is_anonymous":false}',false);
SELECT pg_temp.assert_true(public.join_club_by_invite_code(:'club_invite_code')->>'error'='UNAUTHORIZED', 'database anonymous flag independently blocks a JWT false flag');
SELECT set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000006',false);
SELECT set_config('request.jwt.claims','{"is_anonymous":true}',false);
SELECT pg_temp.assert_true(public.join_battle_by_code(:'anonymous_battle_code')->>'error'='UNAUTHORIZED', 'JWT anonymous flag independently blocks a registered database user');
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.join_attempt_ratelimit WHERE user_id IN
 ('50000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000006')), 'anonymous rejection happens before attempt state or membership changes');

\echo 'PASS: serial invite-security contract assertions completed; runner will execute two-connection races next'
