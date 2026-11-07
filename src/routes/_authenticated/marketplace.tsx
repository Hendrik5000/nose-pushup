import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import { MarketplaceAppCatalog } from "@/components/marketplace/MarketplaceAppCatalog";
import { MarketplaceCustomApps } from "@/components/marketplace/MarketplaceCustomApps";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import {
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

  const onOpenPlugin = (pluginId: string) => {
    runMarketplaceAdminAction(isMarketplaceAdmin, () => {
      const action = getEnabledMarketplaceAction(state, pluginId);
      if (!action) return;
      if (action.type === "navigate") {
        void navigate({ to: action.to });
      } else if (action.type === "open-game") {
        void navigate({ to: "/games", search: { game: action.gameId } });
      } else {
        window.dispatchEvent(new CustomEvent("alo-open", { detail: action.toolId }));
      }
    });
  };

  if (!isMarketplaceAdmin) return null;

  return (
    <HomeAppMenuLayout
      eyebrow="ALO · KURATIERT"
      title="Marketplace"
      description="Installiere vorhandene Alo-Apps, Bereiche und Werkzeuge oder entwirf mit Mira eine deklarative Admin-App. Nur ausdrücklich bestätigte Manifeste werden mit den bestehenden Alo-Admins geteilt; ausführbare Plugins gibt es nicht."
    >
      <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
        Persönliche Installationen, Aktivierungen und Versions-Pins werden nur in diesem Browser auf
        diesem Gerät und getrennt nach deinem Alo-Konto gespeichert. Sie werden nicht
        synchronisiert. Ein selbst erstelltes Manifest wird erst nach deiner ausdrücklichen
        Bestätigung im gemeinsamen Admin-Marketplace veröffentlicht.
      </aside>

      {isMarketplaceAdmin && <MarketplaceCustomApps userId={userId} isAdmin={isMarketplaceAdmin} />}

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

      <MarketplaceAppCatalog
        plugins={MARKETPLACE_CATALOG}
        installState={state}
        ready={ready}
        onInstall={onInstall}
        onToggle={onToggle}
        onRemove={onRemove}
        onOpen={onOpenPlugin}
      />

      {!ready && !storageError && (
        <p className="text-center text-xs text-muted-foreground" role="status">
          Lokaler Installationsstatus wird geladen …
        </p>
      )}
    </HomeAppMenuLayout>
  );
}
