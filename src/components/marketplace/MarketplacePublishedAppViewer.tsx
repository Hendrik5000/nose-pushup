import { useEffect, useMemo, useRef, useState } from "react";
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
  isMarketplaceAdminAccessGranted,
  type MarketplaceRouteTarget,
  type MarketplaceGameTarget,
} from "@/lib/marketplace";
import {
  executeMarketplaceAppAction,
  dispatchMarketplaceHostAction,
  describeMarketplaceFunctionality,
} from "@/lib/marketplace-runtime";
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
  const [actionError, setActionError] = useState("");
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [loadedScope, setLoadedScope] = useState("");
  const [reload, setReload] = useState(0);
  const scope = JSON.stringify([userId, appId, installedVersion, isAdmin, open]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const launchSequence = useRef(0);
  const actionInFlight = useRef(false);
  const ready = Boolean(userId && open && isAdmin && loadedScope === scope && !loading);
  const declaredActions = useMemo(
    () => (manifest ? getMarketplaceAuthoredActions(manifest) : []),
    [manifest],
  );
  const permissionDescriptions = useMemo(
    () => (manifest ? describeMarketplaceAuthoredPermissions(manifest) : []),
    [manifest],
  );

  useEffect(() => {
    launchSequence.current += 1;
    actionInFlight.current = false;
    setPendingActionId(null);
    setActionError("");
    setSavingPermissions(false);
    setLoadedScope("");
    if (!open) {
      setManifest(null);
      setPinnedInstall(null);
      setError("");
      setLoading(false);
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
      if (!isAdmin || !userId) throw new Error("Admin-Zugriff ist nicht bestätigt.");
      const access = await getAdminAreaAccess();
      if (!active || currentScope.current !== scope) return;
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
      if (!active || currentScope.current !== scope) return;
      setLoadedScope(scope);
      setPinnedInstall(installed);
      setManifest(checked.manifest);
      const alreadyReviewed = installed.permissionsReviewVersion === installedVersion;
      setReviewingPermissions(
        !alreadyReviewed && getMarketplaceAuthoredActions(checked.manifest).length > 0,
      );
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
        if (active && currentScope.current === scope)
          setError(messageFrom(cause, "Die installierte Alo-App konnte nicht geöffnet werden."));
      })
      .finally(() => {
        if (active && currentScope.current === scope) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appId, getAppVersion, installedVersion, isAdmin, open, userId, scope, reload]);

  const savePermissions = async () => {
    if (!manifest || !pinnedInstall || !ready || savingPermissions) return;
    setSavingPermissions(true);
    setActionError("");
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
      if (!saved || currentScope.current !== scope) return;
      const refreshed = parseMarketplacePublishedInstallState(next);
      const updated = refreshed.installs.find((entry) => entry.appId === appId) ?? null;
      setPinnedInstall(updated);
      setReviewingPermissions(false);
      onStatus?.("Berechtigungen lokal gespeichert. Keine Aktion wurde automatisch ausgeführt.");
    } catch (cause) {
      if (currentScope.current === scope)
        setActionError(
          messageFrom(cause, "Die App-Berechtigungen konnten nicht gespeichert werden."),
        );
    } finally {
      if (currentScope.current === scope) setSavingPermissions(false);
    }
  };

  const openPermissionReview = (requestedActionId?: string) => {
    if (
      !manifest ||
      !pinnedInstall ||
      !ready ||
      getMarketplaceAuthoredActions(manifest).length === 0
    )
      return;
    setSelectedActionIds(
      new Set([
        ...(pinnedInstall.grantedActionIds ?? []),
        ...(requestedActionId ? [requestedActionId] : []),
      ]),
    );
    setReviewingPermissions(true);
    setActionError("");
  };

  const runAction = async (actionId: string) => {
    if (!manifest || !pinnedInstall || !ready || actionInFlight.current) return;
    actionInFlight.current = true;
    const sequence = ++launchSequence.current;
    const isCurrent = () => currentScope.current === scope && launchSequence.current === sequence;
    setPendingActionId(actionId);
    setActionError("");
    try {
      await executeMarketplaceAppAction(
        { appId, version: installedVersion, actionId },
        {
          isCurrent,
          checkAdmin: getAdminAreaAccess,
          loadInstalls: () => loadMarketplacePublishedInstallState(window.localStorage, userId),
          getVersion: () => getAppVersion({ data: { appId, version: installedVersion } }),
          execute: (action) =>
            dispatchMarketplaceHostAction(action, {
              navigate: (to, gameId) =>
                gameId
                  ? navigate({ to: "/games", search: { game: gameId as MarketplaceGameTarget } })
                  : navigate({ to: to as MarketplaceRouteTarget }),
              openTool: (toolId) =>
                window.dispatchEvent(new CustomEvent("alo-open", { detail: toolId })),
              close: () => onOpenChange(false),
            }),
        },
      );
    } catch (cause) {
      if (isCurrent())
        setActionError(
          messageFrom(cause, "Die App-Aktion wurde aus Sicherheitsgründen blockiert."),
        );
    } finally {
      if (isCurrent()) {
        actionInFlight.current = false;
        setPendingActionId(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !z-[70] !m-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none">
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+1.5rem))] sm:px-8 sm:pt-20">
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
              <button
                type="button"
                onClick={() => setReload((value) => value + 1)}
                className="mt-3 block min-h-11 rounded-lg border border-border px-3 font-semibold"
              >
                Erneut prüfen
              </button>
            </p>
          )}
          {actionError && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              {actionError} Deine App und Freigaben bleiben erhalten.
            </p>
          )}
          {manifest && ready && !error && (
            <>
              <DialogDescription className="mt-6 text-base leading-relaxed text-foreground">
                {manifest.description}
              </DialogDescription>
              <details className="mt-4 rounded-2xl border border-border/60 bg-muted/20 px-4 py-1">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
                  {describeMarketplaceFunctionality(manifest).label} · Funktionsumfang
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                  {describeMarketplaceFunctionality(manifest).detail}
                </p>
              </details>

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
                  <fieldset disabled={savingPermissions} className="space-y-3 disabled:opacity-60">
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
                      disabled={!ready || savingPermissions}
                      className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      {savingPermissions
                        ? "Wird gespeichert …"
                        : "Berechtigungen speichern und App öffnen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      disabled={savingPermissions}
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
                    canRunActions={Boolean(ready && pinnedInstall?.enabled)}
                    allowedActionIds={pinnedInstall?.grantedActionIds ?? []}
                    pendingActionId={pendingActionId}
                    onAction={(actionId) => void runAction(actionId)}
                    onRequestPermission={openPermissionReview}
                  />
                  {declaredActions.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => openPermissionReview()}
                      disabled={!ready || pendingActionId !== null}
                      className="mt-4 min-h-11 self-start rounded-xl border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      Berechtigungen erneut prüfen
                    </button>
                  ) : (
                    <p className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3 text-sm leading-relaxed text-muted-foreground">
                      Dieses Quiz benötigt keine zusätzlichen Alo-Berechtigungen und läuft nur lokal
                      auf diesem Gerät.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
}
