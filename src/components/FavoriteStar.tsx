import { useState } from "react";
import { isFavoriteExercise, toggleFavoriteExercise } from "@/lib/extra-features";

export function FavoriteStar({ exerciseId }: { exerciseId: string }) {
  const [on, setOn] = useState(() => isFavoriteExercise(exerciseId));
  return (
    <button
      type="button"
      aria-label={on ? "Favorit entfernen" : "Als Favorit"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavoriteExercise(exerciseId);
        setOn(isFavoriteExercise(exerciseId));
      }}
      className="rounded-full px-2 py-1 text-base leading-none"
    >
      {on ? "★" : "☆"}
    </button>
  );
}
