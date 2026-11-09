-- Fresh local review candidate; not run against Lovable or any live database.
-- Execute the SET, single DO, and RESET together as one query batch.
-- External statement_timeout bounds the complete DO call; RESET restores the session on success.
SET statement_timeout = '60s';

-- Review-only wrapper derived from battle-club-invite-payload.sql; source SHA-256 e0ebb59b2ca602084c94b31cbaa1add8acd0e44f334aea23da52715ea1638bb3.
-- Outer BEGIN/COMMIT removed: one DO statement is the transaction boundary.
-- Each original top-level statement is executed separately and unchanged via PL/pgSQL EXECUTE.
-- NOT approved for live use; transformation requires separate user authorization.
DO $__alo_wrapper__$
BEGIN
  EXECUTE $__alo_stmt_001__$
SET LOCAL lock_timeout = '10s';$__alo_stmt_001__$;
  EXECUTE $__alo_stmt_002__$
SET LOCAL statement_timeout = '60s';$__alo_stmt_002__$;
  EXECUTE $__alo_stmt_003__$

DO $preflight$
DECLARE
  item record;
  got record;
  expected_owner oid := (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = CURRENT_USER);
BEGIN
  IF pg_catalog.to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: pgcrypto generator missing';
  END IF;
  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL OR pg_catalog.to_regprocedure('auth.jwt()') IS NULL
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='users'
      AND column_name='is_anonymous' AND data_type='boolean') THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: real-account identity contract missing';
  END IF;
  FOR item IN SELECT pg_catalog.unnest(ARRAY['battles','clubs','club_members']) AS name LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=item.name AND c.relkind='r'
      AND c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relowner=expected_owner) THEN
      RAISE EXCEPTION 'INVITE_PREFLIGHT: table/RLS/owner differs: %', item.name;
    END IF;
  END LOOP;
  FOR item IN SELECT * FROM (VALUES
    ('battles','id','uuid'),('battles','code','text'),('battles','host_id','uuid'),
    ('battles','guest_id','uuid'),('battles','status','text'),('battles','is_bot','boolean'),
    ('battles','mode','text'),('battles','duration_s','integer'),('battles','target_reps','integer'),
    ('battles','created_at','timestamp with time zone'),('battles','updated_at','timestamp with time zone'),
    ('clubs','id','uuid'),('clubs','code','text'),('clubs','owner_id','uuid'),
    ('club_members','club_id','uuid'),('club_members','user_id','uuid'),('club_members','role','text')
  ) AS v(table_name,column_name,type_name) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public'
      AND c.table_name=item.table_name AND c.column_name=item.column_name AND c.data_type=item.type_name) THEN
      RAISE EXCEPTION 'INVITE_PREFLIGHT: column differs: %.%', item.table_name,item.column_name;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='battles') <> 3
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='clubs') <> 3
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='club_members') <> 3 THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: unexpected policy count';
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('battles','battles select participants','SELECT','((auth.uid()=host_id)OR(auth.uid()=guest_id))',NULL),
    ('battles','battles insert as host','INSERT',NULL,'(auth.uid()=host_id)'),
    ('battles','battles join as guest','UPDATE','((status=''waiting''::text)AND(guest_idISNULL)AND(auth.uid()<>host_id))','((status=''waiting''::text)AND(auth.uid()=guest_id))'),
    ('clubs','clubs_select_member','SELECT','(is_club_member(id,auth.uid())OR(owner_id=auth.uid()))',NULL),
    ('clubs','clubs_insert_owner','INSERT',NULL,'(owner_id=auth.uid())'),
    ('clubs','clubs_update_owner','UPDATE','(owner_id=auth.uid())','(owner_id=auth.uid())'),
    ('club_members','club_members_insert_owner','INSERT',NULL,'((user_id=auth.uid())AND(EXISTS(SELECT1FROMclubscWHERE((c.id=club_members.club_id)AND(c.owner_id=auth.uid())))))'),
    ('club_members','club_members_select','SELECT','((user_id=auth.uid())ORis_club_member(club_id,auth.uid()))',NULL),
    ('club_members','club_members_delete_self','DELETE','(user_id=auth.uid())',NULL)
  ) AS v(table_name,policy_name,command,using_sql,check_sql) LOOP
    SELECT p.* INTO got FROM pg_catalog.pg_policies p WHERE p.schemaname='public'
      AND p.tablename=item.table_name AND p.policyname=item.policy_name;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_PREFLIGHT: missing policy %', item.policy_name; END IF;
    IF got.cmd<>item.command OR got.permissive<>'PERMISSIVE' OR got.roles<>ARRAY['authenticated']::name[]
      OR pg_catalog.regexp_replace(pg_catalog.replace(got.qual,'public.',''),'\s','','g') IS DISTINCT FROM item.using_sql
      OR pg_catalog.regexp_replace(pg_catalog.replace(got.with_check,'public.',''),'\s','','g') IS DISTINCT FROM item.check_sql THEN
      RAISE EXCEPTION 'INVITE_PREFLIGHT: policy definition differs: %', item.policy_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='club_members'
      AND cmd IN ('INSERT','ALL') AND policyname<>'club_members_insert_owner') THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: unexpected club membership writer';
  END IF;
  IF pg_catalog.has_table_privilege('authenticated','public.battles','UPDATE')
    OR NOT pg_catalog.has_column_privilege('authenticated','public.battles','guest_id','UPDATE')
    OR pg_catalog.has_column_privilege('anon','public.battles','guest_id','UPDATE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.battles'::regclass
      AND a.attnum>0 AND NOT a.attisdropped AND a.attname<>'guest_id'
      AND pg_catalog.has_column_privilege('authenticated',a.attrelid,a.attnum,'UPDATE')) THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: unexpected battle UPDATE grants';
  END IF;
  IF pg_catalog.to_regprocedure('public.join_club_by_code(text)') IS NULL THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: legacy club RPC missing';
  END IF;
  SELECT * INTO got FROM pg_catalog.pg_proc WHERE oid='public.join_club_by_code(text)'::regprocedure;
  IF got.prorettype<>'uuid'::regtype OR NOT got.prosecdef OR got.proowner<>expected_owner
    OR pg_catalog.pg_get_function_identity_arguments(got.oid)<>'_code text' THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: legacy club RPC contract differs';
  END IF;
  IF pg_catalog.to_regclass('public.join_attempt_ratelimit') IS NOT NULL
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='battles' AND column_name='is_private')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=ANY(ARRAY['check_and_record_join_attempt','join_club_by_invite_code',
      'join_battle_by_code','find_public_battle_match','leave_public_battle_queue','trg_generate_secure_code_insert','trg_generate_secure_code_update']))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid IN ('public.clubs'::regclass,'public.battles'::regclass)
      AND tgname=ANY(ARRAY['trg_clubs_secure_code_insert','trg_clubs_secure_code_update','trg_battles_secure_code_insert','trg_battles_secure_code_update'])) THEN
    RAISE EXCEPTION 'INVITE_PREFLIGHT: new object collision; abort rather than overwrite';
  END IF;
END;
$preflight$;$__alo_stmt_003__$;
  EXECUTE $__alo_stmt_004__$

CREATE TABLE public.join_attempt_ratelimit (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('club','battle')),
  attempts timestamptz[] NOT NULL DEFAULT '{}'::timestamptz[] CHECK (pg_catalog.cardinality(attempts)<=8),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (user_id,scope)
);$__alo_stmt_004__$;
  EXECUTE $__alo_stmt_005__$
ALTER TABLE public.join_attempt_ratelimit ENABLE ROW LEVEL SECURITY;$__alo_stmt_005__$;
  EXECUTE $__alo_stmt_006__$
REVOKE ALL ON TABLE public.join_attempt_ratelimit FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_006__$;
  EXECUTE $__alo_stmt_007__$

CREATE FUNCTION public.check_and_record_join_attempt(p_scope text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  actor uuid := auth.uid();
  now_at timestamptz;
  old_attempts timestamptz[];
  recent timestamptz[];
BEGIN
  IF actor IS NULL OR p_scope IS NULL OR p_scope NOT IN ('club','battle') THEN RETURN false; END IF;
  INSERT INTO public.join_attempt_ratelimit(user_id,scope) VALUES(actor,p_scope)
    ON CONFLICT(user_id,scope) DO NOTHING;
  SELECT r.attempts INTO old_attempts FROM public.join_attempt_ratelimit r
    WHERE r.user_id=actor AND r.scope=p_scope FOR UPDATE;
  -- Capture time AFTER obtaining the lock; blocked concurrent calls cannot use stale time.
  now_at := pg_catalog.clock_timestamp();
  recent := ARRAY(SELECT t FROM pg_catalog.unnest(old_attempts) AS t WHERE t>now_at-interval '60 seconds');
  IF pg_catalog.cardinality(recent)>=8 THEN
    UPDATE public.join_attempt_ratelimit SET attempts=recent,updated_at=now_at WHERE user_id=actor AND scope=p_scope;
    RETURN false;
  END IF;
  UPDATE public.join_attempt_ratelimit SET attempts=pg_catalog.array_append(recent,now_at),updated_at=now_at
    WHERE user_id=actor AND scope=p_scope;
  RETURN true;
END;
$function$;$__alo_stmt_007__$;
  EXECUTE $__alo_stmt_008__$
REVOKE ALL ON FUNCTION public.check_and_record_join_attempt(text) FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_008__$;
  EXECUTE $__alo_stmt_009__$

ALTER TABLE public.battles ADD COLUMN is_private boolean NOT NULL DEFAULT true;$__alo_stmt_009__$;
  EXECUTE $__alo_stmt_010__$
CREATE FUNCTION public.trg_generate_secure_code_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  NEW.code := pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(16),'hex'));
  RETURN NEW;
END;
$function$;$__alo_stmt_010__$;
  EXECUTE $__alo_stmt_011__$
CREATE FUNCTION public.trg_generate_secure_code_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    NEW.code := pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(16),'hex'));
  END IF;
  RETURN NEW;
END;
$function$;$__alo_stmt_011__$;
  EXECUTE $__alo_stmt_012__$
REVOKE ALL ON FUNCTION public.trg_generate_secure_code_insert() FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_012__$;
  EXECUTE $__alo_stmt_013__$
REVOKE ALL ON FUNCTION public.trg_generate_secure_code_update() FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_013__$;
  EXECUTE $__alo_stmt_014__$
CREATE TRIGGER trg_clubs_secure_code_insert BEFORE INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.trg_generate_secure_code_insert();$__alo_stmt_014__$;
  EXECUTE $__alo_stmt_015__$
CREATE TRIGGER trg_clubs_secure_code_update BEFORE UPDATE OF code ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.trg_generate_secure_code_update();$__alo_stmt_015__$;
  EXECUTE $__alo_stmt_016__$
CREATE TRIGGER trg_battles_secure_code_insert BEFORE INSERT ON public.battles FOR EACH ROW EXECUTE FUNCTION public.trg_generate_secure_code_insert();$__alo_stmt_016__$;
  EXECUTE $__alo_stmt_017__$
CREATE TRIGGER trg_battles_secure_code_update BEFORE UPDATE OF code ON public.battles FOR EACH ROW EXECUTE FUNCTION public.trg_generate_secure_code_update();$__alo_stmt_017__$;
  EXECUTE $__alo_stmt_018__$
UPDATE public.clubs SET code=pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(16),'hex'));$__alo_stmt_018__$;
  EXECUTE $__alo_stmt_019__$
UPDATE public.battles SET code=pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(16),'hex')) WHERE status='waiting';$__alo_stmt_019__$;
  EXECUTE $__alo_stmt_020__$

DROP POLICY "battles join as guest" ON public.battles;$__alo_stmt_020__$;
  EXECUTE $__alo_stmt_021__$
REVOKE UPDATE(guest_id) ON public.battles FROM authenticated;$__alo_stmt_021__$;
  EXECUTE $__alo_stmt_022__$
DROP POLICY "battles insert as host" ON public.battles;$__alo_stmt_022__$;
  EXECUTE $__alo_stmt_023__$
CREATE POLICY "battles insert as host" ON public.battles FOR INSERT TO authenticated
  WITH CHECK(host_id=auth.uid() AND guest_id IS NULL AND status='waiting' AND is_private=true);$__alo_stmt_023__$;
  EXECUTE $__alo_stmt_024__$
-- Existing participant-only SELECT and club_members owner-bootstrap policies stay unchanged.

CREATE FUNCTION public.join_battle_by_code(p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  actor uuid := auth.uid();
  clean_code text;
  battle public.battles%ROWTYPE;
BEGIN
  IF actor IS NULL OR COALESCE(auth.jwt()->>'is_anonymous','false')='true'
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=actor AND NOT COALESCE(u.is_anonymous,false)) THEN
    RETURN pg_catalog.jsonb_build_object('success',false,'error','UNAUTHORIZED');
  END IF;
  IF NOT public.check_and_record_join_attempt('battle') THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','RATE_LIMITED'); END IF;
  IF p_code IS NULL OR pg_catalog.length(p_code)>128 THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','INVALID_CODE_FORMAT'); END IF;
  clean_code := pg_catalog.upper(pg_catalog.regexp_replace(p_code,'[\s-]','','g'));
  IF clean_code !~ '^[0-9A-F]{32}$' THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','INVALID_CODE_FORMAT'); END IF;
  SELECT b.* INTO battle FROM public.battles b WHERE b.code=clean_code FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','BATTLE_NOT_FOUND'); END IF;
  IF battle.host_id=actor OR battle.guest_id=actor THEN
    RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'host_id',battle.host_id,'joined',false);
  END IF;
  IF battle.status<>'waiting' OR battle.guest_id IS NOT NULL OR battle.is_bot THEN
    RETURN pg_catalog.jsonb_build_object('success',false,'error','BATTLE_NOT_FOUND');
  END IF;
  UPDATE public.battles SET guest_id=actor,updated_at=pg_catalog.clock_timestamp() WHERE id=battle.id;
  RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'host_id',battle.host_id,'joined',true);
END;
$function$;$__alo_stmt_024__$;
  EXECUTE $__alo_stmt_025__$
REVOKE ALL ON FUNCTION public.join_battle_by_code(text) FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_025__$;
  EXECUTE $__alo_stmt_026__$
GRANT EXECUTE ON FUNCTION public.join_battle_by_code(text) TO authenticated;$__alo_stmt_026__$;
  EXECUTE $__alo_stmt_027__$

CREATE FUNCTION public.find_public_battle_match(p_mode text,p_duration_s integer,p_target_reps integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  actor uuid := auth.uid();
  mode_value text := COALESCE(p_mode,'timed');
  duration_value integer := COALESCE(p_duration_s,60);
  target_value integer := COALESCE(p_target_reps,0);
  battle public.battles%ROWTYPE;
BEGIN
  IF actor IS NULL OR COALESCE(auth.jwt()->>'is_anonymous','false')='true'
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=actor AND NOT COALESCE(u.is_anonymous,false)) THEN
    RETURN pg_catalog.jsonb_build_object('success',false,'error','UNAUTHORIZED');
  END IF;
  IF mode_value NOT IN ('timed','first_to','sprint','endurance') OR duration_value NOT BETWEEN 15 AND 600
    OR target_value NOT BETWEEN 0 AND 500 THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','INVALID_ARGUMENT'); END IF;
  -- One short queue transaction at a time: also prevents duplicate queues during concurrent mode changes.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('alo:public-battle-match:v1',0));
  SELECT b.* INTO battle FROM public.battles b WHERE NOT b.is_private AND NOT b.is_bot AND b.status='waiting'
    AND b.guest_id IS NOT NULL AND (b.host_id=actor OR b.guest_id=actor)
    ORDER BY b.created_at,b.id LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'code',battle.code,'matched',true); END IF;
  UPDATE public.battles SET status='cancelled',updated_at=pg_catalog.clock_timestamp()
    WHERE host_id=actor AND NOT is_private AND NOT is_bot AND status='waiting' AND guest_id IS NULL
      AND (mode<>mode_value OR duration_s<>duration_value);
  SELECT b.* INTO battle FROM public.battles b WHERE b.host_id=actor AND NOT b.is_private AND NOT b.is_bot
    AND b.status='waiting' AND b.guest_id IS NULL AND b.mode=mode_value AND b.duration_s=duration_value
    ORDER BY b.created_at,b.id LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'code',battle.code,'matched',false); END IF;
  SELECT b.* INTO battle FROM public.battles b WHERE NOT b.is_private AND NOT b.is_bot AND b.status='waiting'
    AND b.guest_id IS NULL AND b.host_id<>actor AND b.mode=mode_value AND b.duration_s=duration_value
    ORDER BY b.created_at,b.id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.battles SET guest_id=actor,updated_at=pg_catalog.clock_timestamp() WHERE id=battle.id;
    RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'code',battle.code,'matched',true);
  END IF;
  INSERT INTO public.battles(host_id,mode,duration_s,target_reps,is_bot,is_private,status)
    VALUES(actor,mode_value,duration_value,target_value,false,false,'waiting') RETURNING * INTO battle;
  RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'code',battle.code,'matched',false);
END;
$function$;$__alo_stmt_027__$;
  EXECUTE $__alo_stmt_028__$
REVOKE ALL ON FUNCTION public.find_public_battle_match(text,integer,integer) FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_028__$;
  EXECUTE $__alo_stmt_029__$
GRANT EXECUTE ON FUNCTION public.find_public_battle_match(text,integer,integer) TO authenticated;$__alo_stmt_029__$;
  EXECUTE $__alo_stmt_030__$

CREATE FUNCTION public.leave_public_battle_queue(p_battle_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE actor uuid := auth.uid(); battle public.battles%ROWTYPE;
BEGIN
  IF actor IS NULL OR COALESCE(auth.jwt()->>'is_anonymous','false')='true'
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=actor AND NOT COALESCE(u.is_anonymous,false)) THEN
    RETURN pg_catalog.jsonb_build_object('success',false,'error','UNAUTHORIZED');
  END IF;
  SELECT b.* INTO battle FROM public.battles b WHERE b.id=p_battle_id AND b.host_id=actor
    AND NOT b.is_private AND NOT b.is_bot FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','NOT_FOUND'); END IF;
  IF battle.status='cancelled' THEN RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'matched',false,'cancelled',true); END IF;
  IF battle.status<>'waiting' THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','NOT_FOUND'); END IF;
  IF battle.guest_id IS NOT NULL THEN RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'matched',true,'cancelled',false); END IF;
  UPDATE public.battles SET status='cancelled',updated_at=pg_catalog.clock_timestamp() WHERE id=battle.id;
  RETURN pg_catalog.jsonb_build_object('success',true,'battle_id',battle.id,'matched',false,'cancelled',true);
END;
$function$;$__alo_stmt_030__$;
  EXECUTE $__alo_stmt_031__$
REVOKE ALL ON FUNCTION public.leave_public_battle_queue(uuid) FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_031__$;
  EXECUTE $__alo_stmt_032__$
GRANT EXECUTE ON FUNCTION public.leave_public_battle_queue(uuid) TO authenticated;$__alo_stmt_032__$;
  EXECUTE $__alo_stmt_033__$

CREATE FUNCTION public.join_club_by_invite_code(p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE actor uuid := auth.uid(); clean_code text; club public.clubs%ROWTYPE; member_count bigint;
BEGIN
  IF actor IS NULL OR COALESCE(auth.jwt()->>'is_anonymous','false')='true'
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=actor AND NOT COALESCE(u.is_anonymous,false)) THEN
    RETURN pg_catalog.jsonb_build_object('success',false,'error','UNAUTHORIZED');
  END IF;
  IF NOT public.check_and_record_join_attempt('club') THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','RATE_LIMITED'); END IF;
  IF p_code IS NULL OR pg_catalog.length(p_code)>128 THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','INVALID_CODE_FORMAT'); END IF;
  clean_code := pg_catalog.upper(pg_catalog.regexp_replace(p_code,'[\s-]','','g'));
  IF clean_code !~ '^[0-9A-F]{32}$' THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','INVALID_CODE_FORMAT'); END IF;
  SELECT c.* INTO club FROM public.clubs c WHERE c.code=clean_code FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','CLUB_NOT_FOUND'); END IF;
  IF EXISTS(SELECT 1 FROM public.club_members m WHERE m.club_id=club.id AND m.user_id=actor) THEN
    RETURN pg_catalog.jsonb_build_object('success',true,'club_id',club.id);
  END IF;
  SELECT pg_catalog.count(*) INTO member_count FROM public.club_members m WHERE m.club_id=club.id;
  IF member_count>=30 THEN RETURN pg_catalog.jsonb_build_object('success',false,'error','CLUB_FULL'); END IF;
  INSERT INTO public.club_members(club_id,user_id,role) VALUES(club.id,actor,'member');
  RETURN pg_catalog.jsonb_build_object('success',true,'club_id',club.id);
END;
$function$;$__alo_stmt_033__$;
  EXECUTE $__alo_stmt_034__$
REVOKE ALL ON FUNCTION public.join_club_by_invite_code(text) FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_034__$;
  EXECUTE $__alo_stmt_035__$
GRANT EXECUTE ON FUNCTION public.join_club_by_invite_code(text) TO authenticated;$__alo_stmt_035__$;
  EXECUTE $__alo_stmt_036__$
CREATE OR REPLACE FUNCTION public.join_club_by_code(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE result jsonb;
BEGIN
  result := public.join_club_by_invite_code(_code);
  IF result->>'success'='true' THEN RETURN (result->>'club_id')::uuid; END IF;
  RETURN NULL;
END;
$function$;$__alo_stmt_036__$;
  EXECUTE $__alo_stmt_037__$
REVOKE ALL ON FUNCTION public.join_club_by_code(text) FROM PUBLIC,anon,authenticated,service_role;$__alo_stmt_037__$;
  EXECUTE $__alo_stmt_038__$
GRANT EXECUTE ON FUNCTION public.join_club_by_code(text) TO authenticated;$__alo_stmt_038__$;
  EXECUTE $__alo_stmt_039__$

DO $postconditions$
DECLARE signature text; fn record;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='battles' AND cmd IN ('UPDATE','ALL'))
    OR pg_catalog.has_column_privilege('authenticated','public.battles','guest_id','UPDATE') THEN
    RAISE EXCEPTION 'INVITE_POST: direct guest update remains possible';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='battles')<>2 THEN
    RAISE EXCEPTION 'INVITE_POST: unexpected battle policies';
  END IF;
  IF EXISTS(SELECT 1 FROM public.clubs WHERE code !~ '^[0-9A-F]{32}$')
    OR EXISTS(SELECT 1 FROM public.battles WHERE status='waiting' AND (NOT is_private OR code !~ '^[0-9A-F]{32}$')) THEN
    RAISE EXCEPTION 'INVITE_POST: legacy joinable code or unexpected public legacy battle';
  END IF;
  FOREACH signature IN ARRAY ARRAY['public.join_battle_by_code(text)','public.find_public_battle_match(text,integer,integer)',
    'public.leave_public_battle_queue(uuid)','public.join_club_by_invite_code(text)','public.join_club_by_code(text)'] LOOP
    SELECT p.* INTO fn FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(signature);
    IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_POST: missing RPC %',signature; END IF;
    IF NOT fn.prosecdef OR NOT (COALESCE(fn.proconfig,'{}'::text[]) && ARRAY['search_path=""','search_path='])
      OR NOT pg_catalog.has_function_privilege('authenticated',fn.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('anon',fn.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',fn.oid,'EXECUTE')
      OR fn.prorettype<>(CASE WHEN signature='public.join_club_by_code(text)' THEN 'uuid'::regtype ELSE 'jsonb'::regtype END) THEN
      RAISE EXCEPTION 'INVITE_POST: RPC security/contract differs: %',signature;
    END IF;
  END LOOP;
  FOREACH signature IN ARRAY ARRAY['public.check_and_record_join_attempt(text)','public.trg_generate_secure_code_insert()',
    'public.trg_generate_secure_code_update()'] LOOP
    SELECT p.* INTO fn FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(signature);
    IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_POST: missing helper %',signature; END IF;
    IF NOT fn.prosecdef OR NOT (COALESCE(fn.proconfig,'{}'::text[]) && ARRAY['search_path=""','search_path='])
      OR pg_catalog.has_function_privilege('authenticated',fn.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('anon',fn.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',fn.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'INVITE_POST: helper exposed: %',signature;
    END IF;
  END LOOP;
  IF pg_catalog.has_table_privilege('authenticated','public.join_attempt_ratelimit','SELECT,INSERT,UPDATE,DELETE')
    OR pg_catalog.has_table_privilege('anon','public.join_attempt_ratelimit','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'INVITE_POST: attempt state is exposed';
  END IF;
END;
$postconditions$;$__alo_stmt_039__$;
END;
$__alo_wrapper__$;

RESET statement_timeout;
