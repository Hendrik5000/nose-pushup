-- 1) Security: challenge progress may no longer be written by clients
DROP POLICY IF EXISTS "Users can insert own challenge progress" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can update own challenge progress" ON public.user_challenges;
DROP POLICY IF EXISTS "user_challenges_insert_own" ON public.user_challenges;
DROP POLICY IF EXISTS "user_challenges_update_own" ON public.user_challenges;
REVOKE INSERT, UPDATE ON public.user_challenges FROM authenticated;

-- 2) Coach training plans
CREATE TABLE public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  summary text NOT NULL DEFAULT '',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE TABLE public.plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  focus text NOT NULL,
  exercise_id text REFERENCES public.exercises(id),
  sets integer NOT NULL DEFAULT 3 CHECK (sets BETWEEN 0 AND 12),
  reps integer NOT NULL DEFAULT 10 CHECK (reps BETWEEN 0 AND 300),
  rest_s integer NOT NULL DEFAULT 60 CHECK (rest_s BETWEEN 0 AND 600),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day)
);

GRANT SELECT ON public.training_plans TO authenticated;
GRANT ALL ON public.training_plans TO service_role;
GRANT SELECT ON public.plan_days TO authenticated;
GRANT ALL ON public.plan_days TO service_role;

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_plans_select_own" ON public.training_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "plan_days_select_own" ON public.plan_days
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER training_plans_updated_at BEFORE UPDATE ON public.training_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_plan_days_user_day ON public.plan_days (user_id, day);