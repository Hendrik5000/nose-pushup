export type ExerciseCatalogEntry = {
  id: string;
  name: string;
  description?: string | null;
};

export function searchExerciseCatalog<T extends ExerciseCatalogEntry>(
  exercises: readonly T[],
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  if (!normalized) return [...exercises];
  return exercises.filter((exercise) =>
    `${exercise.name} ${exercise.description ?? ""}`
      .toLocaleLowerCase("de-DE")
      .includes(normalized),
  );
}

export function onlyFavoriteExercises<T extends ExerciseCatalogEntry>(
  exercises: readonly T[],
  favoriteIds: readonly string[],
  enabled: boolean,
): T[] {
  if (!enabled) return [...exercises];
  const favorites = new Set(favoriteIds);
  return exercises.filter((exercise) => favorites.has(exercise.id));
}
