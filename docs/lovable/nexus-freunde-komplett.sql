-- Alo: Nexus Chat, Freunde, Postfach, Bilder, Anrufe.
-- Im Lovable SQL-Editor genau EINMAL komplett einfuegen und ausfuehren (Mehr > Database > Manage > SQL editor).


-- ===== 20261019010000_nexus_chat_schema.sql =====
-- Nexus Chat schema ported into Nose-Pushup (append-only)
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS patterns

-- Profile extras used by chat
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_text text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bubble_color text DEFAULT 'sky';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Conversations (DM + group)
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'dm',
  name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  attachment_size integer,
  link_preview jsonb,
  pinned_at timestamptz,
  CONSTRAINT messages_target_chk CHECK (
    (room_id IS NOT NULL AND conversation_id IS NULL)
    OR (room_id IS NULL AND conversation_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS messages_room_created_idx ON public.messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS messages_conv_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_content_fts ON public.messages USING gin (to_tsvector('german', content));

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, room_id),
  UNIQUE (user_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS public.room_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, room_id),
  UNIQUE (user_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'mention',
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper: conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conv uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv AND user_id = p_user
  );
$$;

-- get_or_create_dm
CREATE OR REPLACE FUNCTION public.get_or_create_dm(p_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  existing uuid;
  new_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_other IS NULL OR p_other = me THEN RAISE EXCEPTION 'invalid_other'; END IF;

  SELECT c.id INTO existing
  FROM public.conversations c
  WHERE c.kind = 'dm'
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = p_other)
  LIMIT 1;

  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.conversations (kind, created_by) VALUES ('dm', me) RETURNING id INTO new_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (new_id, me), (new_id, p_other);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_messages(q text)
RETURNS SETOF public.messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.* FROM public.messages m
  WHERE (m.room_id IS NOT NULL OR public.is_conversation_member(m.conversation_id, auth.uid()))
    AND to_tsvector('german', m.content) @@ plainto_tsquery('german', q)
  ORDER BY m.created_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.create_group(p_name text, p_members uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid(); conv uuid; m uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.conversations (kind, name, created_by)
  VALUES ('group', NULLIF(trim(p_name), ''), me) RETURNING id INTO conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv, me);
  FOREACH m IN ARRAY p_members LOOP
    IF m IS NOT NULL AND m <> me THEN
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES (conv, m) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN conv;
END;
$$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_mutes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_members TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.message_reactions TO service_role;
GRANT ALL ON public.message_reads TO service_role;
GRANT ALL ON public.room_mutes TO service_role;
GRANT ALL ON public.notifications TO service_role;

-- RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_auth" ON public.rooms;
CREATE POLICY "rooms_select_auth" ON public.rooms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rooms_insert_auth" ON public.rooms;
CREATE POLICY "rooms_insert_auth" ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "rooms_update_creator" ON public.rooms;
CREATE POLICY "rooms_update_creator" ON public.rooms FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "rooms_delete_creator" ON public.rooms;
CREATE POLICY "rooms_delete_creator" ON public.rooms FOR DELETE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "messages_select_visible" ON public.messages;
CREATE POLICY "messages_select_visible" ON public.messages FOR SELECT TO authenticated
  USING (
    room_id IS NOT NULL
    OR public.is_conversation_member(conversation_id, auth.uid())
  );
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      room_id IS NOT NULL
      OR public.is_conversation_member(conversation_id, auth.uid())
    )
  );
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_select" ON public.message_reactions;
CREATE POLICY "reactions_select" ON public.message_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "reactions_insert_own" ON public.message_reactions;
CREATE POLICY "reactions_insert_own" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "reactions_delete_own" ON public.message_reactions;
CREATE POLICY "reactions_delete_own" ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reads_all_own" ON public.message_reads;
CREATE POLICY "reads_all_own" ON public.message_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mutes_all_own" ON public.room_mutes;
CREATE POLICY "mutes_all_own" ON public.room_mutes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
CREATE POLICY "notifications_insert_auth" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "conversations_select_member" ON public.conversations;
CREATE POLICY "conversations_select_member" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));
DROP POLICY IF EXISTS "conversations_insert_auth" ON public.conversations;
CREATE POLICY "conversations_insert_auth" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "conv_members_select" ON public.conversation_members;
CREATE POLICY "conv_members_select" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) OR user_id = auth.uid());
DROP POLICY IF EXISTS "conv_members_insert" ON public.conversation_members;
CREATE POLICY "conv_members_insert" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) OR user_id = auth.uid());

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage bucket for chat uploads (id must exist; policies are idempotent-ish)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_uploads_select" ON storage.objects;
CREATE POLICY "chat_uploads_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-uploads');
DROP POLICY IF EXISTS "chat_uploads_insert" ON storage.objects;
CREATE POLICY "chat_uploads_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "chat_uploads_delete" ON storage.objects;
CREATE POLICY "chat_uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Seed default rooms (no users required)
INSERT INTO public.rooms (name, description)
SELECT v.name, v.description
FROM (VALUES
  ('Allgemein', 'Community-Chat für alle Nosy-Athleten'),
  ('Trainings-Tipps', 'Form, Sets, Recovery und Fragen')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.rooms r WHERE r.name = v.name);


-- ===== 20261020210000_chat_uploads_select_owner.sql =====
-- Restrict chat-uploads SELECT to the object owner folder (user id prefix).
-- Previously any authenticated user could list/read the whole bucket.

DROP POLICY IF EXISTS "chat_uploads_select" ON storage.objects;
CREATE POLICY "chat_uploads_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ===== 20261026090000_friendships_unordered_pair_index.sql =====
-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
--
-- Adds the unordered-pair uniqueness guarantee for public.friendships
-- (A->B and B->A can never both exist). The friend battle invitation migration
-- (20261026093000) and the friend-code migration (20261030100000) both expect
-- an index with exactly this name.
--
-- This migration deliberately FAILS (and changes nothing) when duplicate
-- opposite-direction friendships already exist. Resolve those rows manually
-- and deliberately; this migration never deletes user data.

DO $friendship_pair_preflight$
BEGIN
  IF pg_catalog.to_regclass('public.friendships') IS NULL THEN
    RAISE EXCEPTION 'FRIENDSHIP_PAIR_SCHEMA_MISMATCH: public.friendships is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.friendships
    GROUP BY LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'FRIENDSHIP_PAIR_DUPLICATES: opposite-direction friendship rows exist; review them manually before applying';
  END IF;
END;
$friendship_pair_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS friendships_one_unordered_pair_idx
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));


-- ===== 20261026093000_friend_battle_invitations.sql =====
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


-- ===== 20261030100000_friend_codes_postfach.sql =====
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


-- ===== 20261030110000_nexus_friend_chat_images.sql =====
-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
--
-- Nexus Chat for friends:
--  * Direct messages and group chats only between accepted friends.
--  * conversation_members can no longer be written by clients (previously any
--    signed-in user could add themselves to any conversation id).
--  * notifications can no longer be inserted for other users by clients.
--  * Image messages: private chat-uploads bucket (5 MB, images only); files are
--    readable by the sender and by members of the conversation they belong to.
--  * message_reactions are only visible for messages the viewer can see.
--
-- Requires 20261019010000_nexus_chat_schema.sql and 20261030100000_friend_codes_postfach.sql.

DO $nexus_friend_chat_preflight$
BEGIN
  IF pg_catalog.to_regclass('public.conversations') IS NULL
    OR pg_catalog.to_regclass('public.conversation_members') IS NULL
    OR pg_catalog.to_regclass('public.messages') IS NULL
    OR pg_catalog.to_regclass('public.rooms') IS NULL
    OR pg_catalog.to_regclass('public.friendships') IS NULL
    OR pg_catalog.to_regclass('public.postfach_items') IS NULL
    OR pg_catalog.to_regclass('storage.buckets') IS NULL
    OR pg_catalog.to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'NEXUS_FRIEND_CHAT_SCHEMA_MISMATCH: Nexus, friendships, postfach or storage tables are missing';
  END IF;
END;
$nexus_friend_chat_preflight$;

-- ---------------------------------------------------------------------------
-- Friendship helper (answers only for questions that involve the caller)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND a <> b
    AND auth.uid() IN (a, b)
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = a AND f.addressee_id = b) OR (f.requester_id = b AND f.addressee_id = a))
    )
$$;

REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- May the caller write into this conversation right now?
-- Group chats: any member. DMs: member AND still friends with the other member.
CREATE OR REPLACE FUNCTION public.can_post_in_conversation(p_conv uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.conversation_members m
        WHERE m.conversation_id = p_conv AND m.user_id = auth.uid()
      ) THEN false
      WHEN c.kind = 'dm' THEN EXISTS (
        SELECT 1 FROM public.conversation_members o
        WHERE o.conversation_id = p_conv AND o.user_id <> auth.uid()
          AND public.are_friends(auth.uid(), o.user_id)
      )
      ELSE true
    END
    FROM public.conversations c WHERE c.id = p_conv
  ), false)
$$;

REVOKE ALL ON FUNCTION public.can_post_in_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_post_in_conversation(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Conversations: friends only, members only via these functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_or_create_dm(p_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  existing uuid;
  new_id uuid;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;
  IF p_other IS NULL OR p_other = me THEN
    RAISE EXCEPTION 'invalid_other';
  END IF;
  IF NOT public.are_friends(me, p_other) THEN
    RAISE EXCEPTION 'not_friends' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('dm:' || LEAST(me, p_other)::text || GREATEST(me, p_other)::text, 0)
  );

  SELECT c.id INTO existing
  FROM public.conversations c
  WHERE c.kind = 'dm'
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = p_other)
  LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.conversations (kind, created_by) VALUES ('dm', me) RETURNING id INTO new_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (new_id, me), (new_id, p_other);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group(p_name text, p_members uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  conv uuid;
  m uuid;
BEGIN
  IF me IS NULL OR NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'registered_account_required' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(array_length(p_members, 1), 0) > 30 THEN
    RAISE EXCEPTION 'too_many_members';
  END IF;

  FOREACH m IN ARRAY COALESCE(p_members, ARRAY[]::uuid[]) LOOP
    IF m IS NOT NULL AND m <> me AND NOT public.are_friends(me, m) THEN
      RAISE EXCEPTION 'not_friends' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  INSERT INTO public.conversations (kind, name, created_by)
  VALUES ('group', NULLIF(pg_catalog.btrim(p_name), ''), me) RETURNING id INTO conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv, me);
  FOREACH m IN ARRAY COALESCE(p_members, ARRAY[]::uuid[]) LOOP
    IF m IS NOT NULL AND m <> me THEN
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES (conv, m) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN conv;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_dm(uuid), public.create_group(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(uuid), public.create_group(text, uuid[]) TO authenticated;

DROP POLICY IF EXISTS conv_members_insert ON public.conversation_members;
REVOKE INSERT, UPDATE ON public.conversation_members FROM anon, authenticated;

DROP POLICY IF EXISTS notifications_insert_auth ON public.notifications;
REVOKE INSERT ON public.notifications FROM anon, authenticated;

-- Direct messages of the caller (RLS does not expose the other person's
-- profile unless they are still friends, so names come from here).
CREATE OR REPLACE FUNCTION public.get_my_dms()
RETURNS TABLE (
  conversation_id uuid,
  other_id uuid,
  other_name text,
  other_avatar_url text,
  last_message_at timestamptz,
  is_friend boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.id,
         o.user_id,
         COALESCE(NULLIF(pg_catalog.btrim(p.display_name), ''), 'Freund'),
         p.avatar_url,
         c.last_message_at,
         public.are_friends(auth.uid(), o.user_id)
  FROM public.conversations c
  JOIN public.conversation_members mine
    ON mine.conversation_id = c.id AND mine.user_id = auth.uid()
  JOIN public.conversation_members o
    ON o.conversation_id = c.id AND o.user_id <> auth.uid()
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE c.kind = 'dm'
  ORDER BY c.last_message_at DESC
$$;

-- Display names for message authors: only people the caller may already see
-- (self, friends, shared conversation, or authors in the open rooms).
CREATE OR REPLACE FUNCTION public.get_chat_display_names(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id, COALESCE(NULLIF(pg_catalog.btrim(p.display_name), ''), 'Mitglied'), p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY (p_user_ids[1:100])
    AND auth.uid() IS NOT NULL
    AND (
      p.id = auth.uid()
      OR public.are_friends(auth.uid(), p.id)
      OR EXISTS (
        SELECT 1
        FROM public.conversation_members a
        JOIN public.conversation_members b ON b.conversation_id = a.conversation_id
        WHERE a.user_id = auth.uid() AND b.user_id = p.id
      )
      OR EXISTS (SELECT 1 FROM public.messages m WHERE m.user_id = p.id AND m.room_id IS NOT NULL)
    )
$$;

REVOKE ALL ON FUNCTION public.get_my_dms(), public.get_chat_display_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_dms(), public.get_chat_display_names(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (room_id IS NOT NULL OR public.can_post_in_conversation(conversation_id))
  );

-- Reactions only on messages the viewer can see (messages RLS applies here).
DROP POLICY IF EXISTS reactions_select ON public.message_reactions;
CREATE POLICY reactions_select ON public.message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id));

DO $messages_length_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_content_len_chk'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_content_len_chk CHECK (pg_catalog.char_length(content) <= 4000) NOT VALID;
  END IF;
END;
$messages_length_check$;

-- Attachment shape + immutability. Storage path convention:
--   <sender uuid>/conv-<conversation uuid>/<file uuid>.<jpg|png|webp|gif>
--   <sender uuid>/room-<room uuid>/<file uuid>.<jpg|png|webp|gif>
CREATE OR REPLACE FUNCTION public.messages_attachment_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  expected_prefix text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.room_id IS DISTINCT FROM OLD.room_id
      OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
      OR NEW.attachment_url IS DISTINCT FROM OLD.attachment_url
      OR NEW.attachment_type IS DISTINCT FROM OLD.attachment_type
      OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
      OR NEW.attachment_size IS DISTINCT FROM OLD.attachment_size THEN
      RAISE EXCEPTION 'message_target_and_attachment_immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.attachment_url IS NULL THEN
    IF NEW.attachment_type IS NOT NULL OR NEW.attachment_name IS NOT NULL OR NEW.attachment_size IS NOT NULL THEN
      RAISE EXCEPTION 'attachment_metadata_without_file' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  expected_prefix := NEW.user_id::text || '/' ||
    CASE WHEN NEW.room_id IS NOT NULL THEN 'room-' || NEW.room_id::text
         ELSE 'conv-' || NEW.conversation_id::text END || '/';

  IF pg_catalog.left(NEW.attachment_url, pg_catalog.length(expected_prefix)) <> expected_prefix
    OR pg_catalog.substr(NEW.attachment_url, pg_catalog.length(expected_prefix) + 1)
         !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$' THEN
    RAISE EXCEPTION 'attachment_path_invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW.attachment_type IS NULL
    OR NEW.attachment_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif') THEN
    RAISE EXCEPTION 'attachment_type_invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW.attachment_size IS NULL OR NEW.attachment_size <= 0 OR NEW.attachment_size > 5242880 THEN
    RAISE EXCEPTION 'attachment_size_invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW.attachment_name IS NOT NULL AND pg_catalog.char_length(NEW.attachment_name) > 200 THEN
    RAISE EXCEPTION 'attachment_name_invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_attachment_guard_trg ON public.messages;
CREATE TRIGGER messages_attachment_guard_trg
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_attachment_guard();

-- ---------------------------------------------------------------------------
-- Storage: private image bucket
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'chat-uploads';

-- Which conversation/room folder does this object belong to, and may the caller see it?
CREATE OR REPLACE FUNCTION public.can_read_chat_upload(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  folder_scope text := (storage.foldername(p_name))[2];
  target uuid;
BEGIN
  IF auth.uid() IS NULL OR folder_scope IS NULL THEN
    RETURN false;
  END IF;
  IF folder_scope !~ '^(conv|room)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  target := pg_catalog.substr(folder_scope, pg_catalog.strpos(folder_scope, '-') + 1)::uuid;
  IF pg_catalog.left(folder_scope, 5) = 'conv-' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.conversation_id = target AND m.user_id = auth.uid()
    );
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = target);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_chat_upload(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  folders text[] := storage.foldername(p_name);
  folder_scope text;
  target uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_registered_user() THEN
    RETURN false;
  END IF;
  IF COALESCE(array_length(folders, 1), 0) <> 2 OR folders[1] <> auth.uid()::text THEN
    RETURN false;
  END IF;
  IF p_name !~ '\.(jpg|png|webp|gif)$' THEN
    RETURN false;
  END IF;
  folder_scope := folders[2];
  IF folder_scope !~ '^(conv|room)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  target := pg_catalog.substr(folder_scope, pg_catalog.strpos(folder_scope, '-') + 1)::uuid;
  IF pg_catalog.left(folder_scope, 5) = 'conv-' THEN
    RETURN public.can_post_in_conversation(target);
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = target);
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_chat_upload(text), public.can_write_chat_upload(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_chat_upload(text), public.can_write_chat_upload(text) TO authenticated;

DROP POLICY IF EXISTS chat_uploads_select ON storage.objects;
CREATE POLICY chat_uploads_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.can_read_chat_upload(name))
  );

DROP POLICY IF EXISTS chat_uploads_insert ON storage.objects;
CREATE POLICY chat_uploads_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-uploads' AND public.can_write_chat_upload(name));

DROP POLICY IF EXISTS chat_uploads_delete ON storage.objects;
CREATE POLICY chat_uploads_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ===== 20261030120000_friend_calls.sql =====
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


-- ===== 20261030130000_friend_public_profiles.sql =====
-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
--
-- RPC used by the battle invitation client (src/lib/battle-invitation-client.ts):
-- name and avatar of the caller's ACCEPTED friends. It was referenced by the client but
-- not defined by any earlier migration. Requested ids that are not accepted friends of the
-- caller are silently omitted, so it cannot be used to look up strangers.

DO $friend_profiles_preflight$
BEGIN
  IF pg_catalog.to_regclass('public.friendships') IS NULL
    OR pg_catalog.to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'FRIEND_PROFILES_SCHEMA_MISMATCH: friendships and profiles are required';
  END IF;
END;
$friend_profiles_preflight$;

CREATE OR REPLACE FUNCTION public.get_friend_public_profiles(p_user_ids uuid[])
RETURNS TABLE (id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT f.friend_id,
         NULLIF(pg_catalog.btrim(p.display_name), ''),
         p.avatar_url
  FROM (
    SELECT DISTINCT CASE WHEN fs.requester_id = auth.uid() THEN fs.addressee_id ELSE fs.requester_id END AS friend_id
    FROM public.friendships fs
    WHERE fs.status = 'accepted'
      AND auth.uid() IS NOT NULL
      AND (fs.requester_id = auth.uid() OR fs.addressee_id = auth.uid())
  ) f
  LEFT JOIN public.profiles p ON p.id = f.friend_id
  WHERE f.friend_id = ANY (p_user_ids[1:200])
$$;

REVOKE ALL ON FUNCTION public.get_friend_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_public_profiles(uuid[]) TO authenticated;

