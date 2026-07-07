
-- Fix: profiles policies allowing anonymous auth users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Battle opponents can view profile" ON public.profiles;
DROP POLICY IF EXISTS "Friends can view profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE))
  WITH CHECK (auth.uid() = id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE));

CREATE POLICY "Battle opponents can view profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND EXISTS (
      SELECT 1 FROM public.battles b
      WHERE ((b.host_id = auth.uid() AND b.guest_id = profiles.id)
          OR (b.guest_id = auth.uid() AND b.host_id = profiles.id))
    )
  );

CREATE POLICY "Friends can view profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (((f.requester_id = auth.uid()) AND (f.addressee_id = profiles.id))
          OR ((f.addressee_id = auth.uid()) AND (f.requester_id = profiles.id)))
    )
  );

-- Fix: bound rep counts to reasonable values
ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_count_reasonable CHECK (count >= 0 AND count <= 1000);

ALTER TABLE public.battle_reps
  ADD CONSTRAINT battle_reps_count_reasonable CHECK (count >= 1 AND count <= 10);

-- Fix: prevent participants from tampering with battle result columns.
-- Tighten the UPDATE policy so authenticated users can only touch rows via
-- the allowed column (guest_id, already the only column-level UPDATE grant).
DROP POLICY IF EXISTS "battles update participants" ON public.battles;
CREATE POLICY "battles join as guest" ON public.battles
  FOR UPDATE TO authenticated
  USING (status = 'waiting' AND guest_id IS NULL AND auth.uid() <> host_id)
  WITH CHECK (status = 'waiting' AND auth.uid() = guest_id);
