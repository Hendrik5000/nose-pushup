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
