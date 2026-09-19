ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_by uuid;

CREATE OR REPLACE FUNCTION public.public_profile(_slug text)
RETURNS TABLE(
  display_name text,
  avatar_url text,
  level integer,
  xp integer,
  current_streak integer,
  longest_streak integer,
  best_count integer,
  battle_wins integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.display_name, p.avatar_url, p.level, p.xp, p.current_streak,
         p.longest_streak, p.best_count, p.battle_wins
  FROM public.profiles p
  WHERE p.public_enabled = true AND lower(p.public_slug) = lower(trim(_slug))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_profile(text) TO anon, authenticated;