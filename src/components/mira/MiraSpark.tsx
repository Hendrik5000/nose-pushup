import { useId } from "react";

/** Decorative Mira spark, independent of provider or product branding. */
export function MiraSpark() {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient
          id={gradientId}
          x1="10"
          y1="8"
          x2="54"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#78e6de" />
          <stop offset="0.48" stopColor="#a3e8c2" />
          <stop offset="1" stopColor="#e9ed9b" />
        </linearGradient>
      </defs>
      <path
        d="M32 3C35.5 21 43 28.5 61 32C43 35.5 35.5 43 32 61C28.5 43 21 35.5 3 32C21 28.5 28.5 21 32 3Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
