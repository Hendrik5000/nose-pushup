ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS haptics_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;