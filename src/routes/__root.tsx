import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/OfflineBanner";
import appCss from "../styles.css?url";
import sportCss from "../sport.css?url";
import communityReferenceCss from "../community-reference.css?url";
import healthReferenceCss from "../health-reference.css?url";
import aiReferenceCss from "../ai-reference.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installGlobalErrorReporting } from "@/lib/error-reports";
import { applyTheme, getStoredTheme, isThemeId } from "@/lib/theme";
import { applyDesignStyle, getStoredDesignStyle } from "@/lib/design-style";
import { applyNavigationLayout, getStoredNavigationLayout } from "@/lib/navigation-layout";
import { swipeScreenFromPath } from "@/lib/module-navigation";
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Diese Seite gibt es nicht oder sie wurde verschoben.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Diese Seite konnte nicht geladen werden
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Es ist ein Fehler aufgetreten. Lade die Seite neu oder gehe zurück zur Startseite.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Erneut versuchen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Zur Startseite
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Alo — All in one" },
      {
        name: "description",
        content: "Alo vereint Nose-Pushup-Training, Mira für Alltag und Wissen sowie Nexus Chat.",
      },
      { name: "theme-color", content: "#0b0b0f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Alo" },
      { name: "author", content: "Lovable" },

      { property: "og:title", content: "Alo — All in one" },
      {
        property: "og:description",
        content: "Alo vereint Nose-Pushup-Training, Mira für Alltag und Wissen sowie Nexus Chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Alo — All in one" },
      {
        name: "twitter:description",
        content: "Alo vereint Nose-Pushup-Training, Mira für Alltag und Wissen sowie Nexus Chat.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e5c2365e-a81c-4835-81d6-f8d5014655b9/id-preview-f69d2ccc--40995ef3-9b15-4ba7-9ebb-89713e15105b.lovable.app-1783159358811.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e5c2365e-a81c-4835-81d6-f8d5014655b9/id-preview-f69d2ccc--40995ef3-9b15-4ba7-9ebb-89713e15105b.lovable.app-1783159358811.png",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: sportCss },
      { rel: "stylesheet", href: communityReferenceCss },
      { rel: "stylesheet", href: healthReferenceCss },
      { rel: "stylesheet", href: aiReferenceCss },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [installable, setInstallable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  // Keep the shared shell mounted between modules so a swipe can finish.
  const routeKey = swipeScreenFromPath(pathname) ? "alo-swipe-screens" : pathname;
  const [fullscreenRequested, setFullscreenRequested] = useState(false);

  const updateViewportHeight = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--app-viewport-height", `${Math.max(height, 0)}px`);
  };

  useEffect(() => {
    installGlobalErrorReporting();
  }, []);

  useEffect(() => {
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => console.error("SW reg fail:", err));
      });
    }

    applyDesignStyle(getStoredDesignStyle());
    applyNavigationLayout(getStoredNavigationLayout());
    applyTheme(getStoredTheme());
    // Theme des Kontos laden, damit es auch ohne Profilbesuch sofort greift.
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("profiles").select("theme").eq("id", uid).maybeSingle();
      const t = data?.theme;
      if (isThemeId(t)) applyTheme(t);
    })();
  }, []);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);

    const handleDisplayMode = () =>
      setStandalone(
        window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    window.matchMedia("(display-mode: standalone)").addEventListener("change", handleDisplayMode);

    const onBeforeInstallPrompt = () => setInstallable(true);
    const onAppInstalled = () => {
      setInstallable(false);
      setStandalone(true);
    };

    const tryAutoFullscreen = async () => {
      if (fullscreenRequested || document.fullscreenElement) return;

      const inStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const inFullscreenMode = window.matchMedia("(display-mode: fullscreen)").matches;
      if (!inStandalone && !inFullscreenMode) return;

      setFullscreenRequested(true);
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Browsers block autoplay/fullscreen without a user interaction. We fall back to the first tap.
      }
    };

    const onFirstInteraction = () => {
      void tryAutoFullscreen();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(() => {
          void tryAutoFullscreen();
        }, 200);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("pointerdown", onFirstInteraction, { passive: true });
    window.addEventListener("touchstart", onFirstInteraction, { passive: true });
    window.addEventListener("keydown", onFirstInteraction, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.setTimeout(() => {
      void tryAutoFullscreen();
    }, 400);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window
        .matchMedia("(display-mode: standalone)")
        .removeEventListener("change", handleDisplayMode);
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fullscreenRequested]);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | undefined;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      unsub = data.subscription;
    })();
    return () => unsub?.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {installable && !standalone && (
        <div className="fixed inset-x-3 top-3 z-50 rounded-2xl border border-primary/30 bg-background/95 px-3 py-3 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Installieren
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                Als App auf dem Startbildschirm nutzen
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Öffne das Browser-Menü und wähle „Als App installieren“.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInstallable(false)}
              className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <div
        key={routeKey}
        className={routeKey === "alo-swipe-screens" ? "alo-swipe-route" : "route-enter"}
      >
        <Outlet />
      </div>
      <OfflineBanner />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
