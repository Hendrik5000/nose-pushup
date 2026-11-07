import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import { MarketplaceManifestView } from "@/components/marketplace/MarketplaceManifestView";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import {
  describeMarketplaceAuthoredPermissions,
  getMarketplaceAuthoredActions,
  loadMarketplacePublishedInstallState,
  parseMarketplacePublishedInstallState,
  setMarketplacePublishedAppPermissions,
  type MarketplaceAuthoredManifest,
  type MarketplacePublishedInstall,
} from "@/lib/marketplace-authoring";
import {
  getMarketplaceAuthorAction,
  isMarketplaceAdminAccessGranted,
  type MarketplaceHostAction,
} from "@/lib/marketplace";
import { getMarketplaceAppVersion } from "@/lib/marketplace.functions";

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isExpectedVersion(
  app: { appId: string; version: number },
  appId: string,
  version: number,
) {
  return app.appId === appId && app.version === version;
}

export function MarketplacePublishedAppViewer({
  userId,
  appId,
  installedVersion,
  displayName,
  icon,
  isAdmin,
  open,
  onOpenChange,
  onInstallStateChange,
  onStatus,
}: {
  userId: string;
  appId: string;
  installedVersion: number;
  displayName: string;
  icon: MarketplacePublishedInstall["icon"];
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstallStateChange: (next: unknown, status: string) => Promise<boolean>;
  onStatus?: (status: string) => void;
}) {
  const navigate = useNavigate();
  const getAppVersion = useServerFn(getMarketplaceAppVersion);
  const [manifest, setManifest] = useState<MarketplaceAuthoredManifest | null>(null);
  const [pinnedInstall, setPinnedInstall] = useState<MarketplacePublishedInstall | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewingPermissions, setReviewingPermissions] = useState(false);
  const [selectedActionIds, setSelectedActionIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const declaredActions = useMemo(
    () => (manifest ? getMarketplaceAuthoredActions(manifest) : []),
    [manifest],
  );
  const permissionDescriptions = useMemo(
    () => (manifest ? describeMarketplaceAuthoredPermissions(manifest) : []),
    [manifest],
  );

  useEffect(() => {
    if (!open) {
      setManifest(null);
      setPinnedInstall(null);
      setError("");
      setReviewingPermissions(false);
      setSelectedActionIds(new Set());
      return;
    }
    let active = true;
    setLoading(true);
    setManifest(null);
    setPinnedInstall(null);
    setError("");
    void (async () => {
      if (!isAdmin) throw new Error("Admin-Zugriff ist nicht bestätigt.");
      const access = await getAdminAreaAccess();
      if (!isMarketplaceAdminAccessGranted(access)) {
        throw new Error("Admin-Zugriff ist nicht mehr bestätigt. Der App-Start wurde blockiert.");
      }
      const local = loadMarketplacePublishedInstallState(window.localStorage, userId);
      const installed = local.installs.find((entry) => entry.appId === appId);
      if (!installed || !installed.enabled || installed.version !== installedVersion) {
        throw new Error(
          "Diese App ist nicht mehr aktiv oder ihre installierte Version hat sich geändert.",
        );
      }
      const checked = await getAppVersion({ data: { appId, version: installedVersion } });
      if (!isExpectedVersion(checked, appId, installedVersion)) {
        throw new Error(
          "Der veröffentlichte App-Inhalt stimmt nicht mit der installierten Version überein.",
        );
      }
      if (!active) return;
      setPinnedInstall(installed);
      setManifest(checked.manifest);
      const alreadyReviewed = installed.permissionsReviewVersion === installedVersion;
      setReviewingPermissions(!alreadyReviewed);
      setSelectedActionIds(
        new Set(
          alreadyReviewed
            ? (installed.grantedActionIds ?? []).filter((actionId) =>
                checked.manifest.blocks.some(
                  (block) => block.type === "action" && block.actionId === actionId,
                ),
              )
            : [],
        ),
      );
    })()
      .catch((cause: unknown) => {
        if (active)
          setError(messageFrom(cause, "Die installierte Alo-App konnte nicht geöffnet werden."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appId, getAppVersion, installedVersion, isAdmin, open, userId]);

  const performHostAction = (action: MarketplaceHostAction) => {
    onOpenChange(false);
    if (action.type === "navigate") {
      void navigate({ to: action.to });
    } else if (action.type === "open-game") {
      void navigate({ to: "/games", search: { game: action.gameId } });
    } else {
      window.dispatchEvent(new CustomEvent("alo-open", { detail: action.toolId }));
    }
  };

  const savePermissions = async () => {
    if (!manifest || !pinnedInstall || !isAdmin) return;
    try {
      const latest = loadMarketplacePublishedInstallState(window.localStorage, userId);
      const next = setMarketplacePublishedAppPermissions(
        latest,
        appId,
        installedVersion,
        manifest,
        [...selectedActionIds],
      );
      const saved = await onInstallStateChange(
        next,
        `Berechtigungen für „${displayName}“ Version ${installedVersion} gespeichert.`,
      );
      if (!saved) return;
      const refreshed = parseMarketplacePublishedInstallState(next);
      const updated = refreshed.installs.find((entry) => entry.appId === appId) ?? null;
      setPinnedInstall(updated);
      setReviewingPermissions(false);
      onStatus?.("Berechtigungen lokal gespeichert. Keine Aktion wurde automatisch ausgeführt.");
    } catch (cause) {
      setError(messageFrom(cause, "Die App-Berechtigungen konnten nicht gespeichert werden."));
    }
  };

  const openPermissionReview = () => {
    if (!manifest || !pinnedInstall) return;
    setSelectedActionIds(new Set(pinnedInstall.grantedActionIds ?? []));
    setReviewingPermissions(true);
    setError("");
  };

  const runAction = async (actionId: string) => {
    if (!manifest || !pinnedInstall || !isAdmin || pendingActionId) return;
    setPendingActionId(actionId);
    setError("");
    try {
      const access = await getAdminAreaAccess();
      if (!isMarketplaceAdminAccessGranted(access)) {
        throw new Error("Admin-Zugriff ist nicht mehr bestätigt. Die Aktion wurde blockiert.");
      }
      const latest = loadMarketplacePublishedInstallState(window.localStorage, userId);
      const stillInstalled = latest.installs.find(
        (entry) =>
          entry.appId === appId &&
          entry.version === installedVersion &&
          entry.enabled &&
          entry.permissionsReviewVersion === installedVersion &&
          entry.grantedActionIds?.includes(actionId),
      );
      if (!stillInstalled) throw new Error("Diese Aktion ist lokal nicht freigegeben.");
      const checked = await getAppVersion({ data: { appId, version: installedVersion } });
      if (!isExpectedVersion(checked, appId, installedVersion)) {
        throw new Error("Diese App-Version ist nicht mehr verfügbar.");
      }
      const isDeclared = checked.manifest.blocks.some(
        (block) => block.type === "action" && block.actionId === actionId,
      );
      const registered = getMarketplaceAuthorAction(actionId);
      if (!isDeclared || !registered)
        throw new Error("Die Aktion ist nicht im Alo-Host registriert.");
      performHostAction(registered.action);
    } catch (cause) {
      setError(messageFrom(cause, "Die App-Aktion wurde aus Sicherheitsgründen blockiert."));
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !z-[70] !m-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none">
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-5 pb-10 pt-16 sm:px-8 sm:pt-20">
          <header className="flex items-start gap-4">
            {icon && (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-16 sm:w-16">
                <MarketplaceIcon icon={icon} className="h-7 w-7 sm:h-8 sm:w-8" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Alo-App · installierte Version {installedVersion}
              </p>
              <DialogTitle className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
                {displayName}
              </DialogTitle>
            </div>
          </header>

          {loading && (
            <p className="mt-8 text-sm text-muted-foreground">App-Version wird sicher geprüft …</p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              {error}
            </p>
          )}
          {manifest && !loading && !error && (
            <>
              <DialogDescription className="mt-6 text-base leading-relaxed text-foreground">
                {manifest.description}
              </DialogDescription>

              {reviewingPermissions ? (
                <section className="mt-6 space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-6">
                  <div>
                    <h2 className="text-lg font-bold">
                      {pinnedInstall?.permissionsReviewVersion === installedVersion
                        ? "Berechtigungen prüfen"
                        : "Zugriffe vor dem ersten Start auswählen"}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Wähle einzeln, welche bereits fest registrierten Alo-Aktionen diese App nach
                      deinem Tippen öffnen darf. Die App führt beim Öffnen nichts automatisch aus.
                      Für ein späteres Ändern kannst du die Berechtigungen jederzeit erneut prüfen.
                    </p>
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="sr-only">Freigegebene App-Aktionen</legend>
                    {declaredActions.map((action, index) => (
                      <label
                        key={action.id}
                        className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-3"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0 accent-primary"
                          checked={selectedActionIds.has(action.id)}
                          onChange={(event) =>
                            setSelectedActionIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(action.id);
                              else next.delete(action.id);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{action.label}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {permissionDescriptions[index]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void savePermissions()}
                      className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Berechtigungen speichern und App öffnen
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                    >
                      Später
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <MarketplaceManifestView
                    manifest={manifest}
                    canRunActions={Boolean(pinnedInstall?.enabled)}
                    allowedActionIds={pinnedInstall?.grantedActionIds ?? []}
                    pendingActionId={pendingActionId}
                    onAction={(actionId) => void runAction(actionId)}
                  />
                  <button
                    type="button"
                    onClick={openPermissionReview}
                    className="mt-4 min-h-11 self-start rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                  >
                    Berechtigungen erneut prüfen
                  </button>
                </>
              )}
            </>
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
}
