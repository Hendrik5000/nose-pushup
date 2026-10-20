export function isAnonymousCoachIdentity(identity: unknown): boolean {
  return (
    typeof identity === "object" &&
    identity !== null &&
    "is_anonymous" in identity &&
    (identity as { is_anonymous?: unknown }).is_anonymous === true
  );
}

export function isWithinCoachCooldown(
  createdAt: string,
  now = Date.now(),
  cooldownMs = 60 * 60 * 1000,
): boolean {
  const age = now - Date.parse(createdAt);
  return Number.isFinite(age) && age < cooldownMs;
}

/** A remounted/StrictMode effect must not reactivate a previous request. */
export function createCoachRequestGuard(
  isMounted: () => boolean,
  currentGeneration: () => number,
): () => boolean {
  const generation = currentGeneration();
  return () => isMounted() && generation === currentGeneration();
}
