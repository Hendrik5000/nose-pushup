-- Synthetic-only contract for the local 20261026093000 friend battle candidate.
-- The runner starts a disposable socket-only PostgreSQL cluster; no user rows exist.
\set ON_ERROR_STOP on
BEGIN;
\ir ../supabase/migrations/20261026093000_friend_battle_invitations.sql

CREATE FUNCTION pg_temp.assert_true(ok boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TEST FAILED: %', label USING ERRCODE = 'P0001';
  END IF;
END;
$$;
CREATE FUNCTION pg_temp.assert_raises(statement text, allowed_states text[], label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
    IF actual_state = ANY (allowed_states) THEN RETURN; END IF;
    RAISE EXCEPTION 'TEST FAILED: %; expected SQLSTATE in %, got %', label, allowed_states, actual_state
      USING ERRCODE = 'P0001';
  END;
  RAISE EXCEPTION 'TEST FAILED: %; statement unexpectedly succeeded', label USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION pg_temp.inspect_invitation(p_id uuid)
RETURNS TABLE (status text, battle_id uuid, created_at timestamptz, expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.status, i.battle_id, i.created_at, i.expires_at
  FROM public.friend_battle_invitations AS i WHERE i.id = p_id
$$;

INSERT INTO auth.users (id, is_anonymous) VALUES
  ('11000000-0000-4000-8000-000000000001', false),
  ('22000000-0000-4000-8000-000000000002', false),
  ('33000000-0000-4000-8000-000000000003', false),
  ('44000000-0000-4000-8000-000000000004', false),
  ('77000000-0000-4000-8000-000000000007', true);
INSERT INTO public.profiles (id, display_name, avatar_url, level, best_count) VALUES
  ('11000000-0000-4000-8000-000000000001', 'Host A', NULL, 12, 88),
  ('22000000-0000-4000-8000-000000000002', 'Friend B', 'b.png', 99, 999),
  ('33000000-0000-4000-8000-000000000003', 'Stranger C', NULL, 50, 500),
  ('44000000-0000-4000-8000-000000000004', 'Friend D', NULL, 7, 42),
  ('77000000-0000-4000-8000-000000000007', 'Guest', NULL, 1, 1);
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES
  ('11000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', 'accepted'),
  ('44000000-0000-4000-8000-000000000004', '22000000-0000-4000-8000-000000000002', 'accepted'),
  ('11000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000003', 'pending');

-- Only accepted, registered friends can receive invitations. Self-invites and bad
-- settings fail before any invitation/battle row is allocated.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","is_anonymous":false}', true);
SELECT pg_temp.assert_raises(
  $$SELECT public.create_friend_battle_invitation('33000000-0000-4000-8000-000000000003', 'timed', 60, 0)$$,
  ARRAY['42501'], 'pending/non-friend cannot receive an invitation'
);
SELECT pg_temp.assert_raises(
  $$SELECT public.create_friend_battle_invitation('11000000-0000-4000-8000-000000000001', 'timed', 60, 0)$$,
  ARRAY['P0001'], 'self-invitation is rejected'
);
SELECT pg_temp.assert_raises(
  $$SELECT public.create_friend_battle_invitation('22000000-0000-4000-8000-000000000002', 'timed', 1000, 0)$$,
  ARRAY['P0001'], 'out-of-range battle settings are rejected'
);
SELECT set_config('test.invite_accept',
  public.create_friend_battle_invitation('22000000-0000-4000-8000-000000000002', 'first_to', 180, 30)::text, true);
SELECT pg_temp.assert_true(
  (SELECT status = 'pending' AND battle_id IS NULL AND expires_at - created_at BETWEEN interval '23 hours 59 minutes' AND interval '24 hours 1 minute'
   FROM pg_temp.inspect_invitation(current_setting('test.invite_accept')::uuid)),
  'created invite is pending, unbound to a battle, and expires after 24 hours'
);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.battles), 'sending an invite does not create or start a battle');
SELECT pg_temp.assert_raises(
  $$SELECT * FROM public.friend_battle_invitations$$,
  ARRAY['42501'], 'browser role cannot directly read invitation rows'
);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.get_my_pending_battle_invitations()), 'sender cannot read recipient inbox');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.respond_to_friend_battle_invitation(current_setting('test.invite_accept')::uuid, true)), 'sender cannot accept the recipient invitation');
RESET ROLE;

-- A reciprocal pending invitation cannot disclose or duplicate the pair. A sender
-- or unrelated account cannot accept someone else's pending invitation.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000002","is_anonymous":false}', true);
SELECT pg_temp.assert_raises(
  $$SELECT public.create_friend_battle_invitation('11000000-0000-4000-8000-000000000001', 'timed', 60, 0)$$,
  ARRAY['P0001'], 'duplicate reverse-direction pending invite is rejected'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1 AND bool_and(sender_display_name = 'Host A' AND sender_avatar_url IS NULL AND mode = 'first_to' AND duration_s = 180 AND target_reps = 30)
   FROM public.get_my_pending_battle_invitations()),
  'recipient inbox returns only the safe sender identity and battle settings'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '33000000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"33000000-0000-4000-8000-000000000003","is_anonymous":false}', true);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.get_my_pending_battle_invitations()), 'stranger sees no pending invitation');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.respond_to_friend_battle_invitation(current_setting('test.invite_accept')::uuid, true)), 'stranger cannot answer an invitation');
RESET ROLE;

-- Only the intended friend can accept. Acceptance creates a waiting battle with
-- the recipient fixed as guest; it does not auto-start or reveal its row to C.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000002","is_anonymous":false}', true);
SELECT set_config('test.accepted_battle', b.battle_id::text, true)
FROM public.respond_to_friend_battle_invitation(current_setting('test.invite_accept')::uuid, true) AS b
WHERE b.result = 'accepted';
SELECT pg_temp.assert_true(current_setting('test.accepted_battle')::uuid IS NOT NULL, 'recipient acceptance returns the created battle id');
SELECT pg_temp.assert_true(
  (SELECT host_id = '11000000-0000-4000-8000-000000000001'
      AND guest_id = '22000000-0000-4000-8000-000000000002'
      AND status = 'waiting' AND is_bot IS FALSE AND mode = 'first_to'
      AND duration_s = 180 AND target_reps = 30
   FROM public.battles WHERE id = current_setting('test.accepted_battle')::uuid),
  'acceptance reserves the addressed opponent and preserves the configured battle without starting it'
);
SELECT pg_temp.assert_true(
  (SELECT status = 'accepted' AND battle_id = current_setting('test.accepted_battle')::uuid
   FROM pg_temp.inspect_invitation(current_setting('test.invite_accept')::uuid)),
  'accepted invite records its battle and terminal status'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","is_anonymous":false}', true);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1 AND bool_and(status = 'accepted' AND battle_id = current_setting('test.accepted_battle')::uuid)
   FROM public.get_my_sent_friend_battle_invitations()),
  'sender can find the accepted waiting battle from only their own invitation status'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '33000000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"33000000-0000-4000-8000-000000000003","is_anonymous":false}', true);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.battles WHERE id = current_setting('test.accepted_battle')::uuid), 'stranger cannot read a waiting friend battle');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.get_my_sent_friend_battle_invitations()), 'stranger cannot read another users outgoing invitation status');
RESET ROLE;

-- A different accepted pair can decline. Declining creates no battle; sender-only
-- cancellation is also idempotent and cannot be forged by the recipient.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '44000000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims', '{"sub":"44000000-0000-4000-8000-000000000004","is_anonymous":false}', true);
SELECT set_config('test.invite_decline', public.create_friend_battle_invitation('22000000-0000-4000-8000-000000000002', 'sprint', 60, 0)::text, true);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000002","is_anonymous":false}', true);
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.respond_to_friend_battle_invitation(current_setting('test.invite_decline')::uuid, false) WHERE result = 'declined' AND battle_id IS NULL), 'recipient may decline without allocating a battle');
SELECT pg_temp.assert_true((SELECT status = 'declined' AND battle_id IS NULL FROM pg_temp.inspect_invitation(current_setting('test.invite_decline')::uuid)), 'decline is terminal and does not bind a battle');
SELECT pg_temp.assert_true(public.cancel_my_friend_battle_invitation(current_setting('test.invite_decline')::uuid) IS FALSE, 'recipient cannot cancel a sender-owned invitation');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","is_anonymous":false}', true);
SELECT set_config('test.invite_cancel', public.create_friend_battle_invitation('22000000-0000-4000-8000-000000000002', 'timed', 60, 0)::text, true);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000002","is_anonymous":false}', true);
SELECT pg_temp.assert_true(public.cancel_my_friend_battle_invitation(current_setting('test.invite_cancel')::uuid) IS FALSE, 'recipient cannot cancel a pending invitation');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","is_anonymous":false}', true);
SELECT pg_temp.assert_true(public.cancel_my_friend_battle_invitation(current_setting('test.invite_cancel')::uuid), 'sender can cancel while pending');
SELECT pg_temp.assert_true((SELECT status = 'cancelled' FROM pg_temp.inspect_invitation(current_setting('test.invite_cancel')::uuid)), 'sender cancellation is recorded');
RESET ROLE;

-- Expiry is enforced by recipient response and inbox reads. A previously sent
-- invitation cannot start a battle after its 24-hour deadline.
SELECT set_config('test.invite_expired', public.create_friend_battle_invitation('22000000-0000-4000-8000-000000000002', 'timed', 60, 0)::text, true);
UPDATE public.friend_battle_invitations
SET created_at = clock_timestamp() - interval '25 hours',
    expires_at = clock_timestamp() - interval '1 second'
WHERE id = current_setting('test.invite_expired')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000002","is_anonymous":false}', true);
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.respond_to_friend_battle_invitation(current_setting('test.invite_expired')::uuid, true) WHERE result = 'expired' AND battle_id IS NULL), 'expired invitation is marked and cannot be accepted');
SELECT pg_temp.assert_true((SELECT status = 'expired' FROM pg_temp.inspect_invitation(current_setting('test.invite_expired')::uuid)), 'expired state is persisted');
RESET ROLE;

-- Revoking friendship before acceptance cancels the invite and never starts a battle.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","is_anonymous":false}', true);
SELECT set_config('test.invite_revoked', public.create_friend_battle_invitation('22000000-0000-4000-8000-000000000002', 'endurance', 300, 0)::text, true);
RESET ROLE;
DELETE FROM public.friendships
WHERE requester_id = '11000000-0000-4000-8000-000000000001'
  AND addressee_id = '22000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000002","is_anonymous":false}', true);
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.respond_to_friend_battle_invitation(current_setting('test.invite_revoked')::uuid, true) WHERE result = 'cancelled' AND battle_id IS NULL), 'friendship revoked before response safely cancels the invite');
SELECT pg_temp.assert_true((SELECT status = 'cancelled' AND battle_id IS NULL FROM pg_temp.inspect_invitation(current_setting('test.invite_revoked')::uuid)), 'revoked friendship cannot allocate a battle');
RESET ROLE;

-- Anonymous users cannot send, list, or answer; anon has no execute grant.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '77000000-0000-4000-8000-000000000007', true);
SELECT set_config('request.jwt.claims', '{"sub":"77000000-0000-4000-8000-000000000007","is_anonymous":true}', true);
SELECT pg_temp.assert_raises(
  $$SELECT public.create_friend_battle_invitation('22000000-0000-4000-8000-000000000002', 'timed', 60, 0)$$,
  ARRAY['42501'], 'anonymous user cannot send friend battle invitation'
);
SELECT pg_temp.assert_raises(
  $$SELECT * FROM public.get_my_pending_battle_invitations()$$,
  ARRAY['42501'], 'anonymous user cannot read the invitation inbox'
);
SELECT pg_temp.assert_raises(
  $$SELECT * FROM public.get_my_sent_friend_battle_invitations()$$,
  ARRAY['42501'], 'anonymous user cannot read sent invitation status'
);
SELECT pg_temp.assert_raises(
  $$SELECT * FROM public.respond_to_friend_battle_invitation(current_setting('test.invite_accept')::uuid, true)$$,
  ARRAY['42501'], 'anonymous user cannot respond to a friend battle invitation'
);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
SELECT pg_temp.assert_raises(
  $$SELECT public.get_my_pending_battle_invitations()$$,
  ARRAY['42501'], 'anon role cannot execute the inbox RPC'
);
RESET ROLE;

ROLLBACK;
