
-- BATTLES
CREATE TABLE public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished','cancelled')),
  duration_s INTEGER NOT NULL DEFAULT 60,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  host_count INTEGER NOT NULL DEFAULT 0,
  guest_count INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.battles TO authenticated;
GRANT ALL ON public.battles TO service_role;

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- Host & Gast können ihr Battle sehen; jede/r Authentifizierte darf ein waiting-Battle per Code finden (via .eq code + status waiting)
CREATE POLICY "battles select participants or waiting"
  ON public.battles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = host_id
    OR auth.uid() = guest_id
    OR status = 'waiting'
  );

CREATE POLICY "battles insert as host"
  ON public.battles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "battles update participants"
  ON public.battles FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id OR (status = 'waiting' AND guest_id IS NULL))
  WITH CHECK (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE TRIGGER update_battles_updated_at
  BEFORE UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX battles_code_idx ON public.battles (code);
CREATE INDEX battles_host_idx ON public.battles (host_id, created_at DESC);

-- BATTLE REPS (live ticks; optional history — main counters live on battles)
CREATE TABLE public.battle_reps (
  id BIGSERIAL PRIMARY KEY,
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.battle_reps TO authenticated;
GRANT USAGE ON SEQUENCE public.battle_reps_id_seq TO authenticated;
GRANT ALL ON public.battle_reps TO service_role;
GRANT ALL ON SEQUENCE public.battle_reps_id_seq TO service_role;

ALTER TABLE public.battle_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_reps select participants"
  ON public.battle_reps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.battles b
      WHERE b.id = battle_id AND (b.host_id = auth.uid() OR b.guest_id = auth.uid())
    )
  );

CREATE POLICY "battle_reps insert self"
  ON public.battle_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.battles b
      WHERE b.id = battle_id
        AND b.status = 'active'
        AND (b.host_id = auth.uid() OR b.guest_id = auth.uid())
    )
  );

CREATE INDEX battle_reps_battle_idx ON public.battle_reps (battle_id, created_at);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_reps;

-- Battle Wins auf Profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS battle_wins INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS battle_losses INTEGER NOT NULL DEFAULT 0;

-- Trigger: wenn Battle finished wird, W/L updaten
CREATE OR REPLACE FUNCTION public.on_battle_finished()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    IF NEW.winner_id IS NOT NULL THEN
      UPDATE public.profiles SET battle_wins = battle_wins + 1, updated_at = now()
        WHERE id = NEW.winner_id;
      -- Verlierer bestimmen (nur wenn kein Bot-Gegner)
      IF NOT NEW.is_bot THEN
        IF NEW.winner_id = NEW.host_id AND NEW.guest_id IS NOT NULL THEN
          UPDATE public.profiles SET battle_losses = battle_losses + 1, updated_at = now()
            WHERE id = NEW.guest_id;
        ELSIF NEW.winner_id = NEW.guest_id THEN
          UPDATE public.profiles SET battle_losses = battle_losses + 1, updated_at = now()
            WHERE id = NEW.host_id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_battle_finished
  AFTER UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.on_battle_finished();

REVOKE EXECUTE ON FUNCTION public.on_battle_finished() FROM PUBLIC;
