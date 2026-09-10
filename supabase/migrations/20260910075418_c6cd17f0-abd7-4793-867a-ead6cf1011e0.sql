DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;
CREATE POLICY club_members_insert_owner ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
  );