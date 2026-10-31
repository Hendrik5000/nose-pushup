import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";
import { setAloOwner } from "@/lib/alo-store";
import { AloWorkspace } from "@/components/alo/AloWorkspace";
import { WelcomeTour } from "@/components/WelcomeTour";
import { PostfachProvider } from "@/components/postfach/PostfachProvider";
import { CallProvider } from "@/components/calls/CallProvider";
import { AppNavigation } from "@/components/TopNav";
import { applyNavigationVisibility, getNavigationVisible } from "@/lib/navigation-layout";
import { installModuleSwipeGesture } from "@/lib/module-swipe-gesture";
import "@/module-swipe.css";
import "@/alo-mobile.css";
import "@/alo-header-layout.css";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
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
    if (!user) throw redirect({ to: "/auth" });
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
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyNavigationVisibility(getNavigationVisible());
  }, []);

  useEffect(() => {
    if (!surface.current) return;
    return installModuleSwipeGesture(surface.current, {
      getPathname: () => currentPath.current,
      navigate: (destination) => navigate({ to: destination, viewTransition: false }),
    });
  }, [navigate]);

  return (
    <PostfachProvider userId={user.id} isGuest={isGuest}>
      <CallProvider userId={user.id} isGuest={isGuest}>
        <div className="authenticated-shell alo-no-global-header min-h-[100dvh]">
          <AppNavigation />
          <div ref={surface} className="alo-module-surface">
            <Outlet />
          </div>
          <AloWorkspace userId={user.id} />
          <WelcomeTour userId={user.id} />
        </div>
      </CallProvider>
    </PostfachProvider>
  );
}
