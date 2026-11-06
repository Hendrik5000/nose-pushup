import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
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
import { MarketplaceManifestView } from "@/components/marketplace/MarketplaceManifestView";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import { loadProviders, selectProvider } from "@/lib/ai-providers";
import {
  describeMarketplaceAuthoredPermissions,
  EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  generateMarketplaceManifestDraft,
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
  type MarketplaceMiraSend,
} from "@/lib/marketplace-authoring";
import {
  getMarketplaceAuthorAction,
  isMarketplaceAdminAccessGranted,
  type MarketplaceHostAction,
} from "@/lib/marketplace";
import {
  getMarketplaceAppVersion,
  listMarketplaceCurrentApps,
  publishMarketplaceApp,
  revokeMarketplaceApp,
} from "@/lib/marketplace.functions";
import { superAiChat } from "@/lib/super-ai.functions";

type DraftTarget = Readonly<{
  appId: string;
  expectedVersion: number;
  appName: string;
}>;

type Draft = Readonly<{
  manifest: MarketplaceAuthoredManifest;
  target: DraftTarget | null;
  providerLabel: string;
}>;

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
  const navigate = useNavigate();
  const listApps = useServerFn(listMarketplaceCurrentApps);
  const getAppVersion = useServerFn(getMarketplaceAppVersion);
  const publishApp = useServerFn(publishMarketplaceApp);
  const revokeApp = useServerFn(revokeMarketplaceApp);
  const sendMira = useServerFn(superAiChat);
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [catalogError, setCatalogError] = useState("");
  const [apps, setApps] = useState<readonly MarketplacePublishedVersion[]>([]);
  const [openedPinnedApps, setOpenedPinnedApps] = useState<
    Record<string, { version: number; manifest: MarketplaceAuthoredManifest }>
  >({});
  const [installState, setInstallState] = useState<MarketplacePublishedInstallState>(
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  );
  const [storageError, setStorageError] = useState("");
  const [goal, setGoal] = useState("");
  const [target, setTarget] = useState<DraftTarget | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [publishConfirmationOpen, setPublishConfirmationOpen] = useState(false);
  const [revokeConfirmationApp, setRevokeConfirmationApp] =
    useState<MarketplacePublishedVersion | null>(null);
  const [status, setStatus] = useState("");

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

  const onGenerate = async () => {
    if (!isAdmin || isGenerating || !(await verifyAdmin())) {
      setStatus("Admin-Zugriff ist nicht mehr bestätigt. Bitte lade den Marketplace neu.");
      return;
    }
    const prompt = goal.trim();
    if (!prompt) {
      setStatus("Beschreibe zuerst das Ziel deiner Alo-App.");
      return;
    }
    const selection = selectProvider(loadProviders(userId), "general");
    if (!selection.provider) {
      setStatus(
        "Kein aktivierter Mira-KI-Anbieter mit Zugangsdaten gefunden. Prüfe deine Mira-Einstellungen.",
      );
      return;
    }

    const generationTarget = target;
    setIsGenerating(true);
    setDraft(null);
    setStatus("Mira erstellt einen lokalen Entwurf …");
    try {
      const send: MarketplaceMiraSend = ({ data }) => sendMira({ data });
      const manifest = await generateMarketplaceManifestDraft(prompt, selection.provider, send);
      setDraft({ manifest, target: generationTarget, providerLabel: selection.provider.label });
      setStatus(
        "Entwurf erstellt und lokal in dieser Sitzung gehalten. Noch nicht veröffentlicht.",
      );
    } catch (error) {
      setStatus(errorMessage(error, "Mira konnte keinen sicheren App-Entwurf erstellen."));
    } finally {
      setIsGenerating(false);
    }
  };

  const startNewApp = () => {
    setTarget(null);
    setDraft(null);
    setGoal("");
    setStatus("Beschreibe die neue Alo-App, die Mira entwerfen soll.");
  };

  const startNewVersion = (app: MarketplacePublishedVersion) => {
    if (!isAdmin || !app.canManage) return;
    setTarget({
      appId: app.appId,
      expectedVersion: app.currentVersion,
      appName: app.manifest.name,
    });
    setDraft(null);
    setGoal("");
    setStatus(`Zielversion ${app.currentVersion + 1} für „${app.manifest.name}“ wird vorbereitet.`);
  };

  const onInstall = async (app: MarketplacePublishedVersion) => {
    if (!isAdmin || catalogState !== "ready") return;
    try {
      const checked = await getAppVersion({ data: { appId: app.appId, version: app.version } });
      if (!isExpectedAppVersion(checked, app.appId, app.version))
        throw new Error("Version mismatch");
      const next = installMarketplacePublishedApp(installState, checked.appId, checked.version);
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

  const onLaunch = async (app: MarketplacePublishedVersion) => {
    if (!isAdmin) return;
    const installed = installState.installs.find((entry) => entry.appId === app.appId);
    if (!installed?.enabled) return;
    try {
      const checked = await getAppVersion({
        data: { appId: app.appId, version: installed.version },
      });
      if (!isExpectedAppVersion(checked, app.appId, installed.version))
        throw new Error("Version mismatch");
      setOpenedPinnedApps((current) => ({
        ...current,
        [app.appId]: { version: checked.version, manifest: checked.manifest },
      }));
      setStatus(
        `„${checked.manifest.name}“ Version ${checked.version} wurde serverseitig geprüft.`,
      );
    } catch {
      setOpenedPinnedApps((current) => {
        const next = { ...current };
        delete next[app.appId];
        return next;
      });
      setStatus("Diese installierte Version wurde widerrufen oder ist nicht verfügbar.");
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
        setOpenedPinnedApps((current) => {
          const nextOpened = { ...current };
          delete nextOpened[app.appId];
          return nextOpened;
        });
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
      const next = updateMarketplacePublishedAppVersion(installState, app.appId, checked.version);
      setOpenedPinnedApps((current) => {
        const nextOpened = { ...current };
        delete nextOpened[app.appId];
        return nextOpened;
      });
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
      await persistInstallState(next, `„${appName}“ wurde von diesem Gerät entfernt.`);
    } catch {
      setStatus("Die lokale App-Installation konnte nicht entfernt werden.");
    }
  };

  const performHostAction = (action: MarketplaceHostAction) => {
    if (action.type === "navigate") {
      void navigate({ to: action.to });
    } else if (action.type === "open-game") {
      void navigate({ to: "/games", search: { game: action.gameId } });
    } else {
      window.dispatchEvent(new CustomEvent("alo-open", { detail: action.toolId }));
    }
  };

  const onOpenAction = async (appId: string, actionId: string) => {
    if (!isAdmin) return;
    const installed = installState.installs.find((entry) => entry.appId === appId);
    if (!installed?.enabled || openedPinnedApps[appId]?.version !== installed.version) return;
    try {
      const checked = await getAppVersion({ data: { appId, version: installed.version } });
      if (!isExpectedAppVersion(checked, appId, installed.version))
        throw new Error("Version mismatch");
      const isDeclared = checked.manifest.blocks.some(
        (block) => block.type === "action" && block.actionId === actionId,
      );
      const registered = getMarketplaceAuthorAction(actionId);
      if (!isDeclared || !registered) throw new Error("Action not registered");
      const stillInstalled = installState.installs.find(
        (entry) => entry.appId === appId && entry.version === installed.version && entry.enabled,
      );
      if (!stillInstalled) return;
      performHostAction(registered.action);
    } catch {
      setStatus("Diese App wurde widerrufen oder ist nicht verfügbar. Der Start wurde blockiert.");
      void refreshCatalog().catch(() => setCatalogState("error"));
    }
  };

  const onAskPublish = async () => {
    if (!isAdmin || !draft) {
      setStatus("Admin-Zugriff oder App-Entwurf ist nicht verfügbar.");
      return;
    }
    if (isPublishing) return;
    if (!(await verifyAdmin())) {
      setStatus("Admin-Zugriff ist nicht mehr bestätigt. Bitte lade den Marketplace neu.");
      return;
    }
    setPublishConfirmationOpen(true);
  };

  const onConfirmPublish = async () => {
    if (!isAdmin || !draft || isPublishing) return;
    setIsPublishing(true);
    try {
      const input = draft.target
        ? {
            manifest: draft.manifest,
            confirmed: true as const,
            appId: draft.target.appId,
            expectedVersion: draft.target.expectedVersion,
          }
        : { manifest: draft.manifest, confirmed: true as const };
      const result = await publishApp({ data: input });
      setPublishConfirmationOpen(false);
      setDraft(null);
      setTarget(null);
      setGoal("");
      setStatus(
        `„${draft.manifest.name}“ wurde als Version ${result.version} für Alo-Admins veröffentlicht.`,
      );
      await refreshCatalog();
    } catch (error) {
      setPublishConfirmationOpen(false);
      setStatus(
        errorMessage(error, "Veröffentlichung fehlgeschlagen. Der Entwurf blieb unveröffentlicht."),
      );
      void refreshCatalog().catch(() => setCatalogState("error"));
    } finally {
      setIsPublishing(false);
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

  const installedIds = new Set(installState.installs.map((entry) => entry.appId));
  const unavailableInstalls =
    catalogState === "ready"
      ? installState.installs.filter((entry) => !apps.some((app) => app.appId === entry.appId))
      : [];

  return (
    <section
      className="space-y-5 rounded-2xl border border-border/70 bg-card/45 p-4 sm:p-6"
      aria-label="Eigene Alo-Apps"
    >
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          MIRA · ADMIN-APP-BUILDER
        </p>
        <h2 className="text-xl font-bold">Eigene Alo-App mit Mira erstellen</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Mira erzeugt nur einen lokalen, deklarativen Entwurf aus festen Text-, Listen- und
          Aktionsblöcken. Keine ausführbaren Plugins, kein HTML/JavaScript und keine neuen Daten-,
          Provider- oder Netzwerkrechte.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          An Mira geht nur das Ziel, das du unten ausdrücklich eingibst. Frühere Chats, Anhänge
          sowie Gesundheits- oder Trainingsdaten werden nicht automatisch mitgesendet. Der Entwurf
          bleibt bis zur ausdrücklichen Veröffentlichung lokal in dieser Sitzung.
        </p>
      </header>

      <div className="space-y-3">
        {target ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <span>
              Neue Version für „{target.appName}“ · erwartet wird Version {target.expectedVersion}
            </span>
            <button
              type="button"
              onClick={startNewApp}
              disabled={isGenerating}
              className="min-h-10 rounded-lg px-3 text-xs font-semibold underline underline-offset-4"
            >
              Stattdessen neue App
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={startNewApp}
              className="min-h-10 rounded-lg border border-border px-3 text-xs font-semibold"
            >
              Neue App
            </button>
          </div>
        )}
        <label htmlFor="marketplace-app-goal" className="block text-sm font-semibold">
          Was soll die App tun?
        </label>
        <textarea
          id="marketplace-app-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value.slice(0, 2000))}
          maxLength={2000}
          rows={3}
          placeholder="Zum Beispiel: Eine kompakte Schnellstart-Seite mit einer Schaltfläche zu meinen Trainingsprogrammen."
          className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={isGenerating || !goal.trim()}
            className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "Mira entwirft …" : "Mit Mira entwerfen"}
          </button>
          <span className="text-xs text-muted-foreground">
            Übernimmt den in Mira aktivierten Anbieter für „allgemeine Anfrage“.
          </span>
        </div>
      </div>

      {draft && (
        <article
          className="rounded-2xl border border-primary/25 bg-background/70 p-4"
          aria-labelledby="marketplace-draft-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Lokaler Entwurf · noch nicht geteilt
              </p>
              <h3 id="marketplace-draft-title" className="mt-1 text-base font-bold">
                {draft.manifest.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Mira-Anbieter: {draft.providerLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-10 rounded-lg px-3 text-xs font-semibold underline underline-offset-4"
            >
              Entwurf verwerfen
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {draft.manifest.description}
          </p>
          <MarketplaceManifestView manifest={draft.manifest} preview />
          <AuthoredPermissionList manifest={draft.manifest} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onAskPublish()}
              disabled={!isAdmin || isPublishing}
              className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {draft.target
                ? `Version ${draft.target.expectedVersion + 1} veröffentlichen …`
                : "Für Alo-Admins veröffentlichen …"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Verwerfen
            </button>
          </div>
        </article>
      )}

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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {apps.map((app) => {
              const installed = installState.installs.find((entry) => entry.appId === app.appId);
              const enabled = installed?.enabled ?? false;
              const pinnedVersion = installed?.version;
              const newerVersionAvailable =
                installed !== undefined && installed.version < app.currentVersion;
              return (
                <article
                  key={app.appId}
                  className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm"
                  aria-label={`Alo-App ${app.manifest.name}`}
                >
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Alo-Admin · Version {app.currentVersion}
                        {app.canManage ? " · Deine App" : " · anderer Admin"}
                      </p>
                      <h4 className="mt-1 text-base font-bold">{app.manifest.name}</h4>
                    </div>
                    {installed && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        Lokal installiert · Version {pinnedVersion}
                        {enabled ? " · aktiv" : " · deaktiviert"}
                      </span>
                    )}
                  </header>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {app.manifest.description}
                  </p>
                  <AuthoredPermissionList manifest={app.manifest} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!installed ? (
                      <button
                        type="button"
                        disabled={catalogState !== "ready"}
                        onClick={() => void onInstall(app)}
                        className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        Lokal installieren
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-pressed={enabled}
                          onClick={() => void onToggle(app, enabled)}
                          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                        >
                          {enabled ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        {newerVersionAvailable && (
                          <button
                            type="button"
                            onClick={() => void onUpdate(app)}
                            className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary"
                          >
                            Auf Version {app.currentVersion} aktualisieren
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void onRemove(app.appId, app.manifest.name)}
                          className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground underline underline-offset-4"
                        >
                          Entfernen
                        </button>
                      </>
                    )}
                    {app.canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => startNewVersion(app)}
                          disabled={isGenerating}
                          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                        >
                          Neue Version mit Mira
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevokeConfirmationApp(app)}
                          className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-destructive underline underline-offset-4"
                        >
                          Widerrufen …
                        </button>
                      </>
                    )}
                  </div>
                  {enabled && installed && (
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => void onLaunch(app)}
                        className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary"
                      >
                        App öffnen · installierte Version {installed.version}
                      </button>
                      {openedPinnedApps[app.appId]?.version === installed.version && (
                        <MarketplaceManifestView
                          manifest={openedPinnedApps[app.appId].manifest}
                          canRunActions
                          onAction={(actionId) => void onOpenAction(app.appId, actionId)}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

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

      <AlertDialog open={publishConfirmationOpen} onOpenChange={setPublishConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Für alle Alo-Admins veröffentlichen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{draft?.manifest.name ?? "Alo-App"}“ wird als Version{" "}
              {draft?.target ? draft.target.expectedVersion + 1 : 1} im gemeinsamen
              Admin-Marketplace gespeichert. Alle Alo-Admins können die deklarative App sehen und
              lokal installieren. Diese Aktion teilt nur das geprüfte Manifest, keine Chats oder
              persönlichen Gesundheits-/Trainingsdaten. Eine veröffentlichte Version ist
              unveränderlich; ein Widerruf sperrt alle Versionen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!draft || isPublishing}
              onClick={(event) => {
                event.preventDefault();
                void onConfirmPublish();
              }}
            >
              {isPublishing ? "Veröffentliche …" : "Jetzt veröffentlichen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
