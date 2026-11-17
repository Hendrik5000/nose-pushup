import { Fragment } from "react";
import { Bell, ChevronRight, HeartPulse, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { APP_SETTINGS_ENTRIES } from "@/lib/app-settings";

const APP_ICONS = {
  mira: Sparkles,
  health: HeartPulse,
  alarm: Bell,
} as const;

export function AppsSettingsList() {
  return (
    <nav
      aria-label="Apps mit eigenen Einstellungen"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card/70"
    >
      {APP_SETTINGS_ENTRIES.map((entry, index) => {
        const Icon = APP_ICONS[entry.id];
        const content = (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.7rem] bg-[var(--menu-accent-soft)] text-[var(--menu-accent)]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{entry.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {entry.description}
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground/70"
              aria-hidden="true"
            />
          </>
        );
        const className =
          "settings-app-row flex min-h-16 items-center gap-3 p-3 text-left transition hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--menu-accent)]";
        const separator =
          index > 0 ? <div className="mx-3 h-px bg-border/70 sm:mx-4" aria-hidden="true" /> : null;

        if (entry.id === "alarm") {
          return (
            <Fragment key={entry.id}>
              {separator}
              <Link to="/alarm" aria-label="Wecker-Einstellungen öffnen" className={className}>
                {content}
              </Link>
            </Fragment>
          );
        }

        return (
          <Fragment key={entry.id}>
            {separator}
            <Link
              to="/settings/apps/$appId"
              params={{ appId: entry.id }}
              search={{ from: "/settings/apps" }}
              aria-label={`${entry.title}-Einstellungen öffnen`}
              className={className}
            >
              {content}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
