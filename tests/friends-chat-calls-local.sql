-- Local-only SQL assertions for the friend code / Postfach / Nexus / calls migrations.
-- Run against a scratch database that already has the repository migrations
-- applied (see tests/friends-chat-calls-local-db.sh). Never run against a live database.
-- Plain SQL/plpgsql only (no psql meta-commands) so it also runs through any client.

DROP SCHEMA IF EXISTS t CASCADE;
CREATE SCHEMA t;

CREATE FUNCTION t.login(p_user uuid, p_anonymous boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, false);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, false);
  EXECUTE 'SET ROLE authenticated';
END $$;

CREATE FUNCTION t.logout() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', false);
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

-- Run a statement as the current role and require that it fails.
CREATE FUNCTION t.must_fail(p_sql text, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'ASSERT FAILED (expected an error): %', p_label;
END $$;

CREATE FUNCTION t.eq(p_actual anyelement, p_expected anyelement, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'ASSERT FAILED: % (got %, expected %)', p_label, p_actual, p_expected;
  END IF;
END $$;

CREATE FUNCTION t.n(p_sql text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE r bigint;
BEGIN EXECUTE p_sql INTO r; RETURN r; END $$;

GRANT USAGE ON SCHEMA t TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO authenticated;

-- Users ------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'a1@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'a2@example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'a3@example.test'),
  ('00000000-0000-4000-8000-0000000000a4', 'a4@example.test'),
  ('00000000-0000-4000-8000-0000000000a5', 'a5@example.test'),
  ('00000000-0000-4000-8000-0000000000a7', 'a7@example.test')
ON CONFLICT (id) DO NOTHING;
UPDATE auth.users SET is_anonymous = true WHERE id = '00000000-0000-4000-8000-0000000000a7';
INSERT INTO public.profiles (id, display_name) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'Anna'),
  ('00000000-0000-4000-8000-0000000000a2', 'Ben'),
  ('00000000-0000-4000-8000-0000000000a3', 'Cem'),
  ('00000000-0000-4000-8000-0000000000a4', 'Dora'),
  ('00000000-0000-4000-8000-0000000000a5', 'Emil'),
  ('00000000-0000-4000-8000-0000000000a7', 'Gast')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- 1. Friend codes --------------------------------------------------------
DO $$
DECLARE c1 text; c1b text; c2 text; c3 text;
BEGIN
  PERFORM t.login('00000000-0000-4000-8000-0000000000a1');
  c1 := public.get_my_friend_code();
  c1b := public.get_my_friend_code();
  PERFORM t.eq(c1 ~ '^[A-HJ-KM-NP-Z2-9]{8}$', true, 'friend code format');
  PERFORM t.eq(c1b, c1, 'friend code is stable');
  PERFORM t.must_fail('SELECT * FROM public.friend_codes', 'clients cannot read friend_codes');
  PERFORM t.must_fail('SELECT * FROM public.friend_code_attempts', 'clients cannot read attempts');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a2');
  c2 := public.get_my_friend_code();
  PERFORM t.eq(c2 <> c1, true, 'codes differ per user');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a7', true);
  PERFORM t.must_fail('SELECT public.get_my_friend_code()', 'anonymous account has no friend code');
  PERFORM t.must_fail($q$SELECT public.send_friend_request_by_code('AAAAAAAA')$q$, 'anonymous account cannot send requests');
  PERFORM t.logout();

  PERFORM set_config('t.c1', c1, false);
  PERFORM set_config('t.c2', c2, false);
END $$;

-- 2. Direct friendship writes are closed ----------------------------------
DO $$
BEGIN
  PERFORM t.login('00000000-0000-4000-8000-0000000000a3');
  PERFORM t.must_fail($q$INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a1', 'accepted')$q$,
    'client cannot self-insert an accepted friendship');
  PERFORM t.must_fail($q$INSERT INTO public.friendships (requester_id, addressee_id)
    VALUES ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a1')$q$,
    'client cannot insert any friendship directly');
  PERFORM t.logout();
  -- owner-level guard too
  PERFORM t.must_fail($q$INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a1', 'accepted')$q$,
    'trigger rejects accepted-on-insert even for the owner');
  PERFORM t.must_fail($q$INSERT INTO public.friendships (requester_id, addressee_id)
    VALUES ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a3')$q$,
    'self friendship rejected');
END $$;

-- 3. Request by code -> Postfach -> accept ---------------------------------
DO $$
DECLARE
  c1 text := current_setting('t.c1');
  c2 text := current_setting('t.c2');
  r jsonb;
  fid uuid;
  item record;
BEGIN
  PERFORM t.login('00000000-0000-4000-8000-0000000000a2');
  r := public.send_friend_request_by_code(lower(substr(c1, 1, 4) || '-' || substr(c1, 5)));
  PERFORM t.eq(r ->> 'status', 'sent', 'request by lowercase/dashed code');
  PERFORM t.eq(r ->> 'to_name', 'Anna', 'sender sees recipient name');
  fid := (r ->> 'friendship_id')::uuid;
  PERFORM t.eq(public.send_friend_request_by_code(c1) ->> 'status', 'already_sent', 'duplicate request');
  PERFORM t.eq(t.n($q$SELECT count(*) FROM public.postfach_items$q$), 0::bigint, 'requester has no inbox item');
  PERFORM t.eq((SELECT count(*) FROM public.get_my_sent_friend_requests()), 1::bigint, 'sent list shows request');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a1');
  PERFORM t.eq(public.send_friend_request_by_code(c2) ->> 'status', 'incoming_pending', 'reverse request is not auto-accepted');
  PERFORM t.eq(public.send_friend_request_by_code(c1) ->> 'status', 'own_code', 'own code');
  SELECT * INTO item FROM public.postfach_items WHERE kind = 'friend_request';
  PERFORM t.eq(item.ref_id, fid, 'inbox item references friendship');
  PERFORM t.eq(item.payload ->> 'from_name', 'Ben', 'inbox item shows requester name');
  PERFORM t.eq(item.resolved_at IS NULL, true, 'item unresolved');
  PERFORM t.must_fail($q$UPDATE public.postfach_items SET payload = '{}'::jsonb$q$, 'client cannot edit inbox payload');
  PERFORM t.must_fail($q$INSERT INTO public.postfach_items (user_id, kind) VALUES (auth.uid(), 'friend_request')$q$, 'client cannot insert inbox items');
  UPDATE public.postfach_items SET read_at = now() WHERE id = item.id;
  PERFORM t.logout();

  -- strangers and the requester cannot answer
  PERFORM t.login('00000000-0000-4000-8000-0000000000a3');
  PERFORM t.eq(public.respond_to_friend_request(fid, true), 'stale', 'stranger cannot accept');
  PERFORM t.eq(t.n($q$SELECT count(*) FROM public.postfach_items$q$), 0::bigint, 'stranger sees no items');
  PERFORM t.logout();
  PERFORM t.login('00000000-0000-4000-8000-0000000000a2');
  PERFORM t.eq(public.respond_to_friend_request(fid, true), 'stale', 'requester cannot accept own request');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a1');
  PERFORM t.eq(public.respond_to_friend_request(fid, true), 'accepted', 'addressee accepts');
  PERFORM t.eq(public.respond_to_friend_request(fid, true), 'stale', 'second answer is stale');
  PERFORM t.eq((SELECT resolution FROM public.postfach_items WHERE id = item.id), 'accepted', 'item resolved as accepted');
  PERFORM t.eq(public.are_friends('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'), true, 'are_friends');
  PERFORM t.eq(public.are_friends('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3'), false, 'are_friends refuses questions not involving caller');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a2');
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'friend_accepted' AND payload ->> 'from_name' = 'Anna'), 1::bigint, 'requester is told about acceptance');
  PERFORM t.eq(public.send_friend_request_by_code(c1) ->> 'status', 'already_friends', 'already friends');
  PERFORM t.logout();
END $$;

-- 4. Decline cool-down, re-invite by decliner, withdraw --------------------
DO $$
DECLARE
  c1 text := current_setting('t.c1');
  c4 text;
  r jsonb;
  fid uuid;
BEGIN
  PERFORM t.login('00000000-0000-4000-8000-0000000000a4');
  c4 := public.get_my_friend_code();
  r := public.send_friend_request_by_code(c1);
  fid := (r ->> 'friendship_id')::uuid;
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a1');
  PERFORM t.eq(public.respond_to_friend_request(fid, false), 'declined', 'decline');
  PERFORM t.eq((SELECT resolution FROM public.postfach_items WHERE ref_id = fid), 'declined', 'item resolved as declined');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a4');
  PERFORM t.eq(public.send_friend_request_by_code(c1) ->> 'status', 'unavailable', '7 day cool-down after decline');
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'friend_accepted'), 0::bigint, 'decliner is not notified');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a1');
  r := public.send_friend_request_by_code(c4);
  PERFORM t.eq(r ->> 'status', 'sent', 'decliner may invite the other person');
  PERFORM t.logout();
  PERFORM t.login('00000000-0000-4000-8000-0000000000a4');
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'friend_request' AND resolved_at IS NULL), 1::bigint, 'reverse invite reaches inbox');
  PERFORM t.logout();

  -- withdraw
  PERFORM t.login('00000000-0000-4000-8000-0000000000a5');
  r := public.send_friend_request_by_code(c1);
  fid := (r ->> 'friendship_id')::uuid;
  PERFORM t.logout();
  PERFORM t.login('00000000-0000-4000-8000-0000000000a3');
  PERFORM t.eq(public.withdraw_friend_request(fid), false, 'stranger cannot withdraw');
  PERFORM t.logout();
  PERFORM t.login('00000000-0000-4000-8000-0000000000a5');
  PERFORM t.eq(public.withdraw_friend_request(fid), true, 'requester withdraws');
  PERFORM t.logout();
  PERFORM t.login('00000000-0000-4000-8000-0000000000a1');
  PERFORM t.eq((SELECT resolution FROM public.postfach_items WHERE ref_id = fid), 'cancelled', 'withdrawn request resolves the inbox item');
  PERFORM t.logout();
END $$;

-- 5. Brute force protection + regeneration ----------------------------------
DO $$
DECLARE
  c1 text := current_setting('t.c1');
  i integer;
  fresh text;
BEGIN
  PERFORM t.login('00000000-0000-4000-8000-0000000000a3');
  FOR i IN 1..10 LOOP
    PERFORM t.eq(public.send_friend_request_by_code('ZZZZZZZ' || i::text) ->> 'status', 'invalid_code', 'invalid code ' || i);
  END LOOP;
  PERFORM t.eq(public.send_friend_request_by_code(c1) ->> 'status', 'too_many_attempts', 'blocked after 10 failures');
  PERFORM t.logout();

  PERFORM t.login('00000000-0000-4000-8000-0000000000a1');
  fresh := public.regenerate_my_friend_code();
  PERFORM t.eq(fresh <> c1, true, 'regenerated code differs');
  PERFORM t.eq(public.get_my_friend_code(), fresh, 'new code is returned');
  PERFORM t.logout();
  PERFORM t.login('00000000-0000-4000-8000-0000000000a5');
  PERFORM t.eq(public.send_friend_request_by_code(c1) ->> 'status', 'invalid_code', 'old code no longer works');
  PERFORM t.logout();
END $$;

-- 6. Nexus: DMs only between friends --------------------------------------
DO $$
DECLARE
  a1 uuid := '00000000-0000-4000-8000-0000000000a1';
  a2 uuid := '00000000-0000-4000-8000-0000000000a2';
  a3 uuid := '00000000-0000-4000-8000-0000000000a3';
  dm uuid; dm2 uuid; mid uuid; grp uuid;
BEGIN
  PERFORM t.login(a1);
  dm := public.get_or_create_dm(a2);
  dm2 := public.get_or_create_dm(a2);
  PERFORM t.eq(dm2, dm, 'DM is reused');
  PERFORM t.must_fail(format('SELECT public.get_or_create_dm(%L)', a3), 'DM with a non-friend is refused');
  PERFORM t.must_fail(format($q$INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (%L, %L)$q$, dm, a1), 'clients cannot add conversation members');
  PERFORM t.must_fail(format('SELECT public.create_group(%L, ARRAY[%L]::uuid[])', 'Mix', a3), 'group with non-friend refused');
  grp := public.create_group('Duo', ARRAY[a2]::uuid[]);
  PERFORM t.eq(grp IS NOT NULL, true, 'group with friend');
  INSERT INTO public.messages (conversation_id, user_id, content) VALUES (dm, a1, 'Hallo Ben') RETURNING id INTO mid;
  PERFORM t.eq((SELECT count(*) FROM public.get_my_dms()), 1::bigint, 'get_my_dms lists the DM');
  PERFORM t.eq((SELECT other_name FROM public.get_my_dms()), 'Ben', 'get_my_dms shows the friend name');
  PERFORM t.logout();

  PERFORM t.login(a2);
  PERFORM t.eq(t.n(format($q$SELECT count(*) FROM public.messages WHERE id = %L$q$, mid)), 1::bigint, 'friend can read the DM');
  INSERT INTO public.messages (conversation_id, user_id, content) VALUES (dm, a2, 'Hi Anna');
  INSERT INTO public.message_reactions (message_id, user_id, emoji) VALUES (mid, a2, '👍');
  PERFORM t.eq((SELECT other_name FROM public.get_my_dms()), 'Anna', 'second side sees the first name');
  PERFORM t.logout();

  PERFORM t.login(a3);
  PERFORM t.eq(t.n(format($q$SELECT count(*) FROM public.messages WHERE conversation_id = %L$q$, dm)), 0::bigint, 'stranger cannot read the DM');
  PERFORM t.eq(t.n(format($q$SELECT count(*) FROM public.message_reactions WHERE message_id = %L$q$, mid)), 0::bigint, 'stranger cannot see reactions');
  PERFORM t.must_fail(format($q$INSERT INTO public.messages (conversation_id, user_id, content) VALUES (%L, %L, 'x')$q$, dm, a3), 'stranger cannot write into the DM');
  PERFORM t.must_fail(format($q$INSERT INTO public.notifications (user_id, type, actor_id) VALUES (%L, 'mention', %L)$q$, a1, a3), 'clients cannot create notifications for others');
  PERFORM t.eq((SELECT count(*) FROM public.get_chat_display_names(ARRAY[a1, a2, a3])), 1::bigint, 'display names only for visible people');
  PERFORM t.logout();

  PERFORM t.login(a1);
  PERFORM t.eq((SELECT count(*) FROM public.get_chat_display_names(ARRAY[a1, a2, a3])), 2::bigint, 'friend names are visible');
  PERFORM set_config('t.dm', dm::text, false);
  PERFORM set_config('t.mid', mid::text, false);
  PERFORM t.logout();
END $$;

-- 7. Images -----------------------------------------------------------------
DO $$
DECLARE
  a1 uuid := '00000000-0000-4000-8000-0000000000a1';
  a2 uuid := '00000000-0000-4000-8000-0000000000a2';
  a3 uuid := '00000000-0000-4000-8000-0000000000a3';
  dm uuid := current_setting('t.dm')::uuid;
  path text := a1 || '/conv-' || dm || '/11111111-2222-4333-8444-555555555555.jpg';
  mid uuid;
BEGIN
  PERFORM t.login(a1);
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('chat-uploads', path, a1);
  INSERT INTO public.messages (conversation_id, user_id, content, attachment_url, attachment_type, attachment_name, attachment_size)
  VALUES (dm, a1, '', path, 'image/jpeg', 'foto.jpg', 120000) RETURNING id INTO mid;
  PERFORM t.must_fail(format($q$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('chat-uploads', %L, %L)$q$,
    a2 || '/conv-' || dm || '/11111111-2222-4333-8444-555555555556.jpg', a1), 'cannot upload into another user folder');
  PERFORM t.must_fail(format($q$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('chat-uploads', %L, %L)$q$,
    a1 || '/conv-' || dm || '/11111111-2222-4333-8444-555555555557.exe', a1), 'only image extensions');
  PERFORM t.must_fail(format($q$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('chat-uploads', %L, %L)$q$,
    a1 || '/conv-00000000-0000-4000-8000-00000000dead/11111111-2222-4333-8444-555555555558.jpg', a1), 'cannot upload into a foreign conversation');
  PERFORM t.must_fail(format($q$INSERT INTO public.messages (conversation_id, user_id, content, attachment_url, attachment_type, attachment_size)
    VALUES (%L, %L, '', %L, 'image/jpeg', 100)$q$, dm, a1, a2 || '/conv-' || dm || '/11111111-2222-4333-8444-555555555559.jpg'), 'attachment path must start with the sender');
  PERFORM t.must_fail(format($q$INSERT INTO public.messages (conversation_id, user_id, content, attachment_url, attachment_type, attachment_size)
    VALUES (%L, %L, '', %L, 'text/html', 100)$q$, dm, a1, a1 || '/conv-' || dm || '/11111111-2222-4333-8444-555555555560.jpg'), 'attachment type');
  PERFORM t.must_fail(format($q$INSERT INTO public.messages (conversation_id, user_id, content, attachment_url, attachment_type, attachment_size)
    VALUES (%L, %L, '', %L, 'image/jpeg', 6000000)$q$, dm, a1, a1 || '/conv-' || dm || '/11111111-2222-4333-8444-555555555561.jpg'), 'attachment size');
  PERFORM t.must_fail(format($q$UPDATE public.messages SET attachment_url = %L WHERE id = %L$q$, a1 || '/conv-' || dm || '/99999999-2222-4333-8444-555555555555.jpg', mid), 'attachment fields are immutable');
  UPDATE public.messages SET content = 'Bildtext' WHERE id = mid;
  PERFORM t.eq((SELECT content FROM public.messages WHERE id = mid), 'Bildtext', 'content stays editable');
  PERFORM t.logout();

  PERFORM t.login(a2);
  PERFORM t.eq(t.n(format($q$SELECT count(*) FROM storage.objects WHERE name = %L$q$, path)), 1::bigint, 'friend in the DM can read the image');
  PERFORM t.logout();
  PERFORM t.login(a3);
  PERFORM t.eq(t.n(format($q$SELECT count(*) FROM storage.objects WHERE name = %L$q$, path)), 0::bigint, 'stranger cannot read the image');
  PERFORM t.logout();

  -- unfriend: sending stops, history stays
  DELETE FROM public.friendships WHERE (requester_id = a1 AND addressee_id = a2) OR (requester_id = a2 AND addressee_id = a1);
  PERFORM t.login(a1);
  PERFORM t.must_fail(format($q$INSERT INTO public.messages (conversation_id, user_id, content) VALUES (%L, %L, 'noch da?')$q$, dm, a1), 'no new DM messages after unfriending');
  PERFORM t.eq(t.n(format($q$SELECT count(*) FROM public.messages WHERE conversation_id = %L$q$, dm)) >= 2, true, 'history stays readable');
  PERFORM t.eq((SELECT is_friend FROM public.get_my_dms()), false, 'DM list flags ended friendship');
  PERFORM t.logout();
  -- restore friendship for the following sections
  INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (a2, a1, 'pending');
  UPDATE public.friendships SET status = 'accepted' WHERE requester_id = a2 AND addressee_id = a1;
END $$;

-- 8. Calls ------------------------------------------------------------------
DO $$
DECLARE
  a1 uuid := '00000000-0000-4000-8000-0000000000a1';
  a2 uuid := '00000000-0000-4000-8000-0000000000a2';
  a3 uuid := '00000000-0000-4000-8000-0000000000a3';
  r jsonb; cid uuid;
BEGIN
  PERFORM t.login(a1);
  PERFORM t.eq(public.start_call(a3, 'audio') ->> 'status', 'not_friends', 'cannot call a non-friend');
  PERFORM t.eq(public.start_call(a2, 'telepathy') ->> 'status', 'invalid_kind', 'invalid kind');
  r := public.start_call(a2, 'video');
  PERFORM t.eq(r ->> 'status', 'ringing', 'call rings');
  cid := (r ->> 'call_id')::uuid;
  PERFORM t.eq(public.start_call(a2, 'audio') ->> 'status', 'already_in_call', 'caller is busy');
  PERFORM t.must_fail($q$INSERT INTO public.calls (caller_id, callee_id, kind) VALUES (auth.uid(), auth.uid(), 'audio')$q$, 'clients cannot write calls');
  PERFORM t.eq(public.send_call_signal(cid, 'offer', '{"sdp":"v=0"}'::jsonb), true, 'caller sends offer');
  PERFORM t.eq(public.send_call_signal(cid, 'answer', '{"sdp":"v=0"}'::jsonb), false, 'caller cannot send an answer');
  PERFORM t.logout();

  PERFORM t.login(a3);
  PERFORM t.eq(public.send_call_signal(cid, 'candidate', '{"c":1}'::jsonb), false, 'stranger cannot signal');
  PERFORM t.eq(public.respond_to_call(cid, true), 'stale', 'stranger cannot answer');
  PERFORM t.eq(t.n($q$SELECT count(*) FROM public.calls$q$), 0::bigint, 'stranger sees no calls');
  PERFORM t.eq(t.n($q$SELECT count(*) FROM public.call_signals$q$), 0::bigint, 'stranger sees no signals');
  PERFORM t.logout();

  PERFORM t.login(a2);
  PERFORM t.eq((SELECT count(*) FROM public.get_my_incoming_calls()), 1::bigint, 'callee sees incoming call');
  PERFORM t.eq((SELECT caller_name FROM public.get_my_incoming_calls()), 'Anna', 'incoming call shows caller name');
  PERFORM t.eq(public.send_call_signal(cid, 'answer', '{"sdp":"v=0"}'::jsonb), false, 'no answer before accepting');
  PERFORM t.eq(t.n($q$SELECT count(*) FROM public.call_signals$q$), 1::bigint, 'callee sees the offer');
  PERFORM t.eq(public.respond_to_call(cid, true), 'accepted', 'callee accepts');
  PERFORM t.eq(public.send_call_signal(cid, 'answer', '{"sdp":"v=0"}'::jsonb), true, 'callee answers');
  PERFORM t.eq(public.send_call_signal(cid, 'offer', '{"sdp":"v=0"}'::jsonb), false, 'callee cannot send an offer');
  PERFORM t.eq(public.start_call(a1, 'audio') ->> 'status', 'already_in_call', 'callee is busy too');
  PERFORM t.logout();

  PERFORM t.login(a1);
  PERFORM t.eq(t.n($q$SELECT count(*) FROM public.call_signals$q$), 1::bigint, 'caller sees only the answer');
  PERFORM t.eq(public.end_call(cid), 'ended', 'call ends');
  PERFORM t.eq(public.end_call(cid), 'ended', 'ending twice is harmless');
  PERFORM t.logout();
  PERFORM t.eq((SELECT count(*) FROM public.call_signals WHERE call_id = cid), 0::bigint, 'signals are removed after the call');

  -- cancelled while ringing => missed call for the callee
  PERFORM t.login(a1);
  r := public.start_call(a2, 'audio');
  cid := (r ->> 'call_id')::uuid;
  PERFORM t.eq(public.end_call(cid), 'cancelled', 'caller cancels');
  PERFORM t.logout();
  PERFORM t.login(a2);
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'missed_call' AND ref_id = cid), 1::bigint, 'missed call in the Postfach');
  PERFORM t.logout();

  -- declined: no missed-call item
  PERFORM t.login(a1);
  cid := (public.start_call(a2, 'audio') ->> 'call_id')::uuid;
  PERFORM t.logout();
  PERFORM t.login(a2);
  PERFORM t.eq(public.respond_to_call(cid, false), 'declined', 'callee declines');
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'missed_call' AND ref_id = cid), 0::bigint, 'declined call is not "missed"');
  PERFORM t.logout();

  -- timed out ringing call
  PERFORM t.login(a1);
  cid := (public.start_call(a2, 'audio') ->> 'call_id')::uuid;
  PERFORM t.logout();
  UPDATE public.calls SET created_at = now() - interval '5 minutes' WHERE id = cid;
  PERFORM t.login(a2);
  PERFORM t.eq((SELECT count(*) FROM public.get_my_incoming_calls()), 0::bigint, 'stale ringing call is not offered');
  PERFORM t.eq((SELECT status FROM public.calls WHERE id = cid), 'missed', 'stale call becomes missed');
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'missed_call' AND ref_id = cid), 1::bigint, 'timed-out call is in the Postfach');
  PERFORM t.logout();
END $$;

-- 9. Battle invitation bridge (only when that migration is part of the stack) -
DO $$
DECLARE
  a1 uuid := '00000000-0000-4000-8000-0000000000a1';
  a2 uuid := '00000000-0000-4000-8000-0000000000a2';
  inv uuid; resp record;
BEGIN
  IF to_regclass('public.friend_battle_invitations') IS NULL THEN
    RAISE NOTICE 'SKIP: friend_battle_invitations not present';
    RETURN;
  END IF;
  PERFORM t.eq(
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'battle_invitations_postfach_sync_trg'), true, 'bridge installed');
  PERFORM t.login(a1);
  inv := public.create_friend_battle_invitation(a2, 'timed', 60, 0);
  PERFORM t.logout();
  PERFORM t.login(a2);
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'battle_invitation' AND ref_id = inv AND resolved_at IS NULL), 1::bigint, 'battle invitation reaches the Postfach');
  PERFORM t.eq((SELECT payload ->> 'mode' FROM public.postfach_items WHERE ref_id = inv), 'timed', 'payload carries the mode');
  PERFORM public.respond_to_friend_battle_invitation(inv, true);
  PERFORM t.eq((SELECT resolution FROM public.postfach_items WHERE kind = 'battle_invitation' AND ref_id = inv), 'accepted', 'item resolved');
  PERFORM t.logout();
  PERFORM t.login(a1);
  PERFORM t.eq((SELECT count(*) FROM public.postfach_items WHERE kind = 'battle_accepted' AND ref_id = inv), 1::bigint, 'sender is told about acceptance');
  PERFORM t.logout();
END $$;

-- 10. get_friend_public_profiles only returns accepted friends ----------------
DO $$
DECLARE
  a1 uuid := '00000000-0000-4000-8000-0000000000a1';
  a2 uuid := '00000000-0000-4000-8000-0000000000a2';
  a3 uuid := '00000000-0000-4000-8000-0000000000a3';
BEGIN
  PERFORM t.login(a1);
  PERFORM t.eq((SELECT count(*) FROM public.get_friend_public_profiles(ARRAY[a2, a3, a1])), 1::bigint, 'only the accepted friend is returned');
  PERFORM t.eq((SELECT id FROM public.get_friend_public_profiles(ARRAY[a2, a3, a1])), a2, 'it is the friend');
  PERFORM t.logout();
  PERFORM t.login(a3);
  PERFORM t.eq((SELECT count(*) FROM public.get_friend_public_profiles(ARRAY[a1, a2])), 0::bigint, 'strangers cannot be looked up');
  PERFORM t.logout();
END $$;

DROP SCHEMA t CASCADE;
SELECT 'ALL ASSERTIONS PASSED' AS result;
