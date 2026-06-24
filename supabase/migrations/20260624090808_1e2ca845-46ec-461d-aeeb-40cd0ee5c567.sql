
-- 1. exercises table
CREATE TABLE public.exercises (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL,
  detection_type text NOT NULL CHECK (detection_type IN ('touch','motion_vertical','timer','combo')),
  unit text NOT NULL DEFAULT 'reps',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exercises readable by authenticated"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (true);

-- 2. Seed exercises
INSERT INTO public.exercises (id, name, icon, detection_type, unit, description, sort_order) VALUES
  ('pushup',  'Push-Ups', '💪', 'touch',           'reps',    'Nase aufs Display tippen.',                       10),
  ('situp',   'Sit-Ups',  '🧘', 'touch',           'reps',    'Handy an den Knien, Nase tippt es an.',           20),
  ('squat',   'Squats',   '🦵', 'motion_vertical', 'reps',    'Handy in Hosentasche – Auf- und Abbewegung.',     30),
  ('plank',   'Plank',    '🏋️', 'timer',           'seconds', 'Halte die Position so lange wie möglich.',         40),
  ('burpee',  'Burpees',  '🔥', 'combo',           'reps',    'Runter mit Nasen-Touch, hoch mit Sprung.',         50);

-- 3. workouts.exercise_id
ALTER TABLE public.workouts
  ADD COLUMN exercise_id text NOT NULL DEFAULT 'pushup'
  REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX workouts_user_exercise_idx ON public.workouts (user_id, exercise_id, created_at DESC);

-- 4. personal bests per exercise
ALTER TABLE public.profiles
  ADD COLUMN personal_bests jsonb NOT NULL DEFAULT '{}'::jsonb;

-- backfill personal_bests for existing push-up bests
UPDATE public.profiles
  SET personal_bests = jsonb_build_object('pushup', best_count)
  WHERE best_count > 0;
