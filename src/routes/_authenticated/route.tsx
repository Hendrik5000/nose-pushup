import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";
import { setAloOwner } from "@/lib/alo-store";
import { authRedirectHref } from "@/lib/safe-next";
import { AloWorkspace } from "@/components/alo/AloWorkspace";
import { TutorialOverlay } from "@/components/tutorial/TutorialOverlay";
import { PostfachProvider } from "@/components/postfach/PostfachProvider";
import { CallProvider } from "@/components/calls/CallProvider";
import { AppNavigation } from "@/components/TopNav";
import { AloSystemChrome } from "@/components/alo/AloSystemChrome";
import { applyNavigationVisibility, getNavigationVisible } from "@/lib/navigation-layout";
import "@/alo-mobile.css";
import "@/alo-header-layout.css";
import "@/alo-system-chrome.css";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // This is a client-side UI gate. getUser() performs a network request on
    // every navigation; the backend still validates the JWT and enforces RLS.
    let user = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error) user = data.session?.user ?? null;
    } catch {
      // If refreshing an expired session needs the network, show sign-in
      // instead of letting a transient fetch failure break route loading.
    }
    if (!user) throw redirect({ href: authRedirectHref(location.href) });
    setAloOwner(user.id);
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  useNotifications(user.id);
  const isGuest = user.is_anonymous === true;
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    applyNavigationVisibility(getNavigationVisible());
  }, []);

  return (
    <PostfachProvider userId={user.id} isGuest={isGuest}>
      <CallProvider userId={user.id} isGuest={isGuest}>
        <div className="authenticated-shell alo-no-global-header min-h-[100dvh]">
          {pathname === "/" ? <AloSystemChrome /> : null}
          <AppNavigation />
          <a className="alo-skip-link" href="#alo-main-content">
            Zum Inhalt springen
          </a>
          <div id="alo-main-content" tabIndex={-1} className="alo-module-surface">
            <Outlet />
          </div>
          <AloWorkspace userId={user.id} />
          <TutorialOverlay userId={user.id} autoStart />
        </div>
      </CallProvider>
    </PostfachProvider>
  );
}
