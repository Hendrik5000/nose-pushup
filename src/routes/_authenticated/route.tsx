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
import { AppNavigation } from "@/components/TopNav";
import { applyNavigationVisibility, getNavigationVisible } from "@/lib/navigation-layout";
import { installModuleSwipeGesture } from "@/lib/module-swipe-gesture";
import "@/module-swipe.css";
import "@/alo-mobile.css";
import "@/alo-header-layout.css";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    setAloOwner(data.user.id);
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useNotifications();
  const { user } = Route.useRouteContext();
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
    <div className="authenticated-shell alo-no-global-header min-h-[100dvh]">
      <AppNavigation />
      <div ref={surface} className="alo-module-surface">
        <Outlet />
      </div>
      <AloWorkspace userId={user.id} />
      <WelcomeTour userId={user.id} />
    </div>
  );
}
