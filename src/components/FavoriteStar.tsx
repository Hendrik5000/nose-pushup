import { useState } from "react";
import { isFavoriteExercise, toggleFavoriteExercise } from "@/lib/extra-features";

export function FavoriteStar({
  exerciseId,
  onChange,
}: {
  exerciseId: string;
  onChange?: (favoriteIds: string[]) => void;
}) {
  const [on, setOn] = useState(() => isFavoriteExercise(exerciseId));
  return (
    <button
      type="button"
      aria-label={on ? "Favorit entfernen" : "Als Favorit"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const favorites = toggleFavoriteExercise(exerciseId);
        setOn(favorites.includes(exerciseId));
        onChange?.(favorites);
      }}
      className="rounded-full px-2 py-1 text-base leading-none"
    >
      {on ? "★" : "☆"}
    </button>
  );
}
