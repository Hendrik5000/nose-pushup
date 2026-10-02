DROP POLICY IF EXISTS "season_scores_select" ON public.season_scores;
CREATE POLICY "season_scores_select_members" ON public.season_scores FOR SELECT TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false OR auth.uid() = user_id);