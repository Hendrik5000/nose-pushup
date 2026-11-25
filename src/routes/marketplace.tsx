import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AloHomeLink } from "@/components/AloHomeLink";
import { HomeAppMenuLayout } from "@/components/HomeAppMenuLayout";
import { StandaloneAppShell } from "@/components/StandaloneAppShell";
import {
  MarketplaceAppCatalog,
  MarketplaceCollectionSidebar,
} from "@/components/marketplace/MarketplaceAppCatalog";
import { MarketplaceCustomApps } from "@/components/marketplace/MarketplaceCustomApps";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
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
  saveMarketplaceInstallState,
  type MarketplaceInstallState,
} from "@/lib/marketplace";
import type { MarketplaceCollectionId } from "@/lib/marketplace-collections";

export const Route = createFileRoute("/marketplace")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Marketplace — Alo" },
      {
        name: "description",
        content:
          "Kuratierte, lokal installierbare Alo-Erweiterungen – Katalog auch ohne Anmeldung.",
      },
    ],
  }),
  component: MarketplacePage,
});

type AccountMarketplaceState = {
  userId: string;
  state: MarketplaceInstallState;
};

function MarketplacePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUserId(data.session?.user?.id ?? null);
        setSessionChecked(true);
      })
      .catch(() => {
        if (active) setSessionChecked(true);
      });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setSessionChecked(true);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (!userId) {
    return (
      <StandaloneAppShell>
        <MarketplaceGuestView sessionChecked={sessionChecked} />
      </StandaloneAppShell>
    );
  }
  return (
    <StandaloneAppShell>
      <MarketplaceContent key={userId} userId={userId} />
    </StandaloneAppShell>
  );
}

function MarketplaceGuestView({ sessionChecked }: { sessionChecked: boolean }) {
  const [activeCollection, setActiveCollection] = useState<MarketplaceCollectionId>("official");

  return (
    <HomeAppMenuLayout
      sidebar={
        <MarketplaceCollectionSidebar
          activeCollection={activeCollection}
          onSelect={setActiveCollection}
        />
      }
      sidebarClassName="hidden lg:block"
    >
      {sessionChecked ? (
        <MarketplaceAppCatalog
          plugins={MARKETPLACE_CATALOG}
          installState={EMPTY_MARKETPLACE_INSTALL_STATE}
          ready={false}
          onInstall={() => {}}
          onToggle={() => {}}
          onRemove={() => {}}
          onOpen={() => {}}
          activeCollection={activeCollection}
          onCollectionChange={setActiveCollection}
        />
      ) : (
        <p className="text-center text-xs text-muted-foreground" role="status">
          Marketplace wird geladen …
        </p>
      )}
      <footer className="space-y-4 border-t border-border/60 pt-6">
        <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
          Du siehst den öffentlichen Marketplace-Katalog. Zum Installieren und Öffnen der Apps melde
          dich mit deinem Alo-Konto an.{" "}
          <Link
            to="/auth"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Zur Anmeldung
          </Link>
        </aside>
        <MarketplaceFooterInfo description="Alle kuratierten Alo-Apps, Bereiche und Werkzeuge – auch ohne Anmeldung ansehen." />
      </footer>
    </HomeAppMenuLayout>
  );
}

function MarketplaceFooterInfo({ description }: { description: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--menu-accent)]">
        ALO · KURATIERT
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Marketplace</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-4">
        <AloHomeLink />
      </div>
    </div>
  );
}

function MarketplaceContent({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [activeCollection, setActiveCollection] = useState<MarketplaceCollectionId>("official");
  const [adminAccess, setAdminAccess] = useState<{ userId: string; isAdmin: boolean } | null>(null);
  const isMarketplaceAdmin = isMarketplaceAdminForUser(adminAccess, userId);
  const [accountState, setAccountState] = useState<AccountMarketplaceState | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const state =
    accountState?.userId === userId ? accountState.state : EMPTY_MARKETPLACE_INSTALL_STATE;
  const ready = accountState?.userId === userId && !storageError;

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
  }, [userId]);

  const persist = (next: MarketplaceInstallState, message: string) => {
    try {
      saveMarketplaceInstallState(window.localStorage, userId, next);
      setAccountState({ userId, state: next });
      setStorageError(null);
      setStatus(message);
    } catch {
      setStorageError("Änderung nicht gespeichert. Bitte prüfe den lokalen Browserspeicher.");
      setStatus("");
    }
  };

  const onInstall = (pluginId: string, name: string) => {
    try {
      persist(installMarketplacePlugin(state, pluginId), `${name} wurde lokal installiert.`);
    } catch {
      setStatus("Dieses Alo-Plugin kann nicht installiert werden.");
    }
  };

  const onToggle = (pluginId: string, name: string, enabled: boolean) => {
    try {
      const next = enabled
        ? disableMarketplacePlugin(state, pluginId)
        : enableMarketplacePlugin(state, pluginId);
      persist(next, `${name} wurde ${enabled ? "deaktiviert" : "aktiviert"}.`);
    } catch {
      setStatus("Diese Plugin-Änderung ist nicht verfügbar.");
    }
  };

  const onRemove = (pluginId: string, name: string) => {
    try {
      persist(removeMarketplacePlugin(state, pluginId), `${name} wurde von diesem Gerät entfernt.`);
    } catch {
      setStatus("Dieses Alo-Plugin kann nicht entfernt werden.");
    }
  };

  const onOpenPlugin = (pluginId: string) => {
    const action = getEnabledMarketplaceAction(state, pluginId);
    if (!action) return;
    if (action.type === "navigate") {
      void navigate({ to: action.to as never });
    } else if (action.type === "open-game") {
      void navigate({ to: "/games", search: { game: action.gameId } });
    } else {
      window.dispatchEvent(new CustomEvent("alo-open", { detail: action.toolId }));
    }
  };

  return (
    <HomeAppMenuLayout
      sidebar={
        <MarketplaceCollectionSidebar
          activeCollection={activeCollection}
          onSelect={setActiveCollection}
        />
      }
      sidebarClassName="hidden lg:block"
    >
      <MarketplaceAppCatalog
        plugins={MARKETPLACE_CATALOG}
        installState={state}
        ready={ready}
        onInstall={onInstall}
        onToggle={onToggle}
        onRemove={onRemove}
        onOpen={onOpenPlugin}
        activeCollection={activeCollection}
        onCollectionChange={setActiveCollection}
        userId={userId}
      />

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

      {isMarketplaceAdmin && <MarketplaceCustomApps userId={userId} isAdmin={isMarketplaceAdmin} />}

      {!ready && !storageError && (
        <p className="text-center text-xs text-muted-foreground" role="status">
          Lokaler Installationsstatus wird geladen …
        </p>
      )}

      <footer className="space-y-4 border-t border-border/60 pt-6">
        <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
          Persönliche Installationen, Aktivierungen und Versions-Pins werden nur in diesem Browser
          auf diesem Gerät und getrennt nach deinem Alo-Konto gespeichert. Sie werden nicht
          synchronisiert. Ein selbst erstelltes Manifest wird erst nach deiner ausdrücklichen
          Bestätigung veröffentlicht.
        </aside>
        <MarketplaceFooterInfo description="Installiere vorhandene Alo-Apps, Bereiche und Werkzeuge. Mit einem Admin-Konto kannst du zusätzlich mit Mira deklarative Apps entwerfen. Nur ausdrücklich bestätigte Manifeste werden veröffentlicht; ausführbare Plugins gibt es nicht." />
      </footer>
    </HomeAppMenuLayout>
  );
}
