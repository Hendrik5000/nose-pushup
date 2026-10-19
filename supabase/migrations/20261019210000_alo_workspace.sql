-- Alo personal workspace. API keys / provider configuration are never stored here.
CREATE TABLE IF NOT EXISTS public.alo_records (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('capture','task','collection','shortcut','mira','draft','note')),
  body jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(body::text) <= 2000000),
  revision bigint NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.alo_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY alo_records_own_read ON public.alo_records FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Writes are only through the compare-and-swap RPC, not direct REST updates.
GRANT SELECT ON public.alo_records TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.alo_records FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.alo_sync_record(p_id text, p_kind text, p_body jsonb, p_deleted boolean, p_revision bigint)
RETURNS SETOF public.alo_records LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_revision = 0 THEN
    RETURN QUERY INSERT INTO public.alo_records(user_id,id,kind,body,deleted)
      VALUES(me,p_id,p_kind,CASE WHEN p_deleted THEN '{}'::jsonb ELSE p_body END,p_deleted)
      ON CONFLICT DO NOTHING RETURNING *;
  ELSE
    RETURN QUERY UPDATE public.alo_records SET body = CASE WHEN p_deleted THEN '{}'::jsonb ELSE p_body END,
      deleted = p_deleted, revision = revision + 1, updated_at = now()
      WHERE user_id = me AND id = p_id AND kind = p_kind AND revision = p_revision RETURNING *;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.alo_sync_record(text,text,jsonb,boolean,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alo_sync_record(text,text,jsonb,boolean,bigint) TO authenticated;
-- Keep tombstones, even when wiping, so another device cannot resurrect deleted content.
CREATE OR REPLACE FUNCTION public.alo_erase_workspace()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.alo_records SET body='{}'::jsonb, deleted=true, revision=revision+1, updated_at=now() WHERE user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.alo_erase_workspace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alo_erase_workspace() TO authenticated;

-- Nexus rooms are visible to all authenticated users in the existing schema.
-- These tools follow that exact visibility, not a fictitious private-room permission.
CREATE TABLE IF NOT EXISTS public.alo_room_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('info','file','poll','event')),
  body jsonb NOT NULL CHECK (octet_length(body::text) <= 2000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alo_room_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY alo_room_tools_read ON public.alo_room_tools FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id=room_id));
CREATE POLICY alo_room_tools_create ON public.alo_room_tools FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.rooms r WHERE r.id=room_id));
CREATE POLICY alo_room_tools_delete ON public.alo_room_tools FOR DELETE TO authenticated USING (user_id=auth.uid());
GRANT SELECT, INSERT, DELETE ON public.alo_room_tools TO authenticated;
CREATE TABLE IF NOT EXISTS public.alo_room_votes (
  tool_id uuid NOT NULL REFERENCES public.alo_room_tools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice integer NOT NULL CHECK (choice BETWEEN 0 AND 9),
  PRIMARY KEY(tool_id,user_id)
);
ALTER TABLE public.alo_room_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY alo_room_votes_read ON public.alo_room_votes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.alo_room_tools t WHERE t.id=tool_id));
CREATE POLICY alo_room_votes_write ON public.alo_room_votes FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.alo_room_tools t WHERE t.id=tool_id AND t.kind='poll'
      AND jsonb_typeof(t.body->'options')='array' AND choice < jsonb_array_length(t.body->'options')
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alo_room_votes TO authenticated;
CREATE INDEX alo_room_tools_room_idx ON public.alo_room_tools(room_id,created_at);

-- Untrusted room payloads must have basic shape even when written outside our UI.
ALTER TABLE public.alo_records ADD CONSTRAINT alo_record_body_object CHECK (jsonb_typeof(body)='object');
ALTER TABLE public.alo_room_tools ADD CONSTRAINT alo_room_tool_shape CHECK ((
  jsonb_typeof(body)='object' AND jsonb_typeof(body->'title')='string'
  AND length(body->>'title') BETWEEN 1 AND 200
  AND (kind <> 'poll' OR (jsonb_typeof(body->'options')='array' AND jsonb_array_length(body->'options') BETWEEN 2 AND 10))
) IS TRUE);
-- The original definer search was callable by PUBLIC. Keep ordinary message RLS
-- effective for every search caller and block unauthenticated execution.
CREATE OR REPLACE FUNCTION public.search_messages(q text)
RETURNS SETOF public.messages LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT m.* FROM public.messages m
  WHERE auth.uid() IS NOT NULL
    AND (m.room_id IS NOT NULL OR public.is_conversation_member(m.conversation_id,auth.uid()))
    AND to_tsvector('german',m.content) @@ plainto_tsquery('german',q)
  ORDER BY m.created_at DESC LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.search_messages(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_messages(text) TO authenticated;
