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
    <nav aria-label="Apps mit eigenen Einstellungen" className="grid gap-2 sm:grid-cols-2">
      {APP_SETTINGS_ENTRIES.map((entry) => {
        const Icon = APP_ICONS[entry.id];
        const content = (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--menu-accent-soft)] text-[var(--menu-accent)]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{entry.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {entry.description}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        );
        const className =
          "settings-app-row flex min-h-16 items-center gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 text-left transition hover:border-[var(--menu-accent)] hover:bg-[var(--menu-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)]";

        if (entry.id === "alarm") {
          return (
            <Link
              key={entry.id}
              to="/alarm"
              aria-label="Wecker-Einstellungen öffnen"
              className={className}
            >
              {content}
            </Link>
          );
        }

        return (
          <Link
            key={entry.id}
            to="/settings/apps/$appId"
            params={{ appId: entry.id }}
            search={{ from: "/settings/apps" }}
            aria-label={`${entry.title}-Einstellungen öffnen`}
            className={className}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
