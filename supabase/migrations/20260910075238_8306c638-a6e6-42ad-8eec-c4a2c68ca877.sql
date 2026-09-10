GRANT SELECT, INSERT, UPDATE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
GRANT SELECT, INSERT, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
GRANT SELECT, INSERT, DELETE ON public.club_posts TO authenticated;
GRANT ALL ON public.club_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_queue TO authenticated;
GRANT ALL ON public.battle_queue TO service_role;