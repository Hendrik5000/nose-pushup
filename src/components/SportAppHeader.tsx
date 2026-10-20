import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Plus,
  ChevronRight,
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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { aloPageIdentity } from "@/lib/alo-ui";
import { AloHeaderBrand } from "@/components/AloHeaderBrand";

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
      { to: "/ai", label: "Mira", icon: Sparkles },
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
      { to: "/chat", label: "Nexus Chat", icon: MessageCircle },
      { to: "/profile", label: "Profil & Design", icon: UserRound },
    ],
  },
];

export function SportAppHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const identity = aloPageIdentity(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        "--alo-header-space",
        `${element.getBoundingClientRect().height}px`,
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
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
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="sport-app-header alo-app-header" data-module={identity.module} ref={ref}>
      <div className="sport-app-header-inner">
        <div className="alo-header-identity">
          {identity.back && (
            <Link
              to={identity.back}
              className="alo-icon-button"
              aria-label={`Zurück zu ${identity.back === "/" ? "Training" : identity.back === "/exercises" ? "Übungen" : "Calisthenics"}`}
            >
              <ArrowLeft aria-hidden="true" />
            </Link>
          )}
          <Link
            to={identity.module === "Mira" ? "/ai" : identity.module === "Nexus" ? "/chat" : "/"}
            className="alo-header-title alo-brand-lockup"
            aria-label={identity.title === "Alo" ? "Alo" : `Alo · ${identity.title}`}
          >
            <AloHeaderBrand title={identity.title} />
          </Link>
        </div>
        <div className="sport-header-actions">
          <button
            type="button"
            className="alo-icon-button"
            aria-label="Alo Zentrale öffnen"
            title="Plus-Menü: Schnellablage und Alo-Werkzeuge"
            onClick={() => window.dispatchEvent(new CustomEvent("alo-open", { detail: "menu" }))}
          >
            <Plus aria-hidden="true" />
          </button>
          <button
            ref={trigger}
            type="button"
            className="sport-menu-trigger"
            aria-expanded={open}
            aria-controls="sport-area-menu"
            aria-label={open ? "Weitere Bereiche schließen" : "Weitere Bereiche öffnen"}
            onClick={() => setOpen(!open)}
          >
            <span className="sr-only">Bereiche & Einstellungen</span>
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="alo-dialog alo-area-sheet"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle>Bereiche & Einstellungen</DialogTitle>
          <DialogDescription>
            {identity.module} · {identity.title}
          </DialogDescription>
          <nav id="sport-area-menu" className="sport-area-menu" aria-label="Alle Bereiche">
            <div className="alo-menu-orientation">
              <p>
                Du bist hier: {identity.module} · {identity.title}
              </p>
              <button
                className="alo-btn"
                onClick={() => {
                  setOpen(false);
                  requestAnimationFrame(() =>
                    window.dispatchEvent(new CustomEvent("alo-open", { detail: "search" })),
                  );
                }}
              >
                Überall suchen
              </button>
              <Link to="/profile" className="sport-area-link" onClick={() => setOpen(false)}>
                <UserRound aria-hidden="true" />
                Einstellungen & Profil
              </Link>
              <Link
                to="/profile"
                hash="appearance"
                aria-label="Design & Navigation öffnen"
                className="sport-area-link"
                onClick={() => setOpen(false)}
              >
                Design & Navigation
              </Link>
            </div>
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="sport-menu-label">{section.title}</p>
                {section.links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-current={pathname === link.to ? "page" : undefined}
                    className="sport-area-link"
                    onClick={() => setOpen(false)}
                  >
                    <link.icon className="h-4 w-4" aria-hidden="true" />
                    <span>{link.label}</span>
                    <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </div>
  );
}
