import { ArrowLeft, HeartPulse, Watch } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { BottomNav } from "@/components/BottomNav";
import { HealthConnectPanel } from "@/components/HealthConnectPanel";
import { MiraContextControls } from "@/components/alo/MiraContextControls";
import { SmartwatchPanel } from "@/components/SmartwatchPanel";
import { DesignView } from "@/components/DesignView";
import { MiraAppSettingsControls } from "@/components/mira/MiraAppSettingsControls";
import {
  getAppSettingsEntry,
  type AppSettingsReturnTarget,
  type FullScreenAppSettingsId,
} from "@/lib/app-settings";
import type { ReactNode } from "react";

export function AppSettingsPage({
  appId,
  userId,
  returnTo,
}: {
  appId: FullScreenAppSettingsId;
  userId: string;
  returnTo: AppSettingsReturnTarget;
}) {
  const app = getAppSettingsEntry(appId)!;
  const sections =
    appId === "mira" ? (
      <>
        <SettingsBlock title="Anbieter & Sprache" description="KI-Anbieter und Spracheingabe">
          <MiraAppSettingsControls userId={userId} />
        </SettingsBlock>
        <SettingsBlock
          title="Datenfreigaben"
          description="Training und einzeln ausgewählte Nexus-Räume"
        >
          <MiraContextControls userId={userId} />
        </SettingsBlock>
      </>
    ) : (
      <>
        <SettingsBlock
          title="Health Connect"
          description="Zugriff, manuelle Werte und automatische Aktualisierung"
          icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
        >
          <HealthConnectPanel />
        </SettingsBlock>
        <SettingsBlock
          title="Smartwatch"
          description="Gerät koppeln, Daten importieren und synchronisieren"
          icon={<Watch className="h-5 w-5" aria-hidden="true" />}
        >
          <SmartwatchPanel />
        </SettingsBlock>
      </>
    );

  return (
    <>
      <DesignView variant="classic">
        <main className="classic-only mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-4 px-4 pt-5 pb-28 sm:px-8">
          <AppSettingsHeader
            appTitle={app.title}
            description={app.description}
            returnTo={returnTo}
            variant="classic"
          />
          <div className="space-y-3">{sections}</div>
          <BottomNav />
        </main>
      </DesignView>
      <DesignView variant="sport">
        <main className="sport-only mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-4 px-5 py-6 pb-28 sm:px-8">
          <AppSettingsHeader
            appTitle={app.title}
            description={app.description}
            returnTo={returnTo}
            variant="sport"
          />
          <div className="space-y-3">{sections}</div>
          <BottomNav />
        </main>
      </DesignView>
    </>
  );
}

function AppSettingsHeader({
  appTitle,
  description,
  returnTo,
  variant,
}: {
  appTitle: string;
  description: string;
  returnTo: AppSettingsReturnTarget;
  variant: "classic" | "sport";
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, [appTitle]);

  return (
    <header className="flex items-start gap-2 sm:gap-3">
      <AppSettingsBackLink returnTo={returnTo} variant={variant} />
      <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--menu-accent)]">
          Alo · App-Einstellungen
        </p>
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="mt-1 text-xl font-bold tracking-tight focus:outline-none sm:text-2xl"
        >
          {appTitle}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Link
        to="/"
        aria-label="Zur Alo-Startseite"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/70 px-2 text-xs font-semibold text-foreground transition hover:border-[var(--menu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)] sm:px-3 sm:text-sm"
      >
        <span className="hidden sm:inline">← Startseite</span>
        <span className="sm:hidden" aria-hidden="true">
          ←
        </span>
      </Link>
    </header>
  );
}

function SettingsBlock({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--menu-accent-soft)] text-[var(--menu-accent)]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className={`${icon ? "mt-4" : "mt-3"} space-y-3`}>{children}</div>
    </section>
  );
}

function AppSettingsBackLink({
  returnTo,
  variant,
}: {
  returnTo: AppSettingsReturnTarget;
  variant: "classic" | "sport";
}) {
  const className =
    variant === "sport"
      ? "sport-back-link inline-flex min-h-11 min-w-11 items-center justify-center"
      : "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--menu-accent)]";
  const label =
    returnTo === "/ai"
      ? "Zurück zu Mira"
      : returnTo === "/health"
        ? "Zurück zu Health"
        : "Zurück zu Apps";
  const content = (
    <>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </>
  );

  if (returnTo === "/ai") {
    return (
      <Link to="/ai" aria-label={label} className={className}>
        {content}
      </Link>
    );
  }
  if (returnTo === "/health") {
    return (
      <Link to="/health" aria-label={label} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <Link
      to="/settings/$category"
      params={{ category: "apps" }}
      aria-label={label}
      className={className}
    >
      {content}
    </Link>
  );
}
