import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
  useRouter,
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
      },
      { title: "Alo" },
      { name: "theme-color", content: "#0b1017" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: sportCss },
      { rel: "stylesheet", href: communityReferenceCss },
      { rel: "stylesheet", href: healthReferenceCss },
      { rel: "stylesheet", href: aiReferenceCss },
    ],
  }),
  component: RootComponent,
  errorComponent: ({ error }) => {
    reportLovableError(error);
    return (
      <html lang="de">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Fehler — Alo</title>
        </head>
        <body className="bg-background text-foreground">
          <div className="mx-auto max-w-md p-6">
            <p className="font-semibold">Etwas ist schiefgelaufen.</p>
            <p className="mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
          </div>
          <Scripts />
        </body>
      </html>
    );
  },
});

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <AppShell />
        <Toaster />
      </QueryClientProvider>
    </RootDocument>
  );
}

function AppShell() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routeKey = swipeScreenFromPath(pathname);

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
  }, [router]);

  return (
    <div key={routeKey} className="min-h-[100dvh]">
      <OfflineBanner />
      <Outlet />
    </div>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
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
