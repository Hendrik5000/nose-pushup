-- Account deletion regression test for gym-partner-local-db.sh.
-- Runs in the disposable local cluster only. All seeded data and ACL probes are
-- rolled back at the end; individual delete probes also exercise subtransaction rollback.
\set ON_ERROR_STOP on
BEGIN;

-- Deliberately unique identities/session/data IDs (not used by the shell test).
INSERT INTO auth.users(id, is_anonymous) VALUES
 ('90000000-0000-4000-8000-000000000001',false), -- active host, deleted
 ('90000000-0000-4000-8000-000000000002',false), -- active survivor
 ('90000000-0000-4000-8000-000000000003',false), -- active host survivor
 ('90000000-0000-4000-8000-000000000004',false), -- active non-host, deleted
 ('90000000-0000-4000-8000-000000000005',false), -- closed host, deleted
 ('90000000-0000-4000-8000-000000000006',false), -- closed survivor
 ('90000000-0000-4000-8000-000000000007',false), -- waiting host, deleted
 ('90000000-0000-4000-8000-000000000009',false), -- successful-delete rollback host
	 ('90000000-0000-4000-8000-000000000010',false), -- successful-delete rollback partner
	 ('90000000-0000-4000-8000-000000000011',false), -- AFTER DELETE failure host
	 ('90000000-0000-4000-8000-000000000012',false), -- AFTER DELETE failure partner
	 ('90000000-0000-4000-8000-000000000013',false), -- survivor of prior session 7
	 ('90000000-0000-4000-8000-000000000014',false), -- survivor of prior session 8
	 ('90000000-0000-4000-8000-000000000015',false); -- expired-invite host, deleted

INSERT INTO public.gym_sessions
 (id,host_id,status,invite_code,invite_expires_at,created_at,closed_at) VALUES
 ('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','active',NULL,NULL,'2026-01-01 10:00:00+00',NULL),
 ('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','active',NULL,NULL,'2026-01-02 10:00:00+00',NULL),
 ('91000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000005','closed',NULL,NULL,'2026-01-03 10:00:00+00','2026-01-04 10:00:00+00'),
	 ('91000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000007','waiting','D311E7ED0004',clock_timestamp()+interval '1 hour','2026-01-04 10:00:00+00',NULL),
	 ('91000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000009','active',NULL,NULL,'2026-01-05 10:00:00+00',NULL),
	 ('91000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000011','active',NULL,NULL,'2026-01-06 10:00:00+00',NULL),
	 ('91000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000005','closed',NULL,NULL,'2025-11-01 10:00:00+00','2025-11-02 10:00:00+00'),
	 ('91000000-0000-4000-8000-000000000008','90000000-0000-4000-8000-000000000005','closed',NULL,NULL,'2025-12-01 10:00:00+00','2025-12-02 10:00:00+00'),
	 ('91000000-0000-4000-8000-000000000009','90000000-0000-4000-8000-000000000015','waiting','E90000000009',clock_timestamp()-interval '1 hour','2026-01-09 10:00:00+00',NULL);

INSERT INTO public.gym_memberships
 (session_id,user_id,alias,sharing,visit_share_counts,visit_share_days,joined_at) VALUES
 ('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Deleted Active Host',true,true,true,'2026-01-01 10:01:00+00'),
 ('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Survivor Active Member',true,true,true,'2026-01-01 10:02:00+00'),
 ('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','Surviving Host',true,true,true,'2026-01-02 10:01:00+00'),
 ('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004','Deleted Active Member',true,true,true,'2026-01-02 10:02:00+00'),
 ('91000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000005','Deleted Closed Host',true,true,true,'2026-01-03 10:01:00+00'),
 ('91000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000006','Closed Session Survivor',true,true,true,'2026-01-03 10:02:00+00'),
 ('91000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000007','Deleted Waiting Host',true,true,true,'2026-01-04 10:01:00+00'),
 ('91000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000009','Rollback Host',true,true,true,'2026-01-05 10:01:00+00'),
	 ('91000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000010','Rollback Partner',true,true,true,'2026-01-05 10:02:00+00'),
	 ('91000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000011','Failing Host',true,true,true,'2026-01-06 10:01:00+00'),
	 ('91000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000012','Failing Partner',true,true,true,'2026-01-06 10:02:00+00'),
	 ('91000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000005','Past Session Host',true,true,true,'2025-11-01 10:01:00+00'),
	 ('91000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000013','Past Session Survivor A',true,true,true,'2025-11-01 10:02:00+00'),
	 ('91000000-0000-4000-8000-000000000008','90000000-0000-4000-8000-000000000005','Past Session Host',true,true,true,'2025-12-01 10:01:00+00'),
	 ('91000000-0000-4000-8000-000000000008','90000000-0000-4000-8000-000000000014','Past Session Survivor B',true,true,true,'2025-12-01 10:02:00+00'),
	 ('91000000-0000-4000-8000-000000000009','90000000-0000-4000-8000-000000000015','Expired Waiting Host',true,true,true,'2026-01-09 10:01:00+00');

INSERT INTO public.gym_active_memberships(user_id,session_id) VALUES
 ('90000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),
 ('90000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001'),
 ('90000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002'),
 ('90000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000002'),
 ('90000000-0000-4000-8000-000000000009','91000000-0000-4000-8000-000000000005'),
 ('90000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000005'),
	 ('90000000-0000-4000-8000-000000000011','91000000-0000-4000-8000-000000000006'),
	 ('90000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000006'),
	 ('90000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000009');

INSERT INTO public.gym_sets(id,session_id,user_id,exercise,reps,weight_kg,created_at) VALUES
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Host squat',5,80.250,'2026-02-01 11:00:01+00'),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Survivor press',8,42.500,'2026-02-01 11:00:02+00'),
 ('92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','Retained host row',6,55.000,'2026-02-02 11:00:01+00'),
 ('92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004','Deleted member row',4,30.000,'2026-02-02 11:00:02+00'),
 ('92000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000005','Closed host row',7,70.000,'2026-02-03 11:00:01+00'),
 ('92000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000006','Closed survivor row',9,20.000,'2026-02-03 11:00:02+00'),
 ('92000000-0000-4000-8000-000000000007','91000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000007','Waiting host row',3,15.000,'2026-02-04 11:00:01+00'),
 ('92000000-0000-4000-8000-000000000008','91000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000009','Rollback host row',5,25.000,'2026-02-05 11:00:01+00'),
 ('92000000-0000-4000-8000-000000000009','91000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000010','Rollback partner row',5,35.000,'2026-02-05 11:00:02+00'),
	 ('92000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000011','Failure host row',2,10.000,'2026-02-06 11:00:01+00'),
	 ('92000000-0000-4000-8000-000000000011','91000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000012','Failure partner row',3,12.000,'2026-02-06 11:00:02+00'),
	 ('92000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000005','Past host row A',4,40.000,'2025-11-01 11:00:01+00'),
	 ('92000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000013','Past survivor row A',6,60.000,'2025-11-01 11:00:02+00'),
	 ('92000000-0000-4000-8000-000000000014','91000000-0000-4000-8000-000000000008','90000000-0000-4000-8000-000000000005','Past host row B',5,50.000,'2025-12-01 11:00:01+00'),
	 ('92000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000008','90000000-0000-4000-8000-000000000014','Past survivor row B',7,70.000,'2025-12-01 11:00:02+00'),
	 ('92000000-0000-4000-8000-000000000016','91000000-0000-4000-8000-000000000009','90000000-0000-4000-8000-000000000015','Expired invite host row',2,20.000,'2026-02-09 11:00:01+00');

INSERT INTO public.gym_visits(user_id,day,created_at) VALUES
 ('90000000-0000-4000-8000-000000000001',current_date,'2026-02-01 12:00:01+00'),
 ('90000000-0000-4000-8000-000000000002',current_date,'2026-02-01 12:00:02+00'),
 ('90000000-0000-4000-8000-000000000003',current_date,'2026-02-02 12:00:01+00'),
 ('90000000-0000-4000-8000-000000000004',current_date,'2026-02-02 12:00:02+00'),
 ('90000000-0000-4000-8000-000000000005',current_date,'2026-02-03 12:00:01+00'),
 ('90000000-0000-4000-8000-000000000006',current_date,'2026-02-03 12:00:02+00'),
 ('90000000-0000-4000-8000-000000000007',current_date,'2026-02-04 12:00:01+00'),
 ('90000000-0000-4000-8000-000000000009',current_date,'2026-02-05 12:00:01+00'),
 ('90000000-0000-4000-8000-000000000010',current_date,'2026-02-05 12:00:02+00'),
	 ('90000000-0000-4000-8000-000000000011',current_date,'2026-02-06 12:00:01+00'),
	 ('90000000-0000-4000-8000-000000000012',current_date,'2026-02-06 12:00:02+00'),
	 ('90000000-0000-4000-8000-000000000005',current_date-2,'2025-11-02 12:00:01+00'),
	 ('90000000-0000-4000-8000-000000000013',current_date-2,'2025-11-02 12:00:02+00'),
	 ('90000000-0000-4000-8000-000000000014',current_date-1,'2025-12-02 12:00:02+00'),
	 ('90000000-0000-4000-8000-000000000015',current_date,'2026-02-09 12:00:01+00');

-- Catalog-level checks: all protected tables retain RLS and no browser/PUBLIC
-- table privileges; the internal BEFORE DELETE trigger function is not callable.
DO $catalog$
DECLARE t text; f oid;
BEGIN
  FOREACH t IN ARRAY ARRAY['gym_sessions','gym_memberships','gym_active_memberships','gym_sets','gym_visits'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname=t) THEN
      RAISE EXCEPTION 'ASSERT: RLS disabled on public.%',t;
    END IF;
    IF has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'ASSERT: browser role has table ACL on public.%',t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE n.nspname='public' AND c.relname=t AND a.grantee=0
    ) THEN RAISE EXCEPTION 'ASSERT: PUBLIC has table ACL on public.%',t; END IF;
  END LOOP;
  SELECT p.oid INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='gym_detach_deleted_account' AND p.pronargs=0;
  IF f IS NULL THEN RAISE EXCEPTION 'ASSERT: missing internal trigger function'; END IF;
  IF NOT (SELECT p.prosecdef AND p.proconfig @> ARRAY['search_path=pg_catalog, public']
          FROM pg_proc p WHERE p.oid=f) THEN
    RAISE EXCEPTION 'ASSERT: trigger function is not SECURITY DEFINER with fixed path';
  END IF;
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                WHERE p.oid=f AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'ASSERT: internal trigger function remains executable by a browser/PUBLIC';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid
                 JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname='auth' AND c.relname='users' AND tr.tgname='gym_detach_account_before_delete'
                   AND NOT tr.tgisinternal AND (tr.tgtype & 2)=2 AND (tr.tgtype & 8)=8 AND tr.tgenabled <> 'D') THEN
    RAISE EXCEPTION 'ASSERT: expected enabled BEFORE DELETE auth.users trigger is absent';
  END IF;
END $catalog$;

-- Even with SELECT ACLs temporarily granted, RLS without policies is an
-- effective deny for every table. Roll the grant straight back afterwards.
SAVEPOINT before_rls_select_grant;
GRANT SELECT ON public.gym_sessions,public.gym_memberships,public.gym_active_memberships,public.gym_sets,public.gym_visits TO authenticated;
SET ROLE authenticated;
DO $rls$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['gym_sessions','gym_memberships','gym_active_memberships','gym_sets','gym_visits'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'ASSERT: RLS exposed % rows on %',n,t; END IF;
  END LOOP;
END $rls$;
RESET ROLE;
ROLLBACK TO SAVEPOINT before_rls_select_grant;

-- Verify pre-delete survivor history via the real authenticated RPC. The exact
-- ID/value/timestamp tuples are checked again after account deletion below.
SET ROLE authenticated;
DO $rpc_before$
DECLARE h jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  h := public.gym_get_history();
  IF h IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'ASSERT: active session unexpectedly present in closed history: %',h;
  END IF;
  h := public.gym_get_snapshot()#>'{own,sets}';
  IF h IS DISTINCT FROM jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000002'::uuid,
       'exercise','Survivor press','reps',8,
       'weightKg',42.500,'createdAt','2026-02-01 11:00:02+00'::timestamptz)) THEN
    RAISE EXCEPTION 'ASSERT: baseline survivor active sets mismatch: %',h;
  END IF;
END $rpc_before$;
RESET ROLE;

-- Negative authorization: authenticated cannot delete auth identities, anon
-- cannot call an authenticated RPC, nor either browser role invoke cleanup.
SET ROLE authenticated;
DO $denials$
DECLARE err text;
BEGIN
  BEGIN DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'ASSERT: authenticated deleted auth.users';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.gym_detach_deleted_account();
    RAISE EXCEPTION 'ASSERT: authenticated executed internal trigger function';
  EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN undefined_function THEN NULL; END;
END $denials$;
RESET ROLE;
SET ROLE anon;
DO $anon$
BEGIN
  BEGIN PERFORM public.gym_create_session('anon deletion test');
    RAISE EXCEPTION 'ASSERT: anon executed gym_create_session';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.gym_detach_deleted_account();
    RAISE EXCEPTION 'ASSERT: anon executed internal trigger function';
  EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN undefined_function THEN NULL; END;
END $anon$;
RESET ROLE;

-- A successful DELETE whose complete cleanup is observed inside a subtransaction
-- must roll back atomically when the caller rolls that subtransaction back.
DO $rollback_success$
DECLARE r public.gym_sessions%ROWTYPE;
BEGIN
  BEGIN
    DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000009';
    IF EXISTS (SELECT 1 FROM auth.users WHERE id='90000000-0000-4000-8000-000000000009')
       OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id='91000000-0000-4000-8000-000000000005')
       OR EXISTS (SELECT 1 FROM public.gym_sets WHERE user_id='90000000-0000-4000-8000-000000000009')
       OR EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000009') THEN
      RAISE EXCEPTION 'ASSERT: successful-delete probe did not execute all cleanup';
    END IF;
    SELECT * INTO r FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000005';
    IF r.status <> 'closed' OR r.host_id IS NOT NULL OR r.invite_code IS NOT NULL OR r.invite_expires_at IS NOT NULL THEN
      RAISE EXCEPTION 'ASSERT: successful-delete probe left session linked/open: %',r;
    END IF;
    IF EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=r.id AND (sharing OR visit_share_counts OR visit_share_days)) THEN
      RAISE EXCEPTION 'ASSERT: successful-delete probe left consent enabled';
    END IF;
    RAISE EXCEPTION USING ERRCODE='Z0001', MESSAGE='intentional rollback after successful account cleanup';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
  END;
  SELECT * INTO r FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000005';
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='90000000-0000-4000-8000-000000000009')
     OR r.status <> 'active' OR r.host_id <> '90000000-0000-4000-8000-000000000009'
     OR (SELECT count(*) FROM public.gym_active_memberships WHERE session_id=r.id) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.gym_sets WHERE id='92000000-0000-4000-8000-000000000008')
     OR NOT EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000009')
     OR NOT EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=r.id AND user_id='90000000-0000-4000-8000-000000000010' AND sharing AND visit_share_counts AND visit_share_days) THEN
    RAISE EXCEPTION 'ASSERT: successful-delete subtransaction rollback was not atomic';
  END IF;
END $rollback_success$;

-- An AFTER DELETE trigger raises only after the BEFORE DELETE cleanup and FK
-- cascades ran; the statement must restore account, session, consents, locks,
-- sets, memberships and visit rows in full.
CREATE FUNCTION public.gym_test_fail_after_account_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.id='90000000-0000-4000-8000-000000000011' THEN
    RAISE EXCEPTION 'deliberate post-cleanup test failure';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER gym_test_fail_after_delete AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.gym_test_fail_after_account_delete();
DO $rollback_failure$
DECLARE err text; r public.gym_sessions%ROWTYPE;
BEGIN
  BEGIN
    DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'ASSERT: deliberate AFTER DELETE failure did not fire';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    IF err <> 'deliberate post-cleanup test failure' THEN RAISE; END IF;
  END;
  SELECT * INTO r FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000006';
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='90000000-0000-4000-8000-000000000011')
     OR r.status <> 'active' OR r.host_id <> '90000000-0000-4000-8000-000000000011'
     OR (SELECT count(*) FROM public.gym_active_memberships WHERE session_id=r.id) <> 2
     OR (SELECT count(*) FROM public.gym_memberships WHERE session_id=r.id) <> 2
     OR (SELECT count(*) FROM public.gym_sets WHERE session_id=r.id) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000011')
     OR NOT EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=r.id AND user_id='90000000-0000-4000-8000-000000000012' AND sharing AND visit_share_counts AND visit_share_days) THEN
    RAISE EXCEPTION 'ASSERT: failed delete did not roll back cleanup atomically';
  END IF;
END $rollback_failure$;
DROP TRIGGER gym_test_fail_after_delete ON auth.users;
DROP FUNCTION public.gym_test_fail_after_account_delete();

-- Actual account deletions by the local privileged owner. The migration trigger
-- must close all affected sessions before FK cascades, preserving the other side.
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000001'; -- active host
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000004'; -- active non-host
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000005'; -- already-closed host
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000007'; -- waiting host
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000015'; -- expired waiting invite host

DO $post_delete_state$
DECLARE s public.gym_sessions%ROWTYPE;
BEGIN
  -- Host deletion from active session retains session, survivor membership, set,
  -- visit and original timestamps/values, while removing all links and consent.
  SELECT * INTO s FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000001';
  IF NOT FOUND OR s.status <> 'closed' OR s.host_id IS NOT NULL OR s.invite_code IS NOT NULL
     OR s.invite_expires_at IS NOT NULL OR s.closed_at IS NULL THEN
    RAISE EXCEPTION 'ASSERT: deleted active host session not detached/closed: %',s;
  END IF;
  IF (SELECT count(*) FROM public.gym_memberships WHERE session_id=s.id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=s.id AND user_id='90000000-0000-4000-8000-000000000002' AND alias='Survivor Active Member' AND joined_at='2026-01-01 10:02:00+00' AND NOT sharing AND NOT visit_share_counts AND NOT visit_share_days)
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id=s.id)
     OR EXISTS (SELECT 1 FROM public.gym_sets WHERE user_id='90000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000001')
     OR NOT EXISTS (SELECT 1 FROM public.gym_sets WHERE id='92000000-0000-4000-8000-000000000002' AND session_id=s.id AND user_id='90000000-0000-4000-8000-000000000002' AND exercise='Survivor press' AND reps=8 AND weight_kg=42.500 AND created_at='2026-02-01 11:00:02+00')
     OR NOT EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000002' AND day=current_date AND created_at='2026-02-01 12:00:02+00') THEN
    RAISE EXCEPTION 'ASSERT: host delete lost survivor data or retained deleted-account data';
  END IF;

  -- Deleting the active non-host similarly closes session, preserves host set
  -- and membership, and cascades only the deleted member's records.
  SELECT * INTO s FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000002';
  IF s.status <> 'closed' OR s.host_id <> '90000000-0000-4000-8000-000000000003'
     OR s.invite_code IS NOT NULL OR s.invite_expires_at IS NOT NULL OR s.closed_at IS NULL
     OR (SELECT count(*) FROM public.gym_memberships WHERE session_id=s.id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=s.id AND user_id='90000000-0000-4000-8000-000000000003' AND alias='Surviving Host' AND joined_at='2026-01-02 10:01:00+00' AND NOT sharing AND NOT visit_share_counts AND NOT visit_share_days)
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id=s.id)
     OR EXISTS (SELECT 1 FROM public.gym_sets WHERE user_id='90000000-0000-4000-8000-000000000004')
     OR EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000004')
     OR NOT EXISTS (SELECT 1 FROM public.gym_sets WHERE id='92000000-0000-4000-8000-000000000003' AND user_id='90000000-0000-4000-8000-000000000003' AND exercise='Retained host row' AND reps=6 AND weight_kg=55 AND created_at='2026-02-02 11:00:01+00') THEN
    RAISE EXCEPTION 'ASSERT: non-host delete failed to preserve survivor data/close session';
  END IF;

  -- Deleting the host of an already-closed session does not erase its prior
  -- close timestamp; surviving history remains detached and all consent is reset.
  SELECT * INTO s FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000003';
  IF s.status <> 'closed' OR s.host_id IS NOT NULL OR s.closed_at <> '2026-01-04 10:00:00+00'
     OR s.invite_code IS NOT NULL OR s.invite_expires_at IS NOT NULL
     OR (SELECT count(*) FROM public.gym_memberships WHERE session_id=s.id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=s.id AND user_id='90000000-0000-4000-8000-000000000006' AND alias='Closed Session Survivor' AND joined_at='2026-01-03 10:02:00+00' AND NOT sharing AND NOT visit_share_counts AND NOT visit_share_days)
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id=s.id)
     OR EXISTS (SELECT 1 FROM public.gym_sets WHERE user_id='90000000-0000-4000-8000-000000000005')
     OR EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000005')
     OR NOT EXISTS (SELECT 1 FROM public.gym_sets WHERE id='92000000-0000-4000-8000-000000000006' AND user_id='90000000-0000-4000-8000-000000000006' AND exercise='Closed survivor row' AND reps=9 AND weight_kg=20 AND created_at='2026-02-03 11:00:02+00') THEN
    RAISE EXCEPTION 'ASSERT: closed-session host deletion altered survivor history';
  END IF;

  -- One account can have several older closed sessions: every one is detached,
  -- retains its exact close time and survivor data, and independently resets consent.
  SELECT * INTO s FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000007';
  IF s.status <> 'closed' OR s.host_id IS NOT NULL OR s.closed_at <> '2025-11-02 10:00:00+00'
     OR (SELECT count(*) FROM public.gym_memberships WHERE session_id=s.id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=s.id AND user_id='90000000-0000-4000-8000-000000000013' AND alias='Past Session Survivor A' AND joined_at='2025-11-01 10:02:00+00' AND NOT sharing AND NOT visit_share_counts AND NOT visit_share_days)
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id=s.id)
     OR NOT EXISTS (SELECT 1 FROM public.gym_sets WHERE id='92000000-0000-4000-8000-000000000013' AND session_id=s.id AND user_id='90000000-0000-4000-8000-000000000013' AND exercise='Past survivor row A' AND reps=6 AND weight_kg=60 AND created_at='2025-11-01 11:00:02+00') THEN
    RAISE EXCEPTION 'ASSERT: first older closed session history was not preserved';
  END IF;
  SELECT * INTO s FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000008';
  IF s.status <> 'closed' OR s.host_id IS NOT NULL OR s.closed_at <> '2025-12-02 10:00:00+00'
     OR (SELECT count(*) FROM public.gym_memberships WHERE session_id=s.id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=s.id AND user_id='90000000-0000-4000-8000-000000000014' AND alias='Past Session Survivor B' AND joined_at='2025-12-01 10:02:00+00' AND NOT sharing AND NOT visit_share_counts AND NOT visit_share_days)
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id=s.id)
     OR NOT EXISTS (SELECT 1 FROM public.gym_sets WHERE id='92000000-0000-4000-8000-000000000015' AND session_id=s.id AND user_id='90000000-0000-4000-8000-000000000014' AND exercise='Past survivor row B' AND reps=7 AND weight_kg=70 AND created_at='2025-12-01 11:00:02+00') THEN
    RAISE EXCEPTION 'ASSERT: second older closed session history was not preserved';
  END IF;

  -- Waiting host deletion must clear the invitation and retain the closed record,
  -- while removing host membership/set/visit and the active lock.
  SELECT * INTO s FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000004';
  IF s.status <> 'closed' OR s.host_id IS NOT NULL OR s.invite_code IS NOT NULL
     OR s.invite_expires_at IS NOT NULL OR s.closed_at IS NULL
     OR EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=s.id)
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id=s.id)
     OR EXISTS (SELECT 1 FROM public.gym_sets WHERE user_id='90000000-0000-4000-8000-000000000007')
     OR EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000007') THEN
    RAISE EXCEPTION 'ASSERT: waiting host deletion left invite/account links/data';
  END IF;

  SELECT * INTO s FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000009';
  IF s.status <> 'closed' OR s.host_id IS NOT NULL OR s.invite_code IS NOT NULL
     OR s.invite_expires_at IS NOT NULL OR s.closed_at IS NULL
     OR EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id=s.id)
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id=s.id)
     OR EXISTS (SELECT 1 FROM public.gym_sets WHERE user_id='90000000-0000-4000-8000-000000000015')
     OR EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000015') THEN
    RAISE EXCEPTION 'ASSERT: expired invitation host deletion left session links or personal data';
  END IF;

  -- No old account identities or aliases are stored in the detached session.
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000015'))
     OR EXISTS (SELECT 1 FROM public.gym_sessions WHERE host_id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000015'))
     OR EXISTS (SELECT 1 FROM public.gym_memberships WHERE user_id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000015'))
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE user_id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000015')) THEN
    RAISE EXCEPTION 'ASSERT: deleted account still has a gym relation';
  END IF;
END $post_delete_state$;

-- Real post-delete RPCs: survivor histories expose only their unchanged rows,
-- active snapshots disappear, and preserved visits remain personal/private.
SET ROLE authenticated;
DO $post_delete_rpc$
DECLARE h jsonb; v jsonb; snap jsonb; err text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  h := public.gym_get_history();
  IF h <> jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000002'::uuid,
       'sessionId','91000000-0000-4000-8000-000000000001'::uuid,'exercise','Survivor press','reps',8,
       'weightKg',42.500,'createdAt','2026-02-01 11:00:02+00'::timestamptz)) THEN
    RAISE EXCEPTION 'ASSERT: survivor history changed/leaked after host deletion: %',h;
  END IF;
  IF public.gym_get_snapshot() IS NOT NULL THEN RAISE EXCEPTION 'ASSERT: deleted-host survivor has active snapshot'; END IF;
  v := public.gym_get_visits(current_date,current_date);
  IF v <> jsonb_build_array(to_char(current_date,'YYYY-MM-DD')) THEN RAISE EXCEPTION 'ASSERT: survivor visits lost: %',v; END IF;
  BEGIN PERFORM public.gym_set_sharing('91000000-0000-4000-8000-000000000001',true);
    RAISE EXCEPTION 'ASSERT: closed deleted-host session still accepts consent';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    IF err='ASSERT: closed deleted-host session still accepts consent' OR position('not_open_session_member' in err)=0 THEN RAISE; END IF;
  END;

  -- The surviving host from a deleted non-host has the same private history.
  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000003","is_anonymous":false}',false);
  h := public.gym_get_history();
  IF h <> jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000003'::uuid,
       'sessionId','91000000-0000-4000-8000-000000000002'::uuid,'exercise','Retained host row','reps',6,
       'weightKg',55.000,'createdAt','2026-02-02 11:00:01+00'::timestamptz)) THEN
    RAISE EXCEPTION 'ASSERT: active non-host deletion altered host history: %',h;
  END IF;

  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000006',false);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000006","is_anonymous":false}',false);
  h := public.gym_get_history();
  IF h <> jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000006'::uuid,
       'sessionId','91000000-0000-4000-8000-000000000003'::uuid,'exercise','Closed survivor row','reps',9,
       'weightKg',20.000,'createdAt','2026-02-03 11:00:02+00'::timestamptz)) THEN
    RAISE EXCEPTION 'ASSERT: prior closed history changed after host deletion: %',h;
  END IF;

  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000013',false);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000013","is_anonymous":false}',false);
  h := public.gym_get_history();
  IF h <> jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000013'::uuid,
       'sessionId','91000000-0000-4000-8000-000000000007'::uuid,'exercise','Past survivor row A','reps',6,
       'weightKg',60.000,'createdAt','2025-11-01 11:00:02+00'::timestamptz))
     OR public.gym_get_visits(current_date-5,current_date) <> jsonb_build_array(to_char(current_date-2,'YYYY-MM-DD')) THEN
    RAISE EXCEPTION 'ASSERT: first past-session survivor history/visit changed: %, %',h,public.gym_get_visits(current_date-5,current_date);
  END IF;

  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000014',false);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000014","is_anonymous":false}',false);
  h := public.gym_get_history();
  IF h <> jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000015'::uuid,
       'sessionId','91000000-0000-4000-8000-000000000008'::uuid,'exercise','Past survivor row B','reps',7,
       'weightKg',70.000,'createdAt','2025-12-01 11:00:02+00'::timestamptz))
     OR public.gym_get_visits(current_date-5,current_date) <> jsonb_build_array(to_char(current_date-1,'YYYY-MM-DD')) THEN
    RAISE EXCEPTION 'ASSERT: second past-session survivor history/visit changed: %, %',h,public.gym_get_visits(current_date-5,current_date);
  END IF;
END $post_delete_rpc$;
RESET ROLE;

-- Delete both accounts in sequence. First deletion above retained user 2's set;
-- deleting that final survivor cascades their private data but keeps the now
-- unlinked closed session row. This also verifies no dangling active lock/link.
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000002';
DO $both_deleted$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gym_sessions WHERE id='91000000-0000-4000-8000-000000000001' AND status='closed' AND host_id IS NULL AND closed_at IS NOT NULL AND invite_code IS NULL AND invite_expires_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id='91000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id='91000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.gym_sets WHERE session_id='91000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.gym_visits WHERE user_id='90000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'ASSERT: sequential deletion of both participants removed session or retained personal data';
  END IF;
END $both_deleted$;

-- A surviving participant is no longer active/locked and can use the actual
-- create RPC to form a fresh session; neither old consent nor relationship returns.
SET ROLE authenticated;
DO $survivor_rejoin$
DECLARE snap jsonb; fresh_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000003","is_anonymous":false}',false);
  IF public.gym_get_snapshot() IS NOT NULL THEN RAISE EXCEPTION 'ASSERT: survivor has an active membership after deletion'; END IF;
  snap := public.gym_create_session('Fresh after deletion'); fresh_id := (snap->>'id')::uuid;
  IF fresh_id IS NULL OR snap->>'status' <> 'waiting' OR snap->>'inviteCode' IS NULL
     OR snap#>>'{own,sharing}' <> 'false'
     OR snap#>>'{own,visitSharing,counts}' <> 'false' OR snap#>>'{own,visitSharing,days}' <> 'false' THEN
    RAISE EXCEPTION 'ASSERT: survivor could not create a fresh private session: %',snap;
  END IF;
  IF fresh_id='91000000-0000-4000-8000-000000000002' THEN RAISE EXCEPTION 'ASSERT: fresh session reused old session ID'; END IF;
END $survivor_rejoin$;
RESET ROLE;

ROLLBACK;
\echo 'PASS: gym account deletion regression checks (transaction rolled back)'
