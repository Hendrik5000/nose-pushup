
CREATE OR REPLACE FUNCTION public.calc_level(_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LEAST(50, GREATEST(1, FLOOR(SQRT(GREATEST(_xp,0)::numeric / 100))::int + 1));
$$;

REVOKE EXECUTE ON FUNCTION public.on_workout_inserted() FROM PUBLIC, anon, authenticated;
