CREATE OR REPLACE FUNCTION public.protect_profile_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direkte Updates über die Daten-API laufen als Rolle "authenticated".
  -- Trigger/SECURITY DEFINER-Funktionen und service_role laufen als andere Rolle.
  IF current_user = 'authenticated' THEN
    NEW.xp := OLD.xp;
    NEW.level := OLD.level;
    NEW.current_streak := OLD.current_streak;
    NEW.longest_streak := OLD.longest_streak;
    NEW.best_count := OLD.best_count;
    NEW.battle_wins := OLD.battle_wins;
    NEW.battle_losses := OLD.battle_losses;
    NEW.personal_bests := OLD.personal_bests;
    NEW.streak_freezes := OLD.streak_freezes;
    NEW.last_workout_date := OLD.last_workout_date;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_gamification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_gamification ON public.profiles;
CREATE TRIGGER protect_profile_gamification
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_gamification();