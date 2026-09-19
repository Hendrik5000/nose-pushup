CREATE TABLE public.programs (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  weeks integer NOT NULL DEFAULT 4,
  level text NOT NULL DEFAULT 'beginner',
  icon text NOT NULL DEFAULT '🏁',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_select" ON public.programs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id text NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  focus text NOT NULL,
  exercise_id text REFERENCES public.exercises(id),
  sets integer NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  rest_s integer NOT NULL DEFAULT 60,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, day_index)
);
GRANT SELECT ON public.program_days TO authenticated;
GRANT ALL ON public.program_days TO service_role;
ALTER TABLE public.program_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_days_select" ON public.program_days FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id text NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  current_day integer NOT NULL DEFAULT 1,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_programs TO authenticated;
GRANT ALL ON public.user_programs TO service_role;
ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_programs_own" ON public.user_programs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_programs_updated_at BEFORE UPDATE ON public.user_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_program_id uuid NOT NULL REFERENCES public.user_programs(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  reps_done integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_program_id, day_index)
);
GRANT SELECT, INSERT, DELETE ON public.user_program_days TO authenticated;
GRANT ALL ON public.user_program_days TO service_role;
ALTER TABLE public.user_program_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_program_days_own" ON public.user_program_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.programs (id, title, description, weeks, level, icon, sort_order) VALUES
  ('starter14', 'Starter 14', 'Zwei Wochen Einstieg: saubere Technik und erste Routine.', 2, 'beginner', '🌱', 1),
  ('pushup100', '100 Push-Ups', 'Sechs Wochen strukturierter Aufbau bis zu 100 Wiederholungen am Tag.', 6, 'advanced', '💯', 2),
  ('corefire', 'Core Fire', 'Vier Wochen Rumpfstabilität mit Plank, Sit-Ups und Mobilität.', 4, 'intermediate', '🔥', 3);

INSERT INTO public.program_days (program_id, day_index, focus, exercise_id, sets, reps, rest_s, note) VALUES
  ('starter14', 1, 'Push', 'pushup', 3, 5, 90, 'Langsam runter, kurz halten, kraftvoll hoch.'),
  ('starter14', 2, 'Core', 'plank', 3, 20, 60, 'Plank in Sekunden, Hüfte auf einer Linie.'),
  ('starter14', 3, 'Rest', NULL, 0, 0, 0, 'Locker bleiben, kurz dehnen.'),
  ('starter14', 4, 'Push', 'pushup', 3, 6, 90, 'Gleiche Technik, eine Wiederholung mehr.'),
  ('starter14', 5, 'Core', 'situp', 3, 10, 60, 'Bauch kontrolliert anspannen.'),
  ('starter14', 6, 'Push', 'pushup', 4, 6, 90, 'Vierter Satz als Bonus.'),
  ('starter14', 7, 'Rest', NULL, 0, 0, 0, 'Erholung zählt zum Training.'),
  ('starter14', 8, 'Push', 'pushup', 4, 7, 90, 'Tempo halten.'),
  ('starter14', 9, 'Core', 'plank', 3, 30, 60, '30 Sekunden pro Satz.'),
  ('starter14', 10, 'Rest', NULL, 0, 0, 0, 'Spaziergang oder Mobilität.'),
  ('starter14', 11, 'Push', 'pushup', 4, 8, 90, 'Sauber vor schnell.'),
  ('starter14', 12, 'Core', 'situp', 4, 12, 60, 'Letzte Wiederholung kontrolliert.'),
  ('starter14', 13, 'Push', 'pushup', 4, 9, 120, 'Vorletzter Tag, alles geben.'),
  ('starter14', 14, 'Test', 'pushup', 1, 0, 0, 'Maximaltest: so viele wie möglich in einem Satz.'),
  ('pushup100', 1, 'Push', 'pushup', 5, 8, 90, 'Basisvolumen aufbauen.'),
  ('pushup100', 2, 'Core', 'plank', 3, 40, 60, 'Rumpf stabilisieren.'),
  ('pushup100', 3, 'Push', 'pushup', 5, 10, 90, 'Volumen steigern.'),
  ('pushup100', 4, 'Rest', NULL, 0, 0, 0, 'Regeneration.'),
  ('pushup100', 5, 'Push', 'pushup', 6, 10, 75, 'Pausen verkürzen.'),
  ('pushup100', 6, 'Core', 'situp', 4, 15, 60, 'Bauch und Hüftbeuger.'),
  ('pushup100', 7, 'Test', 'pushup', 1, 0, 0, 'Wochentest: Maximalsatz.'),
  ('corefire', 1, 'Core', 'plank', 4, 30, 45, 'Kurz und knackig.'),
  ('corefire', 2, 'Core', 'situp', 4, 15, 45, 'Gleichmäßiges Tempo.'),
  ('corefire', 3, 'Mobility', NULL, 0, 0, 0, 'Zehn Minuten Dehnen.'),
  ('corefire', 4, 'Core', 'plank', 4, 45, 45, 'Länger halten.'),
  ('corefire', 5, 'Push', 'pushup', 3, 10, 90, 'Push als Ausgleich.'),
  ('corefire', 6, 'Core', 'situp', 5, 15, 45, 'Fünf Sätze.'),
  ('corefire', 7, 'Rest', NULL, 0, 0, 0, 'Pause.');