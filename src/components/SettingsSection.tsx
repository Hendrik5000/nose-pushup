import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import {
  Activity,
  Award,
  Bell,
  Brain,
  Bug,
  ChevronDown,
  Dumbbell,
  Globe,
  HeartPulse,
  History,
  KeyRound,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouterState } from "@tanstack/react-router";

/**
 * Samsung-Settings-artiger aufklappbarer Abschnitt:
 * Kopfzeile mit Icon + Titel (+ optionaler Zusammenfassung) und einklappbarem Inhalt.
 */
export function SettingsSection({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  id,
  profileAppearance = false,
  revealKey,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  id?: string;
  profileAppearance?: boolean;
  revealKey?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [visited, setVisited] = useState(defaultOpen);
  const contentId = useId();
  useEffect(() => {
    if (open) setVisited(true);
  }, [open]);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const revealParent = (event: Event) => {
      if (event.target !== section) setOpen(true);
    };
    const revealAppearance = () => setOpen(true);
    section.addEventListener("profile-section-reveal", revealParent);
    section.addEventListener("profile-appearance-reveal", revealAppearance);
    return () => {
      section.removeEventListener("profile-section-reveal", revealParent);
      section.removeEventListener("profile-appearance-reveal", revealAppearance);
    };
  }, []);
  const routeHash = useRouterState({ select: (state) => state.location.hash });
  useEffect(() => {
    if (!id && !profileAppearance) return;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      const targetId = profileAppearance ? "appearance" : id;
      if (!targetId || window.location.hash !== `#${targetId}`) return;

      // Responsive profile layouts can contain equivalent targets. Only reveal
      // the target in the layout that is currently mounted and visible.
      const target = Array.from(document.querySelectorAll<HTMLElement>("[id]")).find(
        (element) => element.id === targetId && element.getClientRects().length > 0,
      );
      const section = sectionRef.current;
      if (!target || !section) return;
      // A nested appearance section is mounted only after its parent opens, so
      // it must recognize the same fragment on its first render as well.
      if (profileAppearance && target !== section && target.contains(section)) {
        setOpen(true);
        return;
      }
      if (target !== section) return;

      setOpen(true);
      section.dispatchEvent(new CustomEvent("profile-section-reveal", { bubbles: true }));
      section.querySelectorAll<HTMLElement>('[data-profile-appearance="true"]').forEach((child) => {
        child.dispatchEvent(new CustomEvent("profile-appearance-reveal"));
      });
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (section.getClientRects().length > 0) section.scrollIntoView({ block: "start" });
      }, 350);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener("hashchange", reveal);
    };
  }, [id, profileAppearance, revealKey, routeHash]);
  const SportIcon = title.includes("Coach")
    ? Brain
    : title.includes("Freund")
      ? Users
      : title.includes("Design") || title.includes("Darstellung")
        ? Palette
        : title.includes("Verlauf")
          ? History
          : title.includes("Fehler")
            ? Bug
            : title.includes("Badge")
              ? Award
              : title.includes("Öffentlich")
                ? Globe
                : title.includes("Benachrichtigung")
                  ? Bell
                  : title.includes("Health") || title.includes("Gesund")
                    ? HeartPulse
                    : title.includes("Datenschutz")
                      ? ShieldCheck
                      : title.includes("API") || title.includes("KI")
                        ? KeyRound
                        : title.includes("Feedback") || title.includes("Sound")
                          ? Volume2
                          : title.includes("Training")
                            ? Dumbbell
                            : title.includes("Profil") || title.includes("Konto")
                              ? UserRound
                              : SlidersHorizontal;

  return (
    <section
      ref={sectionRef}
      id={id}
      className="settings-section overflow-hidden rounded-3xl border border-border bg-card/60 backdrop-blur"
      data-profile-appearance={profileAppearance ? "true" : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition active:scale-[0.99]"
      >
        <span className="settings-section-icon-chip flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-sm">
          <span className="settings-section-emoji">{icon}</span>
          <SportIcon className="settings-section-vector h-6 w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {subtitle && (
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          )}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <div
        id={contentId}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="settings-section-content border-t border-border px-5 py-4">
            {(open || visited) && children}
          </div>
        </div>
      </div>
    </section>
  );
}
