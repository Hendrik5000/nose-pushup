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
import { clearSensitiveClientStorage } from "@/lib/sensitive-storage";

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
        content: "Alo vereint Training, Mira für Alltag und Wissen sowie Nexus Chat.",
      },
      { name: "theme-color", content: "#0b0b0f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Alo" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Alo — All in one" },
      {
        property: "og:description",
        content: "Alo vereint Training, Mira für Alltag und Wissen sowie Nexus Chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Alo — All in one" },
      {
        name: "twitter:description",
        content: "Alo vereint Training, Mira für Alltag und Wissen sowie Nexus Chat.",
      },
      { property: "og:image", content: "/alo-brand.jpg" },
      { name: "twitter:image", content: "/alo-brand.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/alo-icon-192.png" },
      { rel: "apple-touch-icon", href: "/alo-icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: sportCss },
      { rel: "stylesheet", href: communityReferenceCss },
      { rel: "stylesheet", href: healthReferenceCss },
      { rel: "stylesheet", href: aiReferenceCss },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-[100dvh] bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routeKey = swipeScreenFromPath(pathname);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );

  useEffect(() => {
    installGlobalErrorReporting();
    applyTheme(getStoredTheme());
    applyDesignStyle(getStoredDesignStyle());
    applyNavigationLayout(getStoredNavigationLayout());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "np-theme" && e.newValue && isThemeId(e.newValue)) applyTheme(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | undefined;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        if (event === "SIGNED_OUT") clearSensitiveClientStorage();
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      unsub = data.subscription;
    })();
    return () => unsub?.unsubscribe();
  }, [router, queryClient]);

  return (
    <RootShell>
      <QueryClientProvider client={queryClient}>
        <div key={routeKey} className="min-h-[100dvh]">
          <OfflineBanner />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
        </div>
      </QueryClientProvider>
    </RootShell>
  );
}
