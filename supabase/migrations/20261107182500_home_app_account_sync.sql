BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Account preferences only. No manifests, order, backgrounds or device action grants.
CREATE TABLE public.home_app_sync_records (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('home_name', 'marketplace_install')),
  app_key TEXT NOT NULL CHECK (
    app_key IN ('mira','nexus','health','settings','admin','marketplace','grid-defense','kupferkern','areas','training','tools')
    OR app_key ~ '^marketplace:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  name TEXT,
  version INTEGER,
  enabled BOOLEAN,
  deleted BOOLEAN NOT NULL DEFAULT false,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, app_key),
  CHECK (
    (kind = 'home_name' AND version IS NULL AND enabled IS NULL AND (
      (deleted AND name IS NULL) OR
      (NOT deleted AND name IS NOT NULL AND name = btrim(name)
        AND char_length(name) BETWEEN 1 AND 48 AND octet_length(name) <= 192
        AND name !~ '[[:cntrl:]<>]')
    )) OR
    (kind = 'marketplace_install' AND app_key LIKE 'marketplace:%' AND name IS NULL AND (
      (deleted AND version IS NULL AND enabled IS NULL) OR
      (NOT deleted AND version IS NOT NULL AND version > 0 AND enabled IS NOT NULL)
    ))
  )
);
ALTER TABLE public.home_app_sync_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.home_app_sync_records FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.home_app_sync_records TO authenticated;
CREATE POLICY home_app_sync_read_own
  ON public.home_app_sync_records FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No caller-supplied user_id, dynamic SQL, broad JSON payload or direct DML grants.
CREATE FUNCTION public.write_home_app_sync_record(
  p_kind TEXT,
  p_app_key TEXT,
  p_name TEXT,
  p_version INTEGER,
  p_enabled BOOLEAN,
  p_deleted BOOLEAN,
  p_expected_revision BIGINT
)
RETURNS TABLE(kind TEXT, app_key TEXT, name TEXT, version INTEGER, enabled BOOLEAN, deleted BOOLEAN, revision BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_app UUID;
  v_existing public.home_app_sync_records%ROWTYPE;
  v_exists BOOLEAN;
BEGIN
  IF v_user IS NULL OR COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'A signed-in account is required' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('home_name', 'marketplace_install')
    OR p_app_key IS NULL OR p_deleted IS NULL OR p_expected_revision IS NULL
    OR p_expected_revision < 0 OR p_expected_revision >= 9007199254740991 THEN
    RAISE EXCEPTION 'Invalid app preference' USING ERRCODE = '22023';
  END IF;
  IF p_app_key ~ '^marketplace:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_app := substring(p_app_key FROM 13)::UUID;
  ELSIF p_app_key NOT IN ('mira','nexus','health','settings','admin','marketplace','grid-defense','kupferkern','areas','training','tools')
    OR p_kind = 'marketplace_install' THEN
    RAISE EXCEPTION 'Invalid app reference' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'home_name' THEN
    IF p_version IS NOT NULL OR p_enabled IS NOT NULL
      OR (p_deleted AND p_name IS NOT NULL)
      OR (NOT p_deleted AND (p_name IS NULL OR p_name <> btrim(p_name)
        OR char_length(p_name) NOT BETWEEN 1 AND 48 OR octet_length(p_name) > 192
        OR p_name ~ '[[:cntrl:]<>]')) THEN
      RAISE EXCEPTION 'Invalid app name' USING ERRCODE = '22023';
    END IF;
  ELSIF p_name IS NOT NULL
    OR (p_deleted AND (p_version IS NOT NULL OR p_enabled IS NOT NULL))
    OR (NOT p_deleted AND (p_version IS NULL OR p_version < 1 OR p_enabled IS NULL)) THEN
    RAISE EXCEPTION 'Invalid app installation' USING ERRCODE = '22023';
  END IF;

  -- Serialize only this user's preference writes, including simultaneous first insert/count checks.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  SELECT r.* INTO v_existing FROM public.home_app_sync_records AS r
    WHERE r.user_id = v_user AND r.kind = p_kind AND r.app_key = p_app_key FOR UPDATE;
  v_exists := FOUND;
  IF (v_exists AND v_existing.revision <> p_expected_revision)
    OR (NOT v_exists AND p_expected_revision <> 0) THEN
    RETURN; -- CAS conflict: caller must fetch and merge, never silently overwrite.
  END IF;

  IF v_app IS NOT NULL AND NOT (p_deleted AND v_exists) THEN
    IF p_kind = 'marketplace_install' AND NOT p_deleted THEN
      IF public.has_global_role('admin') IS NOT TRUE THEN
        RAISE EXCEPTION 'App access is not available' USING ERRCODE = '42501';
      END IF;
      PERFORM app.id FROM public.marketplace_apps AS app
        JOIN public.marketplace_app_versions AS av ON av.app_id = app.id AND av.version = p_version
        WHERE app.id = v_app AND app.created_by = v_user AND app.status = 'published'
        FOR SHARE OF app;
    ELSE
      -- A name can outlive an installation/publication, but must still be for one's own app.
      PERFORM app.id FROM public.marketplace_apps AS app
        WHERE app.id = v_app AND app.created_by = v_user FOR SHARE;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Only self-created apps may be synchronized' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NOT v_exists AND (SELECT count(*) FROM public.home_app_sync_records AS r WHERE r.user_id = v_user) >= 512 THEN
    RAISE EXCEPTION 'App preference limit reached' USING ERRCODE = '22023';
  END IF;
  IF NOT p_deleted AND (SELECT count(*) FROM public.home_app_sync_records AS r
    WHERE r.user_id = v_user AND r.kind = p_kind AND NOT r.deleted AND r.app_key <> p_app_key)
      >= (CASE WHEN p_kind = 'home_name' THEN 128 ELSE 100 END) THEN
    RAISE EXCEPTION 'Active app preference limit reached' USING ERRCODE = '22023';
  END IF;
  IF v_exists THEN
    UPDATE public.home_app_sync_records AS r
      SET name = p_name, version = p_version, enabled = p_enabled, deleted = p_deleted,
          revision = r.revision + 1, updated_at = clock_timestamp()
      WHERE r.user_id = v_user AND r.kind = p_kind AND r.app_key = p_app_key;
  ELSE
    INSERT INTO public.home_app_sync_records(user_id, kind, app_key, name, version, enabled, deleted)
      VALUES(v_user, p_kind, p_app_key, p_name, p_version, p_enabled, p_deleted);
  END IF;
  RETURN QUERY SELECT r.kind, r.app_key, r.name, r.version, r.enabled, r.deleted, r.revision
    FROM public.home_app_sync_records AS r
    WHERE r.user_id = v_user AND r.kind = p_kind AND r.app_key = p_app_key;
END;
$$;
REVOKE ALL ON FUNCTION public.write_home_app_sync_record(TEXT,TEXT,TEXT,INTEGER,BOOLEAN,BOOLEAN,BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.write_home_app_sync_record(TEXT,TEXT,TEXT,INTEGER,BOOLEAN,BOOLEAN,BIGINT)
  TO authenticated;
COMMENT ON TABLE public.home_app_sync_records IS
  'User-owned Home names and own published app ID/version/activation only; action consent/order/background stay device-local.';
COMMIT;
