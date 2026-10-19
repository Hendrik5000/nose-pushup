import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Dumbbell,
  HeartPulse,
  Menu,
  MessageCircle,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
  Route as RouteIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  {
    title: "TRAINIEREN",
    links: [
      { to: "/exercises", label: "Übungen", icon: Dumbbell },
      { to: "/programs", label: "Programme", icon: Target },
      { to: "/calisthenics", label: "Calisthenics", icon: Activity },
      { to: "/run", label: "Laufen", icon: RouteIcon },
    ],
  },
  {
    title: "WEITERKOMMEN",
    links: [
      { to: "/health", label: "Gesundheit", icon: HeartPulse },
      { to: "/coach", label: "Coach", icon: Shield },
      { to: "/ai", label: "Super-KI", icon: Sparkles },
      { to: "/season", label: "Saison", icon: Trophy },
    ],
  },
  {
    title: "GEMEINSAM",
    links: [
      { to: "/battle", label: "Wettkampf", icon: Swords },
      { to: "/battle-league", label: "Battle-Liga", icon: Shield },
      { to: "/leaderboard", label: "Rangliste", icon: Trophy },
      { to: "/clubs", label: "Clubs", icon: Users },
      { to: "/chat", label: "Chat", icon: MessageCircle },
      { to: "/profile", label: "Profil & Design", icon: UserRound },
    ],
  },
];

export function SportAppHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <div className="sport-only sport-app-header" ref={ref}>
      <div className="sport-app-header-inner">
        <Link to="/" className="sport-brand" aria-label="Nose Push · Übersicht">
          <span className="sport-brand-symbol">
            <Activity aria-hidden="true" />
          </span>
          <span>
            NOSE<span className="text-primary">PUSH</span>
            <small>DEIN TRAINING. DEIN FORTSCHRITT.</small>
          </span>
        </Link>
        <button
          ref={trigger}
          type="button"
          className="sport-menu-trigger"
          aria-expanded={open}
          aria-controls="sport-area-menu"
          onClick={() => setOpen(!open)}
        >
          <span>Bereiche</span>
          {open ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      {open && (
        <nav id="sport-area-menu" className="sport-area-menu" aria-label="Alle Bereiche">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="sport-menu-label">{section.title}</p>
              {section.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={pathname === link.to ? "page" : undefined}
                  className="sport-area-link"
                >
                  <link.icon className="h-4 w-4" aria-hidden="true" />
                  <span>{link.label}</span>
                  <ArrowUpRight className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
