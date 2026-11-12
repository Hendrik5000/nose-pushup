import {
  Activity,
  Bell,
  CalendarDays,
  Dumbbell,
  Footprints,
  Gamepad2,
  HeartPulse,
  Inbox,
  Layers,
  Medal,
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { MarketplaceIconId } from "@/lib/marketplace";

export const MARKETPLACE_ICON_COMPONENTS = {
  mira: Sparkles,
  nexus: MessageCircle,
  health: HeartPulse,
  settings: Settings,
  training: Dumbbell,
  admin: ShieldCheck,
  hub: Layers,
  coach: Activity,
  inbox: Inbox,
  game: Gamepad2,
  programs: CalendarDays,
  calisthenics: Activity,
  run: Footprints,
  season: Trophy,
  battle: Swords,
  league: Trophy,
  leaderboard: Medal,
  clubs: Users,
  alarm: Bell,
  today: CalendarDays,
  search: Search,
  capture: Plus,
  collections: Layers,
  shortcuts: Zap,
  privacy: ShieldCheck,
} satisfies Record<MarketplaceIconId, LucideIcon>;

export function MarketplaceIcon({
  icon,
  className,
}: {
  icon: MarketplaceIconId;
  className?: string;
}) {
  const Icon = MARKETPLACE_ICON_COMPONENTS[icon];
  return <Icon className={className} aria-hidden="true" />;
}
