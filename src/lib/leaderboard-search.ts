export function filterProfilesByName<T extends { display_name: string | null }>(
  profiles: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  if (!normalizedQuery) return profiles;

  return profiles.filter((profile) =>
    (profile.display_name ?? "Ohne Namen").toLocaleLowerCase("de-DE").includes(normalizedQuery),
  );
}
