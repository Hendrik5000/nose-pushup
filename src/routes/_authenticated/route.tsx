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
import { WelcomeTour } from "@/components/WelcomeTour";
import { TopNav } from "@/components/TopNav";
import { SportAppHeader } from "@/components/SportAppHeader";
import { applyNavigationVisibility, getNavigationVisible } from "@/lib/navigation-layout";
import { getSwipeDestination, isModuleSwipeBlocked } from "@/lib/module-navigation";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useNotifications();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    applyNavigationVisibility(getNavigationVisible());
  }, []);

  useEffect(() => {
    let start: { x: number; y: number; target: EventTarget | null } | null = null;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || event.isPrimary === false) return;
      if (document.querySelector('[aria-modal="true"], [role="dialog"], #sport-area-menu')) {
        start = null;
        return;
      }
      if (event.clientX < 24 || event.clientX > window.innerWidth - 24) {
        start = null; // Keep native browser back/forward edge gestures intact.
        return;
      }
      if (isModuleSwipeBlocked(event.target, pathname)) {
        start = null;
        return;
      }
      const element =
        event.target instanceof Element ? event.target.closest<HTMLElement>("*") : null;
      if (element) {
        for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (
            (style.overflowX === "auto" || style.overflowX === "scroll") &&
            parent.scrollWidth > parent.clientWidth + 4
          ) {
            start = null;
            return;
          }
        }
      }
      start = { x: event.clientX, y: event.clientY, target: event.target };
    };
    const up = (event: PointerEvent) => {
      if (!start || event.pointerType !== "touch") return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const blocked =
        isModuleSwipeBlocked(start.target, pathname) ||
        isModuleSwipeBlocked(event.target, pathname);
      const destination = getSwipeDestination(pathname, dx, dy, blocked);
      start = null;
      if (destination) void navigate({ to: destination });
    };
    const cancel = () => {
      start = null;
    };
    // Touch-end remains available when native pan handling cancels Pointer Events.
    // No preventDefault or touch-action override: nested scrollers keep native gestures.
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return cancel();
      const touch = event.touches[0];
      down({
        pointerType: "touch",
        isPrimary: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: event.target,
      } as PointerEvent);
    };
    const touchEnd = (event: TouchEvent) => {
      if (event.touches.length || event.changedTouches.length !== 1) return cancel();
      const touch = event.changedTouches[0];
      up({
        pointerType: "touch",
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: event.target,
      } as PointerEvent);
    };
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, [navigate, pathname]);

  return (
    <div className="authenticated-shell min-h-[100dvh]">
      <TopNav />
      <SportAppHeader />
      <Outlet />
      <WelcomeTour userId={user.id} />
    </div>
  );
}
