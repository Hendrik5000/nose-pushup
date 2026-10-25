import { Link } from "@tanstack/react-router";
import { House } from "lucide-react";

/** A visible in-flow route back to the Alo home hub. */
export function AloHomeLink({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
      aria-label="Zur Alo-Startseite"
      title="Zur Alo-Startseite"
    >
      <House className="h-4 w-4" aria-hidden="true" />
      <span>Startseite</span>
    </Link>
  );
}
