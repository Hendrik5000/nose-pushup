import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { usePostfach } from "./PostfachProvider";

/** Link to the Postfach with an unread badge. Renders nothing when the Postfach is unavailable. */
export function PostfachBell({ className }: { className?: string }) {
  const { unreadCount, available } = usePostfach();
  if (!available) return null;
  const label = unreadCount > 0 ? `Postfach öffnen, ${unreadCount} ungelesen` : "Postfach öffnen";
  return (
    <Link
      to="/postfach"
      aria-label={label}
      title="Postfach"
      className={
        className ??
        "relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      }
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
