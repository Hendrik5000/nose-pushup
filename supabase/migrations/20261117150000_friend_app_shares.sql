-- Friend app shares v1 (Alo 1.186): a user shares one of their own Mira-built
-- app drafts with their accepted friends. Declarative manifests only; the
-- manifest is validated on write and on every read. Execution stays client-side
-- (MarketplaceManifestView), no arbitrary code is ever registered.
-- This migration is NOT executed by the AI team; deployment stays a manual step.

CREATE TABLE public.friend_app_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  app_name text NOT NULL,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sharer_id, session_id)
);

CREATE INDEX friend_app_shares_sharer_idx ON public.friend_app_shares(sharer_id);

GRANT SELECT, INSERT, DELETE ON public.friend_app_shares TO authenticated;
GRANT ALL ON public.friend_app_shares TO service_role;

ALTER TABLE public.friend_app_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sharers manage their own app shares"
  ON public.friend_app_shares FOR ALL
  TO authenticated
  USING (sharer_id = auth.uid())
  WITH CHECK (sharer_id = auth.uid());

CREATE POLICY "Accepted friends see shared apps"
  ON public.friend_app_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = friend_app_shares.sharer_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = friend_app_shares.sharer_id)
        )
    )
  );
