import type { LucideIcon } from "lucide-react";

export const CONTENT_ICON_ACTION_CLASS =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function ContentActionButton({
  label,
  icon: Icon,
  iconOnly = false,
  onClick,
  pressed,
  className = "text-xs font-semibold text-primary",
}: {
  label: string;
  icon: LucideIcon;
  iconOnly?: boolean;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={iconOnly ? CONTENT_ICON_ACTION_CLASS : className}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {iconOnly ? <Icon className="h-4 w-4" aria-hidden="true" /> : label}
    </button>
  );
}
