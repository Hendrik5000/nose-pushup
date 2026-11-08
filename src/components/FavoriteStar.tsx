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
  const [saveError, setSaveError] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={on ? "Favorit entfernen" : "Als Favorit"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const favorites = toggleFavoriteExercise(exerciseId);
          if (!favorites) {
            setSaveError(true);
            return;
          }
          setSaveError(false);
          setOn(favorites.includes(exerciseId));
          onChange?.(favorites);
        }}
        className="min-h-11 min-w-11 rounded-full px-2 py-1 text-base leading-none"
      >
        {on ? "★" : "☆"}
      </button>
      {saveError && (
        <span role="status" className="text-[10px] font-medium text-destructive">
          Nicht gespeichert
        </span>
      )}
    </span>
  );
}
