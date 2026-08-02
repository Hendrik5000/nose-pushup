CREATE TRIGGER on_workout_inserted
AFTER INSERT ON public.workouts
FOR EACH ROW
EXECUTE FUNCTION public.on_workout_inserted();

CREATE TRIGGER on_workout_progress_challenges
AFTER INSERT ON public.workouts
FOR EACH ROW
EXECUTE FUNCTION public.on_workout_progress_challenges();

CREATE TRIGGER on_battle_finished
AFTER UPDATE OF status ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.on_battle_finished();