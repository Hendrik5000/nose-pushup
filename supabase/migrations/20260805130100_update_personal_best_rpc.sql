-- RPC: update_personal_best
-- Updates profiles.personal_bests[exercise_id] if new count is higher.
-- Called client-side as a belt-and-suspenders alongside the on_workout_inserted trigger.
CREATE OR REPLACE FUNCTION public.update_personal_best(
  p_user_id    uuid,
  p_exercise_id text,
  p_count      integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cur_pb integer;
BEGIN
  -- Only allow users to update their own record
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE((personal_bests ->> p_exercise_id)::integer, 0)
    INTO _cur_pb
    FROM public.profiles
   WHERE id = p_user_id;

  IF p_count > _cur_pb THEN
    UPDATE public.profiles
       SET personal_bests = COALESCE(personal_bests, '{}'::jsonb)
                         || jsonb_build_object(p_exercise_id, p_count)
     WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_personal_best(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_personal_best(uuid, text, integer) TO authenticated;
