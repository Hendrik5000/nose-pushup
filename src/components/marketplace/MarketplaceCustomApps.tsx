import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import { MarketplacePublishedAppViewer } from "@/components/marketplace/MarketplacePublishedAppViewer";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import {
  describeMarketplaceAuthoredPermissions,
  EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  installMarketplacePublishedApp,
  loadMarketplacePublishedInstallState,
  marketplacePublishedInstallStorageKey,
  parseMarketplacePublishedInstallState,
  removeMarketplacePublishedApp,
  saveMarketplacePublishedInstallState,
  setMarketplacePublishedAppEnabled,
  updateMarketplacePublishedAppVersion,
  type MarketplaceAuthoredManifest,
  type MarketplacePublishedInstallState,
  type MarketplacePublishedVersion,
} from "@/lib/marketplace-authoring";
import { isMarketplaceAdminAccessGranted } from "@/lib/marketplace";
import {
  getMarketplaceAppVersion,
  listMarketplaceCurrentApps,
  revokeMarketplaceApp,
} from "@/lib/marketplace.functions";

type CatalogState = "loading" | "ready" | "error";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isExpectedAppVersion(app: MarketplacePublishedVersion, appId: string, version: number) {
  return app.appId === appId && app.version === version;
}

function AuthoredPermissionList({ manifest }: { manifest: MarketplaceAuthoredManifest }) {
  return (
    <section
      className="mt-4 rounded-xl border border-border/60 bg-background/50 p-3"
      aria-label={`Berechtigungen für ${manifest.name}`}
    >
      <h3 className="text-xs font-bold uppercase tracking-wide">Berechtigungen</h3>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
        {describeMarketplaceAuthoredPermissions(manifest).map((permission, index) => (
          <li key={`${index}-${permission}`}>{permission}</li>
        ))}
      </ul>
    </section>
  );
}

export function MarketplaceCustomApps({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const listApps = useServerFn(listMarketplaceCurrentApps);
  const getAppVersion = useServerFn(getMarketplaceAppVersion);
  const revokeApp = useServerFn(revokeMarketplaceApp);
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [catalogError, setCatalogError] = useState("");
  const [apps, setApps] = useState<readonly MarketplacePublishedVersion[]>([]);
  const [installState, setInstallState] = useState<MarketplacePublishedInstallState>(
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  );
  const [storageError, setStorageError] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeConfirmationApp, setRevokeConfirmationApp] =
    useState<MarketplacePublishedVersion | null>(null);
  const [status, setStatus] = useState("");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [runningAppId, setRunningAppId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setCatalogState("loading");
    setCatalogError("");
    void listApps()
      .then((items) => {
        if (!active) return;
        setApps(items);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!active) return;
        setApps([]);
        setCatalogState("error");
        setCatalogError(
          "Der gemeinsame Marketplace ist nicht verfügbar. Entwürfe werden nicht ersatzweise lokal veröffentlicht.",
        );
      });
    return () => {
      active = false;
    };
  }, [isAdmin, listApps, userId]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = () => {
      try {
        const next = loadMarketplacePublishedInstallState(window.localStorage, userId);
        setInstallState(next);
        setStorageError("");
      } catch {
        setInstallState(EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE);
        setStorageError("Lokale Installationen sind in diesem Browser nicht verfügbar.");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === marketplacePublishedInstallStorageKey(userId)) load();
    };
    load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAdmin, userId]);

  const refreshCatalog = async () => {
    const items = await listApps();
    setApps(items);
    setCatalogState("ready");
    setCatalogError("");
  };

  const verifyAdmin = async () => {
    if (!isAdmin) return false;
    try {
      return isMarketplaceAdminAccessGranted(await getAdminAreaAccess());
    } catch {
      return false;
    }
  };

  const persistInstallState = async (nextInput: unknown, message: string) => {
    if (!(await verifyAdmin())) {
      setStatus("Admin-Zugriff ist nicht mehr bestätigt. Bitte lade den Marketplace neu.");
      return false;
    }
    try {
      const next = parseMarketplacePublishedInstallState(nextInput);
      saveMarketplacePublishedInstallState(window.localStorage, userId, next);
      setInstallState(next);
      setStorageError("");
      setStatus(message);
      return true;
    } catch {
      setStorageError("Lokale Änderung nicht gespeichert. Bitte prüfe den Browserspeicher.");
      return false;
    }
  };

  const onInstall = async (app: MarketplacePublishedVersion) => {
    if (!isAdmin || catalogState !== "ready") return;
    try {
      const checked = await getAppVersion({ data: { appId: app.appId, version: app.version } });
      if (!isExpectedAppVersion(checked, app.appId, app.version))
        throw new Error("Version mismatch");
      const next = installMarketplacePublishedApp(installState, checked.appId, checked.version, {
        name: checked.manifest.name,
        icon: checked.manifest.icon,
      });
      await persistInstallState(
        next,
        `„${checked.manifest.name}“ wurde lokal mit Version ${checked.version} installiert (deaktiviert).`,
      );
    } catch {
      setStatus(
        "Diese Veröffentlichung ist nicht verfügbar. Installieren wurde nicht gespeichert.",
      );
      void refreshCatalog().catch(() => setCatalogState("error"));
    }
  };

  const onToggle = async (app: MarketplacePublishedVersion, enabled: boolean) => {
    if (!isAdmin) return;
    const installed = installState.installs.find((entry) => entry.appId === app.appId);
    if (!installed) return;
    try {
      if (enabled) {
        const next = setMarketplacePublishedAppEnabled(
          installState,
          app.appId,
          installed.version,
          false,
        );
        if (runningAppId === app.appId) setRunningAppId(null);
        await persistInstallState(next, `„${app.manifest.name}“ wurde lokal deaktiviert.`);
        return;
      }
      const checked = await getAppVersion({
        data: { appId: app.appId, version: installed.version },
      });
      if (!isExpectedAppVersion(checked, app.appId, installed.version))
        throw new Error("Version mismatch");
      const next = setMarketplacePublishedAppEnabled(
        installState,
        app.appId,
        installed.version,
        true,
      );
      await persistInstallState(next, `„${checked.manifest.name}“ wurde lokal aktiviert.`);
    } catch {
      setStatus("Diese App-Version ist nicht mehr verfügbar oder wurde widerrufen.");
      void refreshCatalog().catch(() => setCatalogState("error"));
    }
  };

  const onUpdate = async (app: MarketplacePublishedVersion) => {
    if (!isAdmin) return;
    const installed = installState.installs.find((entry) => entry.appId === app.appId);
    if (!installed || installed.version >= app.version) return;
    try {
      const checked = await getAppVersion({ data: { appId: app.appId, version: app.version } });
      if (!isExpectedAppVersion(checked, app.appId, app.version))
        throw new Error("Version mismatch");
      const next = updateMarketplacePublishedAppVersion(installState, app.appId, checked.version, {
        name: checked.manifest.name,
        icon: checked.manifest.icon,
      });
      if (runningAppId === app.appId) setRunningAppId(null);
      await persistInstallState(
        next,
        `„${checked.manifest.name}“ wurde nach deiner Bestätigung auf Version ${checked.version} aktualisiert.`,
      );
    } catch {
      setStatus(
        "Die neue App-Version ist nicht mehr verfügbar. Deine bisherige lokale Version bleibt gepinnt.",
      );
      void refreshCatalog().catch(() => setCatalogState("error"));
    }
  };

  const onRemove = async (appId: string, appName: string) => {
    if (!isAdmin) return;
    try {
      const next = removeMarketplacePublishedApp(installState, appId);
      if (runningAppId === appId) setRunningAppId(null);
      await persistInstallState(next, `„${appName}“ wurde von diesem Gerät entfernt.`);
    } catch {
      setStatus("Die lokale App-Installation konnte nicht entfernt werden.");
    }
  };

  const onConfirmRevoke = async () => {
    if (!isAdmin || !revokeConfirmationApp || isRevoking) return;
    setIsRevoking(true);
    try {
      await revokeApp({ data: { appId: revokeConfirmationApp.appId, confirmed: true } });
      setRevokeConfirmationApp(null);
      setStatus(
        `„${revokeConfirmationApp.manifest.name}“ wurde widerrufen; alle Versionen sind ab jetzt gesperrt.`,
      );
      await refreshCatalog();
    } catch (error) {
      setRevokeConfirmationApp(null);
      setStatus(errorMessage(error, "Widerruf fehlgeschlagen."));
    } finally {
      setIsRevoking(false);
    }
  };

  if (!isAdmin) return null;

  const unavailableInstalls =
    catalogState === "ready"
      ? installState.installs.filter((entry) => !apps.some((app) => app.appId === entry.appId))
      : [];
  const selectedApp = apps.find((app) => app.appId === selectedAppId) ?? null;

  return (
    <section
      className="space-y-5 rounded-2xl border border-border/70 bg-card/45 p-4 sm:p-6"
      aria-label="Veröffentlichte Alo-Apps"
    >
      <section className="space-y-3" aria-label="Veröffentlichte Admin-Apps">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              GEMEINSAMER KATALOG
            </p>
            <h3 className="mt-1 text-lg font-bold">Veröffentlichte Alo-Apps</h3>
          </div>
          {catalogState === "loading" && (
            <span className="text-xs text-muted-foreground">Katalog wird geladen …</span>
          )}
        </div>
        {catalogState === "error" && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            {catalogError}
          </p>
        )}
        {storageError && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            {storageError}
          </p>
        )}
        {catalogState === "ready" && apps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine selbst erstellten Alo-Apps veröffentlicht.
          </p>
        )}
        {catalogState === "ready" && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
            {apps.map((app) => {
              const installed = installState.installs.find((entry) => entry.appId === app.appId);
              return (
                <button
                  key={app.appId}
                  type="button"
                  aria-label={`${app.manifest.name}, Alo-Admin-App. Details öffnen${installed ? ", lokal installiert" : ""}`}
                  onClick={() => setSelectedAppId(app.appId)}
                  className="flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card/75 p-3 text-center shadow-sm transition hover:border-primary/45 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-36 sm:p-4"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-14 sm:w-14">
                    <MarketplaceIcon icon={app.manifest.icon} className="h-6 w-6 sm:h-7 sm:w-7" />
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold leading-tight sm:text-sm">
                    {app.manifest.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Version {app.currentVersion}
                  </span>
                  {installed && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Installiert
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={selectedApp !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAppId(null);
        }}
      >
        <DialogContent className="!fixed !left-0 !top-0 !z-50 !m-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none">
          {selectedApp &&
            (() => {
              const installed = installState.installs.find(
                (entry) => entry.appId === selectedApp.appId,
              );
              const enabled = installed?.enabled ?? false;
              const newerVersionAvailable =
                installed !== undefined && installed.version < selectedApp.currentVersion;
              return (
                <section
                  key={selectedApp.appId}
                  className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 pb-8 pt-16 sm:px-8 sm:pt-20"
                >
                  <header className="flex items-start gap-4">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-20 sm:w-20">
                      <MarketplaceIcon
                        icon={selectedApp.manifest.icon}
                        className="h-8 w-8 sm:h-10 sm:w-10"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        Alo-Admin · Version {selectedApp.currentVersion}
                        {selectedApp.canManage ? " · Deine App" : " · anderer Admin"}
                      </p>
                      <DialogTitle className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
                        {selectedApp.manifest.name}
                      </DialogTitle>
                    </div>
                  </header>
                  <DialogDescription className="mt-6 text-base leading-relaxed text-foreground">
                    {selectedApp.manifest.description}
                  </DialogDescription>
                  <AuthoredPermissionList manifest={selectedApp.manifest} />
                  <section className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-4">
                    <h3 className="text-sm font-bold">Installation und Versionen</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Die geprüfte App-Version wird beim Installieren vom Alo-Katalog geladen und
                      lokal auf diesem Gerät gespeichert. Aktionen bleiben auf fest registrierte
                      Alo-Ziele beschränkt.
                    </p>
                    {installed && (
                      <p className="mt-2 text-sm font-medium text-primary">
                        Lokal installiert · Version {installed.version} ·{" "}
                        {enabled ? "aktiv" : "deaktiviert"}
                      </p>
                    )}
                  </section>
                  <div className="mt-auto flex flex-wrap gap-3 pt-8">
                    {!installed ? (
                      <button
                        type="button"
                        disabled={catalogState !== "ready"}
                        onClick={() => void onInstall(selectedApp)}
                        className="min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Herunterladen & installieren
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-pressed={enabled}
                          onClick={() => void onToggle(selectedApp, enabled)}
                          className="min-h-11 rounded-xl border border-border bg-background px-5 py-2 text-sm font-semibold"
                        >
                          {enabled ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        {newerVersionAvailable && (
                          <button
                            type="button"
                            onClick={() => void onUpdate(selectedApp)}
                            className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary"
                          >
                            Auf Version {selectedApp.currentVersion} aktualisieren
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void onRemove(selectedApp.appId, selectedApp.manifest.name)
                          }
                          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground"
                        >
                          Entfernen
                        </button>
                      </>
                    )}
                    {selectedApp.canManage && (
                      <button
                        type="button"
                        onClick={() => setRevokeConfirmationApp(selectedApp)}
                        className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-destructive underline underline-offset-4"
                      >
                        Widerrufen …
                      </button>
                    )}
                    {enabled && installed && (
                      <button
                        type="button"
                        onClick={() => setRunningAppId(selectedApp.appId)}
                        className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary"
                      >
                        App öffnen · installierte Version {installed.version}
                      </button>
                    )}
                  </div>
                </section>
              );
            })()}
        </DialogContent>
      </Dialog>

      {selectedApp &&
        (() => {
          const installed = installState.installs.find(
            (entry) => entry.appId === selectedApp.appId,
          );
          if (!installed) return null;
          return (
            <MarketplacePublishedAppViewer
              userId={userId}
              appId={selectedApp.appId}
              installedVersion={installed.version}
              displayName={installed.manifestName ?? selectedApp.manifest.name}
              icon={installed.icon ?? selectedApp.manifest.icon}
              isAdmin={isAdmin}
              open={runningAppId === selectedApp.appId}
              onOpenChange={(open) => {
                if (!open) setRunningAppId(null);
              }}
              onInstallStateChange={persistInstallState}
              onStatus={setStatus}
            />
          );
        })()}

      {catalogState === "ready" && unavailableInstalls.length > 0 && (
        <section className="space-y-2" aria-label="Nicht verfügbare lokale Apps">
          <h3 className="text-sm font-bold">Nicht mehr im veröffentlichten Katalog</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Diese lokal gespeicherten Installationen sind nicht im aktiven Katalog. Ein Widerruf
            oder eine geänderte Veröffentlichung blockiert ihre Nutzung serverseitig. Entfernen
            löscht nur den lokalen Eintrag.
          </p>
          {unavailableInstalls.map((entry) => (
            <div
              key={entry.appId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
            >
              <span>
                App {entry.appId.slice(0, 8)} · lokal Version {entry.version}
              </span>
              <button
                type="button"
                onClick={() => void onRemove(entry.appId, "App")}
                className="min-h-10 rounded-lg px-3 text-xs font-semibold underline underline-offset-4"
              >
                Lokal entfernen
              </button>
            </div>
          ))}
        </section>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      <AlertDialog
        open={revokeConfirmationApp !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeConfirmationApp(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marketplace-App widerrufen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{revokeConfirmationApp?.manifest.name ?? "Alo-App"}“ wird für alle Admins und alle
              Versionen sofort gesperrt. Lokale Installationen bleiben als Status auf den Geräten,
              können die App aber bei jedem Start nicht mehr laden. Versionshistorie bleibt
              unverändert erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!revokeConfirmationApp || isRevoking}
              onClick={(event) => {
                event.preventDefault();
                void onConfirmRevoke();
              }}
            >
              {isRevoking ? "Widerrufe …" : "App widerrufen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
