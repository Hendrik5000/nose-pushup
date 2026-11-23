import { Link } from "@tanstack/react-router";
import { HomeAppMenuSidebar } from "@/components/HomeAppMenuLayout";
import {
  PROFILE_SETTINGS_CATEGORIES,
  type ProfileSettingsCategoryId,
} from "@/lib/profile-settings";

export function SettingsActionsSidebar({
  activeCategoryId,
}: {
  activeCategoryId: ProfileSettingsCategoryId;
}) {
  return (
    <HomeAppMenuSidebar className="min-w-0 rounded-2xl border border-border/60 bg-card/50 p-3 lg:sticky lg:top-6">
      <nav aria-label="Einstellungsbereiche">
        <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Einstellungen
        </h2>
        <ul className="grid grid-cols-2 gap-1 lg:grid-cols-1">
          {PROFILE_SETTINGS_CATEGORIES.map((category) => (
            <li key={category.id}>
              <Link
                to="/settings/$category"
                params={{ category: category.id }}
                aria-current={activeCategoryId === category.id ? "page" : undefined}
                data-settings-sidebar-category={category.id}
                className="flex min-h-10 items-center rounded-xl px-2.5 py-2 text-sm font-medium leading-tight text-muted-foreground transition hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--menu-accent)] aria-[current=page]:bg-[var(--menu-accent-soft)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--menu-accent)]"
              >
                {category.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </HomeAppMenuSidebar>
  );
}
