
-- Friendships table
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  CONSTRAINT unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX friendships_requester_idx ON public.friendships(requester_id);
CREATE INDEX friendships_addressee_idx ON public.friendships(addressee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users send friend requests"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee updates status"
  ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Both delete friendship"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public profiles view (safe columns only)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
  SELECT
    id,
    display_name,
    avatar_url,
    level,
    xp,
    current_streak,
    longest_streak,
    best_count,
    battle_wins,
    battle_losses
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
