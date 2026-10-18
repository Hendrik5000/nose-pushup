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
