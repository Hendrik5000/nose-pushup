DROP POLICY IF EXISTS "battles select participants or waiting" ON public.battles;
CREATE POLICY "battles select participants" ON public.battles
FOR SELECT TO authenticated
USING (auth.uid() = host_id OR auth.uid() = guest_id);