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
import { WelcomeTour } from "@/components/WelcomeTour";
import { TopNav } from "@/components/TopNav";
import { SportAppHeader } from "@/components/SportAppHeader";
import { applyNavigationVisibility, getNavigationVisible } from "@/lib/navigation-layout";
import { getSwipeDestination, isModuleSwipeBlocked } from "@/lib/module-navigation";
import { startModuleSwipeTransition } from "@/lib/module-swipe-transition";
import "@/module-swipe.css";
import "@/module-menu.css";

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
  const surface = useRef<HTMLDivElement>(null);
  const swipeTransition = useRef<ReturnType<typeof startModuleSwipeTransition> | null>(null);

  useEffect(() => () => swipeTransition.current?.cancel(), []);

  useEffect(() => {
    applyNavigationVisibility(getNavigationVisible());
  }, []);

  useEffect(() => {
    const gestureSurface = surface.current;
    let start: { x: number; y: number; target: EventTarget | null } | null = null;
    let dragX = 0;
    let frame = 0;
    let reducedMotion = false;
    let snapBack: Animation | undefined;
    let scrollBlocked: boolean | undefined;
    const stopFrame = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const resetDrag = () => {
      stopFrame();
      const element = surface.current;
      const transform = element?.style.transform;
      dragX = 0;
      if (!element || swipeTransition.current) return;
      element.style.transform = "";
      element.style.willChange = "";
      if (transform && !reducedMotion && typeof element.animate === "function") {
        snapBack?.cancel();
        const animation = element.animate([{ transform }, { transform: "translate3d(0, 0, 0)" }], {
          duration: 140,
          easing: "ease-out",
        });
        snapBack = animation;
        void animation.finished.catch(() => undefined).finally(() => animation.cancel());
      }
    };
    const cancel = () => {
      start = null;
      resetDrag();
    };
    const hasNestedScroller = (target: EventTarget | null) => {
      if (scrollBlocked !== undefined) return scrollBlocked;
      const element = target instanceof Element ? target.closest<HTMLElement>("*") : null;
      for (let parent = element; parent; parent = parent.parentElement) {
        if (parent.scrollWidth > parent.clientWidth + 4) {
          const style = getComputedStyle(parent);
          if (style.overflowX === "auto" || style.overflowX === "scroll")
            return (scrollBlocked = true);
        }
      }
      return (scrollBlocked = false);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || event.isPrimary === false) return;
      if (swipeTransition.current) {
        start = null;
        return;
      }
      snapBack?.cancel();
      resetDrag();
      scrollBlocked = undefined;
      if (document.querySelector('[aria-modal="true"], [role="dialog"], #sport-area-menu')) return;
      if (event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
      if (isModuleSwipeBlocked(event.target, pathname)) return;
      reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      start = { x: event.clientX, y: event.clientY, target: event.target };
    };
    const touchMove = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1) return cancel();
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) / 1.35) return cancel();
      if (Math.abs(dx) < 8 || reducedMotion) return;
      if (hasNestedScroller(start.target)) return cancel();
      if (!getSwipeDestination(pathname, Math.sign(dx) * 72, 0)) return resetDrag();
      snapBack?.cancel();
      dragX = Math.max(-window.innerWidth * 0.6, Math.min(window.innerWidth * 0.6, dx));
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          const element = surface.current;
          if (!element || !start) return;
          element.style.willChange = "transform";
          element.style.transform = `translate3d(${dragX}px, 0, 0)`;
        });
      }
    };
    const up = (event: PointerEvent) => {
      if (!start || event.pointerType !== "touch") return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const blocked =
        isModuleSwipeBlocked(start.target, pathname) ||
        isModuleSwipeBlocked(event.target, pathname) ||
        hasNestedScroller(start.target);
      const destination = getSwipeDestination(pathname, dx, dy, blocked);
      start = null;
      stopFrame();
      if (destination && !swipeTransition.current) {
        const transition = startModuleSwipeTransition(
          surface.current,
          dx < 0 ? "left" : "right",
          () => navigate({ to: destination, viewTransition: false }),
          dragX,
        );
        swipeTransition.current = transition;
        dragX = 0;
        void transition.finished
          .catch((error: unknown) => console.error("Alo module swipe navigation failed", error))
          .finally(() => {
            if (swipeTransition.current === transition) swipeTransition.current = null;
          });
      } else resetDrag();
    };
    // Passive listeners preserve vertical scrolling, nested carousels and browser edges.
    const touchStart = (event: TouchEvent) => {
      start = null;
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
    window.addEventListener("touchmove", touchMove, { passive: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", cancel);
      stopFrame();
      snapBack?.cancel();
      if (!swipeTransition.current && gestureSurface) {
        gestureSurface.style.transform = "";
        gestureSurface.style.willChange = "";
      }
    };
  }, [navigate, pathname]);

  return (
    <div className="authenticated-shell min-h-[100dvh]">
      <TopNav />
      <SportAppHeader />
      <div ref={surface} className="alo-module-surface">
        <Outlet />
      </div>
      <WelcomeTour userId={user.id} />
    </div>
  );
}
