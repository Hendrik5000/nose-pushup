BEGIN;

-- Extend the existing Postfach item vocabulary without changing its RLS policies or grants.
ALTER TABLE public.postfach_items
  DROP CONSTRAINT IF EXISTS postfach_items_kind_check;
ALTER TABLE public.postfach_items
  ADD CONSTRAINT postfach_items_kind_check CHECK (kind IN (
    'friend_request', 'friend_accepted', 'battle_invitation', 'battle_accepted', 'missed_call',
    'feature_release'
  ));

-- A durable, private release record makes the release key idempotent even after inbox items are
-- deleted. It is not a shared Postfach message: one row is still created per recipient below.
CREATE TABLE public.feature_release_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_key text NOT NULL UNIQUE CHECK (
    release_key = lower(release_key)
    AND release_key ~ '^[a-z0-9][a-z0-9._-]{2,63}$'
  ),
  title text NOT NULL CHECK (public.marketplace_text_is_safe(title, 72)),
  body text NOT NULL CHECK (public.marketplace_text_is_safe(body, 320)),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_release_digests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feature_release_digests FROM PUBLIC, anon, authenticated, service_role;

-- This ledger enforces at most one delivery per release and recipient, independently of whether
-- that recipient later deletes their own Postfach item.
CREATE TABLE public.feature_release_digest_deliveries (
  release_id uuid NOT NULL REFERENCES public.feature_release_digests(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, user_id)
);
ALTER TABLE public.feature_release_digest_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feature_release_digest_deliveries FROM PUBLIC, anon, authenticated, service_role;

-- Only a verified, non-anonymous Admin can publish. No caller-supplied recipient/user IDs or
-- arbitrary payloads are accepted. The function records one digest and creates one Postfach row
-- for every currently registered, non-anonymous account, all in the same transaction.
CREATE OR REPLACE FUNCTION public.publish_feature_release_digest(
  p_release_key text,
  p_title text,
  p_body text,
  p_confirmed boolean
)
RETURNS TABLE (release_id uuid, was_created boolean, recipient_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_release_id uuid;
  v_existing_title text;
  v_existing_body text;
  v_recipient_count integer := 0;
BEGIN
  v_actor := (SELECT auth.uid());
  IF v_actor IS NULL
     OR COALESCE((SELECT auth.jwt()->>'is_anonymous'), 'false') = 'true'
     OR (SELECT public.has_global_role('admin')) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Explicit Admin confirmation required' USING ERRCODE = '42501';
  END IF;
  IF p_release_key IS NULL
     OR p_release_key <> lower(p_release_key)
     OR p_release_key !~ '^[a-z0-9][a-z0-9._-]{2,63}$' THEN
    RAISE EXCEPTION 'Invalid release key' USING ERRCODE = '22023';
  END IF;
  IF p_title IS NULL
     OR p_body IS NULL
     OR NOT public.marketplace_text_is_safe(p_title, 72)
     OR NOT public.marketplace_text_is_safe(p_body, 320) THEN
    RAISE EXCEPTION 'Invalid digest text' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.feature_release_digests (release_key, title, body, created_by)
  VALUES (p_release_key, p_title, p_body, v_actor)
  ON CONFLICT (release_key) DO NOTHING
  RETURNING id INTO v_release_id;

  IF v_release_id IS NULL THEN
    SELECT digest.id, digest.title, digest.body
      INTO v_release_id, v_existing_title, v_existing_body
      FROM public.feature_release_digests AS digest
     WHERE digest.release_key = p_release_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Release digest could not be confirmed' USING ERRCODE = '40001';
    END IF;
    IF v_existing_title IS DISTINCT FROM p_title OR v_existing_body IS DISTINCT FROM p_body THEN
      RAISE EXCEPTION 'Release key already used for a different digest' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_release_id, false, 0;
    RETURN;
  END IF;

  WITH inserted_deliveries AS (
    INSERT INTO public.feature_release_digest_deliveries (release_id, user_id)
    SELECT v_release_id, account.id
      FROM auth.users AS account
     WHERE COALESCE(account.is_anonymous, false) IS FALSE
    ON CONFLICT (release_id, user_id) DO NOTHING
    RETURNING user_id
  ), inserted_items AS (
    INSERT INTO public.postfach_items (user_id, kind, from_user_id, ref_id, payload)
    SELECT delivery.user_id,
           'feature_release',
           NULL,
           v_release_id,
           jsonb_build_object(
             'from_name', 'Alo',
             'release_key', p_release_key,
             'title', p_title,
             'body', p_body
           )
      FROM inserted_deliveries AS delivery
    ON CONFLICT (user_id, kind, ref_id) WHERE ref_id IS NOT NULL DO NOTHING
    RETURNING id
  )
  SELECT pg_catalog.count(*)::integer INTO v_recipient_count
    FROM inserted_items;

  RETURN QUERY SELECT v_release_id, true, v_recipient_count;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_feature_release_digest(text, text, text, boolean)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.publish_feature_release_digest(text, text, text, boolean)
  TO authenticated;

COMMIT;
