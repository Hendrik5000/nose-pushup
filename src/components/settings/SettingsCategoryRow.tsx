import {
  AppWindow,
  Bell,
  ChevronRight,
  CircleHelp,
  Dumbbell,
  History,
  Palette,
  ShieldCheck,
  UserRound,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ProfileSettingsCategoryId } from "@/lib/profile-settings";
import { getProfileSettingsCategory } from "@/lib/profile-settings";

const CATEGORY_ICONS: Record<ProfileSettingsCategoryId, LucideIcon> = {
  profile: UserRound,
  apps: AppWindow,
  appearance: Palette,
  training: Dumbbell,
  community: Users,
  notifications: Bell,
  controls: Volume2,
  privacy: ShieldCheck,
  history: History,
  support: CircleHelp,
};

export function SettingsCategoryRow({ categoryId }: { categoryId: ProfileSettingsCategoryId }) {
  const category = getProfileSettingsCategory(categoryId)!;
  const Icon = CATEGORY_ICONS[categoryId];

  return (
    <Link
      to="/settings/$category"
      params={{ category: categoryId }}
      className="settings-category-row flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)]"
      aria-label={`${category.title} öffnen`}
      data-settings-category={categoryId}
    >
      <span className="settings-category-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold text-foreground">
          {category.title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {category.subtitle}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
