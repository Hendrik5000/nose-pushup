-- ========== CLUBS ==========
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  motto text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#38bdf8',
  code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_goal integer NOT NULL DEFAULT 1000 CHECK (weekly_goal BETWEEN 100 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.club_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','system')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_club_member(_club_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = _club_id AND user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
GRANT SELECT, INSERT, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
GRANT SELECT, INSERT, DELETE ON public.club_posts TO authenticated;
GRANT ALL ON public.club_posts TO service_role;

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clubs_select_member ON public.clubs;
CREATE POLICY clubs_select_member ON public.clubs FOR SELECT TO authenticated
  USING (public.is_club_member(id, auth.uid()) OR owner_id = auth.uid());
DROP POLICY IF EXISTS clubs_insert_owner ON public.clubs;
CREATE POLICY clubs_insert_owner ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS clubs_update_owner ON public.clubs;
CREATE POLICY clubs_update_owner ON public.clubs FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS club_members_select ON public.club_members;
CREATE POLICY club_members_select ON public.club_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_member(club_id, auth.uid()));
DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;
CREATE POLICY club_members_insert_self ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS club_members_delete_self ON public.club_members;
CREATE POLICY club_members_delete_self ON public.club_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS club_posts_select_member ON public.club_posts;
CREATE POLICY club_posts_select_member ON public.club_posts FOR SELECT TO authenticated
  USING (public.is_club_member(club_id, auth.uid()));
DROP POLICY IF EXISTS club_posts_insert_member ON public.club_posts;
CREATE POLICY club_posts_insert_member ON public.club_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND kind = 'text' AND public.is_club_member(club_id, auth.uid()));
DROP POLICY IF EXISTS club_posts_delete_own ON public.club_posts;
CREATE POLICY club_posts_delete_own ON public.club_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS clubs_updated_at ON public.clubs;
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Wochenstatistik eines Clubs (nur für Mitglieder)
CREATE OR REPLACE FUNCTION public.club_week_stats(_club_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, reps integer, level integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_club_member(_club_id, auth.uid()) THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, p.avatar_url,
         COALESCE(s.reps, 0)::int, p.level
  FROM public.club_members m
  JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN (
    SELECT d.user_id AS uid, SUM(d.total_reps)::int AS reps
    FROM public.daily_stats d
    WHERE d.day >= date_trunc('week', CURRENT_DATE)::date
    GROUP BY d.user_id
  ) s ON s.uid = m.user_id
  WHERE m.club_id = _club_id
  ORDER BY COALESCE(s.reps, 0) DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.club_week_stats(uuid) FROM anon;

-- Club-Liga: alle Clubs nach Wochen-Reps
CREATE OR REPLACE FUNCTION public.club_league()
RETURNS TABLE(club_id uuid, name text, color text, members integer, week_reps integer, weekly_goal integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.color,
         COUNT(DISTINCT m.user_id)::int,
         COALESCE(SUM(d.total_reps), 0)::int,
         c.weekly_goal
  FROM public.clubs c
  LEFT JOIN public.club_members m ON m.club_id = c.id
  LEFT JOIN public.daily_stats d
    ON d.user_id = m.user_id AND d.day >= date_trunc('week', CURRENT_DATE)::date
  GROUP BY c.id
  ORDER BY 5 DESC
  LIMIT 50;
$$;
REVOKE EXECUTE ON FUNCTION public.club_league() FROM anon;

-- Club per Code finden (ohne die Club-Zeile öffentlich lesbar zu machen)
CREATE OR REPLACE FUNCTION public.join_club_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _club public.clubs%ROWTYPE; _count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
  SELECT * INTO _club FROM public.clubs WHERE code = upper(trim(_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'Club nicht gefunden'; END IF;
  SELECT COUNT(*) INTO _count FROM public.club_members WHERE club_id = _club.id;
  IF _count >= 30 THEN RAISE EXCEPTION 'Club ist voll'; END IF;
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (_club.id, auth.uid(), 'member')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN _club.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_club_by_code(text) FROM anon;

-- ========== BATTLES 2.0 ==========
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'timed',
  ADD COLUMN IF NOT EXISTS target_reps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rematch_of uuid;

DO $$ BEGIN
  ALTER TABLE public.battles ADD CONSTRAINT battles_mode_check
    CHECK (mode IN ('timed','first_to','sprint','endurance'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS battle_rating integer NOT NULL DEFAULT 1000;

CREATE TABLE IF NOT EXISTS public.battle_queue (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'timed',
  duration_s integer NOT NULL DEFAULT 60,
  battle_id uuid REFERENCES public.battles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.battle_queue TO authenticated;
GRANT ALL ON public.battle_queue TO service_role;
ALTER TABLE public.battle_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS battle_queue_select_self ON public.battle_queue;
CREATE POLICY battle_queue_select_self ON public.battle_queue FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Elo-artige Wertung bei Battle-Ende
CREATE OR REPLACE FUNCTION public.on_battle_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _loser uuid; _rw integer; _rl integer; _exp numeric; _k integer := 24;
BEGIN
  IF NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished'
     AND NEW.winner_id IS NOT NULL AND NOT NEW.is_bot AND NEW.guest_id IS NOT NULL THEN
    _loser := CASE WHEN NEW.winner_id = NEW.host_id THEN NEW.guest_id ELSE NEW.host_id END;
    SELECT battle_rating INTO _rw FROM public.profiles WHERE id = NEW.winner_id;
    SELECT battle_rating INTO _rl FROM public.profiles WHERE id = _loser;
    IF _rw IS NULL OR _rl IS NULL THEN RETURN NEW; END IF;
    _exp := 1.0 / (1.0 + power(10.0, (_rl - _rw)::numeric / 400.0));
    UPDATE public.profiles SET battle_rating = GREATEST(100, _rw + ROUND(_k * (1 - _exp))::int)
      WHERE id = NEW.winner_id;
    UPDATE public.profiles SET battle_rating = GREATEST(100, _rl - ROUND(_k * (1 - _exp))::int)
      WHERE id = _loser;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.on_battle_rating() FROM anon, authenticated;

DROP TRIGGER IF EXISTS on_battle_rating ON public.battles;
CREATE TRIGGER on_battle_rating AFTER UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.on_battle_rating();

-- protect battle_rating gegen direkte Client-Updates
CREATE OR REPLACE FUNCTION public.protect_profile_gamification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.xp := OLD.xp;
    NEW.level := OLD.level;
    NEW.current_streak := OLD.current_streak;
    NEW.longest_streak := OLD.longest_streak;
    NEW.best_count := OLD.best_count;
    NEW.battle_wins := OLD.battle_wins;
    NEW.battle_losses := OLD.battle_losses;
    NEW.battle_rating := OLD.battle_rating;
    NEW.personal_bests := OLD.personal_bests;
    NEW.streak_freezes := OLD.streak_freezes;
    NEW.last_workout_date := OLD.last_workout_date;
  END IF;
  RETURN NEW;
END;
$$;