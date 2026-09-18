ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS form_score numeric(3,1),
  ADD COLUMN IF NOT EXISTS clean_reps integer;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_form_score_range CHECK (form_score IS NULL OR (form_score >= 0 AND form_score <= 5)),
  ADD CONSTRAINT workouts_clean_reps_range CHECK (clean_reps IS NULL OR (clean_reps >= 0 AND clean_reps <= 10000));