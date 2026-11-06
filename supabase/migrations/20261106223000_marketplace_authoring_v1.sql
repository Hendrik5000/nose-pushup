BEGIN;

CREATE TABLE public.marketplace_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'revoked')),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by UUID,
  revoked_at TIMESTAMPTZ,
  CHECK (
    (status = 'published' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

CREATE TABLE public.marketplace_app_versions (
  app_id UUID NOT NULL REFERENCES public.marketplace_apps(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  manifest JSONB NOT NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, version)
);

ALTER TABLE public.marketplace_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_app_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketplace_apps FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.marketplace_app_versions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.marketplace_apps TO authenticated;
GRANT SELECT ON TABLE public.marketplace_app_versions TO authenticated;

CREATE POLICY marketplace_admin_read_published_apps
  ON public.marketplace_apps
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND (SELECT public.has_global_role('admin')) IS TRUE
  );

CREATE POLICY marketplace_admin_read_published_versions
  ON public.marketplace_app_versions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.has_global_role('admin')) IS TRUE
    AND EXISTS (
      SELECT 1
      FROM public.marketplace_apps AS app
      WHERE app.id = marketplace_app_versions.app_id
        AND app.status = 'published'
    )
  );

CREATE OR REPLACE FUNCTION public.marketplace_text_is_safe(p_text TEXT, p_max_chars INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT char_length(btrim(p_text)) BETWEEN 1 AND p_max_chars
    AND p_text !~ '[<>]'
    AND p_text !~ '[[:cntrl:]]'
    AND p_text !~* '(javascript|vbscript|data)[[:space:]]*:|https?://'
    AND pg_catalog.translate(
      p_text,
      pg_catalog.chr(8234) || pg_catalog.chr(8235) || pg_catalog.chr(8236) ||
        pg_catalog.chr(8237) || pg_catalog.chr(8238) || pg_catalog.chr(8294) ||
        pg_catalog.chr(8295) || pg_catalog.chr(8296) || pg_catalog.chr(8297),
      ''
    ) = p_text;
$$;
REVOKE ALL ON FUNCTION public.marketplace_text_is_safe(TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.marketplace_manifest_is_valid(p_manifest JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  block JSONB;
  item JSONB;
  block_type TEXT;
  action_id TEXT;
  action_count INTEGER := 0;
  action_ids TEXT[] := ARRAY[]::TEXT[];
  block_count INTEGER;
  item_count INTEGER;
  icon_name TEXT;
BEGIN
  IF p_manifest IS NULL OR jsonb_typeof(p_manifest) IS DISTINCT FROM 'object' THEN
    RETURN FALSE;
  END IF;
  IF octet_length(p_manifest::TEXT) > 16384 THEN
    RETURN FALSE;
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_manifest)) <> 5
     OR NOT (p_manifest ?& ARRAY['schemaVersion', 'name', 'description', 'icon', 'blocks']) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'schemaVersion') IS DISTINCT FROM 'number'
     OR p_manifest->>'schemaVersion' IS DISTINCT FROM '1' THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'name') IS DISTINCT FROM 'string'
     OR NOT public.marketplace_text_is_safe(p_manifest->>'name', 48) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'description') IS DISTINCT FROM 'string'
     OR NOT public.marketplace_text_is_safe(p_manifest->>'description', 180) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'icon') IS DISTINCT FROM 'string' THEN
    RETURN FALSE;
  END IF;
  icon_name := p_manifest->>'icon';
  IF icon_name NOT IN (
    'mira', 'nexus', 'health', 'settings', 'training', 'admin', 'hub', 'coach',
    'inbox', 'game', 'programs', 'calisthenics', 'run', 'season', 'battle',
    'league', 'leaderboard', 'clubs', 'alarm', 'today', 'search', 'capture',
    'collections', 'shortcuts', 'privacy'
  ) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'blocks') IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;
  block_count := jsonb_array_length(p_manifest->'blocks');
  IF block_count < 1 OR block_count > 12 THEN
    RETURN FALSE;
  END IF;

  FOR block IN SELECT entry.value FROM jsonb_array_elements(p_manifest->'blocks') AS entry(value)
  LOOP
    IF jsonb_typeof(block) IS DISTINCT FROM 'object'
       OR jsonb_typeof(block->'type') IS DISTINCT FROM 'string' THEN
      RETURN FALSE;
    END IF;
    block_type := block->>'type';

    IF block_type IN ('heading', 'paragraph') THEN
      IF (SELECT count(*) FROM jsonb_object_keys(block)) <> 2
         OR NOT (block ?& ARRAY['type', 'text'])
         OR jsonb_typeof(block->'text') IS DISTINCT FROM 'string' THEN
        RETURN FALSE;
      END IF;
      IF block_type = 'heading'
         AND NOT public.marketplace_text_is_safe(block->>'text', 72) THEN
        RETURN FALSE;
      END IF;
      IF block_type = 'paragraph'
         AND NOT public.marketplace_text_is_safe(block->>'text', 500) THEN
        RETURN FALSE;
      END IF;

    ELSIF block_type = 'list' THEN
      IF (SELECT count(*) FROM jsonb_object_keys(block)) <> 2
         OR NOT (block ?& ARRAY['type', 'items'])
         OR jsonb_typeof(block->'items') IS DISTINCT FROM 'array' THEN
        RETURN FALSE;
      END IF;
      item_count := jsonb_array_length(block->'items');
      IF item_count < 1 OR item_count > 8 THEN
        RETURN FALSE;
      END IF;
      FOR item IN SELECT entry.value FROM jsonb_array_elements(block->'items') AS entry(value)
      LOOP
        IF jsonb_typeof(item) IS DISTINCT FROM 'string'
           OR NOT public.marketplace_text_is_safe(item #>> '{}', 160) THEN
          RETURN FALSE;
        END IF;
      END LOOP;

    ELSIF block_type = 'action' THEN
      IF (SELECT count(*) FROM jsonb_object_keys(block)) <> 3
         OR NOT (block ?& ARRAY['type', 'label', 'actionId'])
         OR jsonb_typeof(block->'label') IS DISTINCT FROM 'string'
         OR jsonb_typeof(block->'actionId') IS DISTINCT FROM 'string'
         OR NOT public.marketplace_text_is_safe(block->>'label', 40) THEN
        RETURN FALSE;
      END IF;
      action_id := block->>'actionId';
      IF action_id NOT IN (
        'route:/ai', 'route:/chat', 'route:/exercises', 'route:/profile',
        'route:/training', 'route:/admin', 'route:/areas', 'route:/tools',
        'route:/coach', 'route:/postfach', 'route:/health', 'route:/programs',
        'route:/calisthenics', 'route:/run', 'route:/season', 'route:/battle',
        'route:/battle-league', 'route:/leaderboard', 'route:/clubs', 'route:/alarm',
        'game:grid-defense', 'game:kupferkern', 'tool:today', 'tool:search',
        'tool:capture', 'tool:collections', 'tool:shortcuts', 'tool:privacy'
      ) OR action_id = ANY(action_ids) THEN
        RETURN FALSE;
      END IF;
      action_ids := array_append(action_ids, action_id);
      action_count := action_count + 1;

    ELSE
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN action_count BETWEEN 1 AND 4;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_manifest_is_valid(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_marketplace_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Marketplace app versions are immutable' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_marketplace_version_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER marketplace_app_versions_immutable
  BEFORE UPDATE OR DELETE ON public.marketplace_app_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_marketplace_version_mutation();

CREATE OR REPLACE FUNCTION public.list_marketplace_current_apps()
RETURNS TABLE (
  app_id UUID,
  version INTEGER,
  current_version INTEGER,
  manifest JSONB,
  created_at TIMESTAMPTZ,
  can_manage BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT app.id, version.version, app.current_version, version.manifest, version.created_at, (app.created_by = auth.uid())
  FROM public.marketplace_apps AS app
  JOIN public.marketplace_app_versions AS version
    ON version.app_id = app.id
   AND version.version = app.current_version
  WHERE app.status = 'published'
  ORDER BY app.created_at DESC, app.id
  LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.list_marketplace_current_apps()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_marketplace_current_apps() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_marketplace_app_version(p_app_id UUID, p_version INTEGER)
RETURNS TABLE (
  app_id UUID,
  version INTEGER,
  current_version INTEGER,
  manifest JSONB,
  created_at TIMESTAMPTZ,
  can_manage BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT app.id, version.version, app.current_version, version.manifest, version.created_at, (app.created_by = auth.uid())
  FROM public.marketplace_apps AS app
  JOIN public.marketplace_app_versions AS version
    ON version.app_id = app.id
  WHERE app.id = p_app_id
    AND version.version = p_version
    AND app.status = 'published'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_marketplace_app_version(UUID, INTEGER)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_marketplace_app_version(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_marketplace_app(
  p_manifest JSONB,
  p_confirmed BOOLEAN,
  p_app_id UUID DEFAULT NULL,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS TABLE (app_id UUID, version INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id UUID;
  previous_version INTEGER;
  next_version INTEGER;
BEGIN
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt()->>'is_anonymous', 'false') = 'true'
     OR (SELECT public.has_global_role('admin')) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Explicit Admin confirmation required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.marketplace_manifest_is_valid(p_manifest) THEN
    RAISE EXCEPTION 'Invalid Marketplace manifest' USING ERRCODE = '22023';
  END IF;

  IF p_app_id IS NULL THEN
    IF p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid version precondition' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(741923, 1);
    IF (SELECT count(*) FROM public.marketplace_apps WHERE status = 'published') >= 500 THEN
      RAISE EXCEPTION 'Marketplace app limit reached' USING ERRCODE = '54000';
    END IF;
    INSERT INTO public.marketplace_apps (created_by)
    VALUES (auth.uid())
    RETURNING id INTO target_id;
    next_version := 1;
  ELSE
    IF p_expected_version IS NULL OR p_expected_version < 1 THEN
      RAISE EXCEPTION 'Expected version required' USING ERRCODE = '22023';
    END IF;
    SELECT app.current_version
      INTO previous_version
      FROM public.marketplace_apps AS app
     WHERE app.id = p_app_id
       AND app.status = 'published'
       AND app.created_by = auth.uid()
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Marketplace app not available' USING ERRCODE = 'P0002';
    END IF;
    IF previous_version IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'Marketplace app version changed; refresh and retry' USING ERRCODE = '40001';
    END IF;
    IF previous_version >= 2147483647 THEN
      RAISE EXCEPTION 'Marketplace app version limit reached' USING ERRCODE = '22003';
    END IF;
    target_id := p_app_id;
    next_version := previous_version + 1;
    UPDATE public.marketplace_apps
       SET current_version = next_version,
           updated_at = now()
     WHERE id = target_id;
  END IF;

  INSERT INTO public.marketplace_app_versions (app_id, version, manifest, created_by)
  VALUES (target_id, next_version, p_manifest, auth.uid());

  RETURN QUERY SELECT target_id, next_version;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_marketplace_app(JSONB, BOOLEAN, UUID, INTEGER)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.publish_marketplace_app(JSONB, BOOLEAN, UUID, INTEGER)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_marketplace_app(p_app_id UUID, p_confirmed BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt()->>'is_anonymous', 'false') = 'true'
     OR (SELECT public.has_global_role('admin')) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Explicit Admin confirmation required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.marketplace_apps
     SET status = 'revoked',
         revoked_by = auth.uid(),
         revoked_at = now(),
         updated_at = now()
   WHERE id = p_app_id
     AND status = 'published'
     AND created_by = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marketplace app not available' USING ERRCODE = 'P0002';
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_marketplace_app(UUID, BOOLEAN)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_marketplace_app(UUID, BOOLEAN)
  TO authenticated;

COMMIT;
