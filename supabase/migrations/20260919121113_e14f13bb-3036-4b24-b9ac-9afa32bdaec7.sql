ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0;

CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons_select" ON public.seasons FOR SELECT TO authenticated USING (true);

CREATE TABLE public.season_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  league text NOT NULL DEFAULT 'bronze',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);
GRANT SELECT ON public.season_scores TO authenticated;
GRANT ALL ON public.season_scores TO service_role;
ALTER TABLE public.season_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_scores_select" ON public.season_scores FOR SELECT TO authenticated USING (true);

CREATE TABLE public.shop_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL,
  icon text NOT NULL DEFAULT '🎁',
  cost integer NOT NULL DEFAULT 100,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_items_select" ON public.shop_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
GRANT SELECT ON public.user_items TO authenticated;
GRANT ALL ON public.user_items TO service_role;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_items_select_own" ON public.user_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Saison-Punkte + Münzen ausschließlich serverseitig beim Training vergeben.
CREATE OR REPLACE FUNCTION public.on_workout_season_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _season public.seasons%ROWTYPE; _pts integer; _total integer; _league text;
BEGIN
  SELECT * INTO _season FROM public.seasons
    WHERE active AND CURRENT_DATE BETWEEN starts_on AND ends_on
    ORDER BY starts_on DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  _pts := GREATEST(1, LEAST(500, NEW.count));

  INSERT INTO public.season_scores (season_id, user_id, points)
  VALUES (_season.id, NEW.user_id, _pts)
  ON CONFLICT (season_id, user_id) DO UPDATE
    SET points = public.season_scores.points + EXCLUDED.points, updated_at = now()
  RETURNING points INTO _total;

  _league := CASE
    WHEN _total >= 3000 THEN 'elite'
    WHEN _total >= 1500 THEN 'gold'
    WHEN _total >= 500 THEN 'silver'
    ELSE 'bronze' END;
  UPDATE public.season_scores SET league = _league
    WHERE season_id = _season.id AND user_id = NEW.user_id;

  UPDATE public.profiles SET coins = coins + GREATEST(1, _pts / 5), updated_at = now()
    WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.on_workout_season_points() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_workout_season_points AFTER INSERT ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.on_workout_season_points();

-- Münzen dürfen Clients nicht selbst setzen.
CREATE OR REPLACE FUNCTION public.protect_profile_gamification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    NEW.coins := OLD.coins;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _item public.shop_items%ROWTYPE; _coins integer; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
  SELECT * INTO _item FROM public.shop_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Artikel nicht gefunden'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_items WHERE user_id = _uid AND item_id = _item_id)
     AND _item.kind <> 'streak_freeze' THEN
    RAISE EXCEPTION 'Bereits freigeschaltet';
  END IF;
  SELECT coins INTO _coins FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF COALESCE(_coins, 0) < _item.cost THEN RAISE EXCEPTION 'Nicht genug Münzen'; END IF;

  UPDATE public.profiles SET coins = coins - _item.cost, updated_at = now() WHERE id = _uid;
  INSERT INTO public.user_items (user_id, item_id) VALUES (_uid, _item_id)
    ON CONFLICT (user_id, item_id) DO NOTHING;
  IF _item.kind = 'streak_freeze' THEN
    UPDATE public.profiles SET streak_freezes = streak_freezes + 1 WHERE id = _uid;
  END IF;
  RETURN jsonb_build_object('ok', true, 'coins_left', GREATEST(0, COALESCE(_coins,0) - _item.cost));
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_shop_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(text) TO authenticated;

INSERT INTO public.seasons (name, starts_on, ends_on, active)
VALUES ('Saison 1', date_trunc('week', CURRENT_DATE)::date, date_trunc('week', CURRENT_DATE)::date + 42, true);

INSERT INTO public.shop_items (id, name, description, kind, icon, cost, payload, sort_order) VALUES
  ('theme_neon', 'Theme: Neon', 'Leuchtendes Neon-Farbschema.', 'theme', '🌈', 300, '{"theme":"neon"}', 1),
  ('theme_sunset', 'Theme: Sunset', 'Warmes Abendrot-Farbschema.', 'theme', '🌇', 300, '{"theme":"sunset"}', 2),
  ('frame_gold', 'Goldener Rahmen', 'Goldener Rahmen um dein Profilbild.', 'frame', '🥇', 500, '{"frame":"gold"}', 3),
  ('frame_flame', 'Flammen-Rahmen', 'Animierter Flammen-Rahmen.', 'frame', '🔥', 450, '{"frame":"flame"}', 4),
  ('streak_freeze', 'Streak-Freeze', 'Rettet deine Serie an einem verpassten Tag.', 'streak_freeze', '❄️', 150, '{}', 5);