-- 1) Achievements: Nutzer dürfen keine Erfolge mehr selbst einfügen.
DROP POLICY IF EXISTS "Users insert own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users update own achievements" ON public.user_achievements;

-- Updates nur noch für die "seen"-Markierung; alle anderen Spalten werden zurückgesetzt.
CREATE OR REPLACE FUNCTION public.protect_user_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.user_id := OLD.user_id;
    NEW.achievement_id := OLD.achievement_id;
    NEW.unlocked_at := OLD.unlocked_at;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_achievements ON public.user_achievements;
CREATE TRIGGER protect_user_achievements
BEFORE UPDATE ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.protect_user_achievements();

CREATE POLICY "Users mark own achievements seen"
ON public.user_achievements
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

REVOKE INSERT ON public.user_achievements FROM authenticated;
REVOKE UPDATE ON public.user_achievements FROM anon;
REVOKE INSERT ON public.user_achievements FROM anon;

-- 2) Profile: Gamification-Spalten dürfen von Clients nicht geschrieben werden.
-- Trigger existiert bereits; Spalten-Rechte zusätzlich hart einschränken.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, theme, birth_year, height_cm, weight_kg, sex,
              daily_goal, share_activity, sound_enabled, haptics_enabled, onboarded, updated_at)
ON public.profiles TO authenticated;
