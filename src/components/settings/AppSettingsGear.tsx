import { Settings2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { APP_SETTINGS_ENTRIES, type FullScreenAppSettingsId } from "@/lib/app-settings";
import { cn } from "@/lib/utils";

export function AppSettingsGear({
  appId,
  className,
}: {
  appId: FullScreenAppSettingsId;
  className?: string;
}) {
  const app = APP_SETTINGS_ENTRIES.find((entry) => entry.id === appId)!;
  return (
    <Link
      to="/settings/apps/$appId"
      params={{ appId }}
      search={{ from: appId === "mira" ? "/ai" : "/health" }}
      aria-label={`${app.title}-Einstellungen öffnen`}
      title={`${app.title}-Einstellungen`}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--menu-accent-border)] bg-[var(--menu-accent-soft)] text-[var(--menu-accent)] transition hover:border-[var(--menu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)]",
        className,
      )}
    >
      <Settings2 className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
}
