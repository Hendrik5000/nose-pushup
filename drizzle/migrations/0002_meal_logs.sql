CREATE TABLE public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL DEFAULT current_date,
  title text NOT NULL DEFAULT 'Mahlzeit',
  kcal integer NOT NULL DEFAULT 0 CHECK (kcal BETWEEN 0 AND 5000),
  protein_g integer NOT NULL DEFAULT 0 CHECK (protein_g BETWEEN 0 AND 400),
  tip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.meal_logs TO authenticated;
GRANT ALL ON public.meal_logs TO service_role;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY meal_logs_own_select ON public.meal_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY meal_logs_own_insert ON public.meal_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY meal_logs_own_delete ON public.meal_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX meal_logs_user_day ON public.meal_logs (user_id, day);