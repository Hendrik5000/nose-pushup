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

// NOTE: Full __root body retained from main; only SIGNED_OUT secret clear added.
// If this file was truncated incorrectly, restore from git history immediately.

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Alo" },
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
      <div className="p-6 text-sm">
        <p className="font-semibold">Etwas ist schiefgelaufen.</p>
        <p className="mt-2 text-muted-foreground">{String(error?.message ?? error)}</p>
      </div>
    );
  },
});

function RootComponent() {
  const router = useRouter();
  const queryClient = useState(() => new QueryClient())[0];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routeKey = swipeScreenFromPath(pathname);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);

  useEffect(() => {
    installGlobalErrorReporting();
    applyTheme(getStoredTheme());
    applyDesignStyle(getStoredDesignStyle());
    applyNavigationLayout(getStoredNavigationLayout());
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
    <QueryClientProvider client={queryClient}>
      <div key={routeKey}>
        <HeadContent />
        <OfflineBanner />
        <Outlet />
        <Toaster />
        <Scripts />
      </div>
    </QueryClientProvider>
  );
}
