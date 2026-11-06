import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import {
  describeMarketplacePermissions,
  disableMarketplacePlugin,
  EMPTY_MARKETPLACE_INSTALL_STATE,
  enableMarketplacePlugin,
  getEnabledMarketplaceAction,
  isMarketplaceAdminAccessGranted,
  isMarketplaceAdminForUser,
  installMarketplacePlugin,
  loadMarketplaceInstallState,
  MARKETPLACE_CATALOG,
  marketplaceInstallStorageKey,
  removeMarketplacePlugin,
  runMarketplaceAdminAction,
  saveMarketplaceInstallState,
  type MarketplaceCategory,
  type MarketplaceIconId,
  type MarketplaceInstallState,
} from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Alo" },
      {
        name: "description",
        content: "Kuratierte, lokal installierbare Alo-Erweiterungen.",
      },
    ],
  }),
  beforeLoad: async () => {
    let roleAccess = false;
    try {
      roleAccess = await getAdminAreaAccess();
    } catch {
      roleAccess = false;
    }
    if (!isMarketplaceAdminAccessGranted(roleAccess)) throw redirect({ to: "/" });
  },
  component: MarketplacePage,
});

const PLUGIN_ICONS = {
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
} satisfies Record<MarketplaceIconId, typeof Dumbbell>;

const CATEGORY_LABELS = {
  app: "Alo-App",
  area: "Bereich",
  tool: "Werkzeug",
} satisfies Record<MarketplaceCategory, string>;

type AccountMarketplaceState = {
  userId: string;
  state: MarketplaceInstallState;
};

function MarketplacePage() {
  const { user } = Route.useRouteContext();
  return <MarketplaceContent key={user.id} userId={user.id} />;
}

function MarketplaceContent({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [adminAccess, setAdminAccess] = useState<{ userId: string; isAdmin: boolean } | null>(null);
  const roleCheckComplete = adminAccess?.userId === userId;
  const isMarketplaceAdmin = isMarketplaceAdminForUser(adminAccess, userId);
  const [accountState, setAccountState] = useState<AccountMarketplaceState | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const state =
    accountState?.userId === userId ? accountState.state : EMPTY_MARKETPLACE_INSTALL_STATE;
  const ready = isMarketplaceAdmin && accountState?.userId === userId && !storageError;

  useEffect(() => {
    let active = true;
    void getAdminAreaAccess()
      .then((access) => {
        if (active) setAdminAccess({ userId, isAdmin: isMarketplaceAdminAccessGranted(access) });
      })
      .catch(() => {
        if (active) setAdminAccess({ userId, isAdmin: false });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (roleCheckComplete && !isMarketplaceAdmin) void navigate({ to: "/", replace: true });
  }, [isMarketplaceAdmin, navigate, roleCheckComplete]);

  useEffect(() => {
    if (!isMarketplaceAdmin) return;
    const load = () => {
      try {
        setAccountState({
          userId,
          state: loadMarketplaceInstallState(window.localStorage, userId),
        });
        setStorageError(null);
      } catch {
        setAccountState(null);
        setStorageError("Der lokale Marketplace-Speicher ist in diesem Browser nicht verfügbar.");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === marketplaceInstallStorageKey(userId)) load();
    };

    load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId, isMarketplaceAdmin]);

  const persist = (next: MarketplaceInstallState, message: string) => {
    runMarketplaceAdminAction(isMarketplaceAdmin, () => {
      try {
        saveMarketplaceInstallState(window.localStorage, userId, next);
        setAccountState({ userId, state: next });
        setStorageError(null);
        setStatus(message);
      } catch {
        setStorageError("Änderung nicht gespeichert. Bitte prüfe den lokalen Browserspeicher.");
        setStatus("");
      }
    });
  };

  const onInstall = (pluginId: string, name: string) => {
    runMarketplaceAdminAction(isMarketplaceAdmin, () => {
      try {
        persist(installMarketplacePlugin(state, pluginId), `${name} wurde lokal installiert.`);
      } catch {
        setStatus("Dieses Alo-Plugin kann nicht installiert werden.");
      }
    });
  };

  const onToggle = (pluginId: string, name: string, enabled: boolean) => {
    runMarketplaceAdminAction(isMarketplaceAdmin, () => {
      try {
        const next = enabled
          ? disableMarketplacePlugin(state, pluginId)
          : enableMarketplacePlugin(state, pluginId);
        persist(next, `${name} wurde ${enabled ? "deaktiviert" : "aktiviert"}.`);
      } catch {
        setStatus("Diese Plugin-Änderung ist nicht verfügbar.");
      }
    });
  };

  const onRemove = (pluginId: string, name: string) => {
    runMarketplaceAdminAction(isMarketplaceAdmin, () => {
      try {
        persist(
          removeMarketplacePlugin(state, pluginId),
          `${name} wurde von diesem Gerät entfernt.`,
        );
      } catch {
        setStatus("Dieses Alo-Plugin kann nicht entfernt werden.");
      }
    });
  };

  const onOpenTool = (pluginId: string) => {
    runMarketplaceAdminAction(isMarketplaceAdmin, () => {
      const action = getEnabledMarketplaceAction(state, pluginId);
      if (!action || action.type !== "open-tool") return;
      window.dispatchEvent(new CustomEvent("alo-open", { detail: action.toolId }));
    });
  };

  if (!isMarketplaceAdmin) return null;

  return (
    <HomeAppMenuLayout
      eyebrow="ALO · KURATIERT"
      title="Marketplace"
      description="Installiere vorhandene Alo-Apps, Bereiche und Werkzeuge. Einträge öffnen nur vorregistrierte Alo-Ziele; Drittanbieter-Pakete und ausführbare Plugin-Skripte gibt es hier nicht."
    >
      <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
        Installationen und Aktivierungen werden nur in diesem Browser auf diesem Gerät gespeichert,
        getrennt nach deinem Alo-Konto. Sie werden nicht mit der Alo-Cloud oder anderen Geräten
        synchronisiert.
      </aside>

      {storageError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          {storageError}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        aria-label="Kuratierte Alo-Apps, Bereiche und Werkzeuge"
      >
        {MARKETPLACE_CATALOG.map((plugin) => {
          const Icon = PLUGIN_ICONS[plugin.icon];
          const installed = state.installedPluginIds.includes(plugin.id);
          const enabled = state.enabledPluginIds.includes(plugin.id);

          return (
            <article
              key={plugin.id}
              aria-labelledby={`marketplace-${plugin.id}-title`}
              className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm sm:p-5"
            >
              <header className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    {CATEGORY_LABELS[plugin.category]} · {plugin.publisher} · Version{" "}
                    {plugin.version}
                  </p>
                  <h2
                    id={`marketplace-${plugin.id}-title`}
                    className="mt-1 text-base font-bold leading-tight"
                  >
                    {plugin.name}
                  </h2>
                </div>
                {installed && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    Auf diesem Gerät installiert
                  </span>
                )}
              </header>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {plugin.description}
              </p>

              <section
                className="mt-4 rounded-xl border border-border/60 bg-background/50 p-3"
                aria-label={`Berechtigungen für ${plugin.name}`}
              >
                <h3 className="text-xs font-bold uppercase tracking-wide">Berechtigungen</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                  {describeMarketplacePermissions(plugin).map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              </section>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {!installed ? (
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => onInstall(plugin.id, plugin.name)}
                    className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Installieren
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-pressed={enabled}
                      disabled={!ready}
                      onClick={() => onToggle(plugin.id, plugin.name, enabled)}
                      className="min-h-11 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {enabled ? "Deaktivieren" : "Aktivieren"}
                    </button>
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => onRemove(plugin.id, plugin.name)}
                      className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Entfernen
                    </button>
                  </>
                )}

                {enabled && plugin.action.type === "navigate" && (
                  <Link
                    to={plugin.action.to}
                    className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Öffnen
                  </Link>
                )}
                {enabled && plugin.action.type === "open-game" && (
                  <Link
                    to="/games"
                    search={{ game: plugin.action.gameId }}
                    className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Öffnen
                  </Link>
                )}
                {enabled && plugin.action.type === "open-tool" && (
                  <button
                    type="button"
                    onClick={() => onOpenTool(plugin.id)}
                    className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Öffnen
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!ready && !storageError && (
        <p className="text-center text-xs text-muted-foreground" role="status">
          Lokaler Installationsstatus wird geladen …
        </p>
      )}
    </HomeAppMenuLayout>
  );
}
