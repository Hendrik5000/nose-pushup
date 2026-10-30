-- LOCAL CANDIDATE ONLY. Do not apply to any live database without a separate
-- schema/security review, exact-payload approval, and a proven atomic rollback path.
--
-- Adds the unordered-pair uniqueness guarantee for public.friendships
-- (A->B and B->A can never both exist). The friend battle invitation migration
-- (20261026093000) and the friend-code migration (20261030100000) both expect
-- an index with exactly this name.
--
-- This migration deliberately FAILS (and changes nothing) when duplicate
-- opposite-direction friendships already exist. Resolve those rows manually
-- and deliberately; this migration never deletes user data.

DO $friendship_pair_preflight$
BEGIN
  IF pg_catalog.to_regclass('public.friendships') IS NULL THEN
    RAISE EXCEPTION 'FRIENDSHIP_PAIR_SCHEMA_MISMATCH: public.friendships is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.friendships
    GROUP BY LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'FRIENDSHIP_PAIR_DUPLICATES: opposite-direction friendship rows exist; review them manually before applying';
  END IF;
END;
$friendship_pair_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS friendships_one_unordered_pair_idx
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
