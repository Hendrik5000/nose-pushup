export const ALO_MODULES = [
  { id: "nose", label: "Nose-Pushup", to: "/" },
  { id: "mira", label: "Mira", to: "/ai" },
  { id: "nexus", label: "Nexus Chat", to: "/chat" },
] as const;

export type AloModuleId = (typeof ALO_MODULES)[number]["id"];
export type AloModuleRoute = (typeof ALO_MODULES)[number]["to"];

// Settings participates in screen navigation, not in the three product modules.
export const ALO_SWIPE_SCREENS = [
  ...ALO_MODULES,
  { id: "settings", label: "Einstellungen", to: "/profile" },
] as const;
export type AloSwipeRoute = (typeof ALO_SWIPE_SCREENS)[number]["to"];

const INTERACTIVE_TARGETS = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  "[role='slider']",
  "[role='dialog']",
  "[aria-modal='true']",
  "[contenteditable='true']",
  "[data-no-module-swipe]",
  "canvas",
  "video",
  "audio",
  "iframe",
  "[data-carousel]",
  ".workout-session",
].join(",");

export function moduleFromPath(pathname: string): AloModuleId | null {
  if (pathname === "/" || pathname === "") return "nose";
  if (pathname === "/ai" || pathname === "/coach") return "mira";
  if (pathname === "/chat") return "nexus";
  return null;
}

export function swipeScreenFromPath(pathname: string): AloSwipeRoute | null {
  if (pathname === "/profile") return "/profile";
  const module = moduleFromPath(pathname);
  return ALO_MODULES.find(({ id }) => id === module)?.to ?? null;
}

export function isModuleSwipeBlocked(target: EventTarget | null, pathname: string): boolean {
  if (pathname.startsWith("/workout") || pathname.startsWith("/cali-workout")) return true;
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_TARGETS));
}

/** Left swipe advances Nose → Mira → Nexus → Settings; right swipe reverses. */
export function getSwipeDestination(
  pathname: string,
  deltaX: number,
  deltaY: number,
  blocked = false,
): AloSwipeRoute | null {
  if (pathname.startsWith("/workout") || pathname.startsWith("/cali-workout")) return null;
  if (blocked || Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return null;
  const current = swipeScreenFromPath(pathname);
  if (!current) return null;
  const index = ALO_SWIPE_SCREENS.findIndex((screen) => screen.to === current);
  const next = ALO_SWIPE_SCREENS[index + (deltaX < 0 ? 1 : -1)];
  return next?.to ?? null;
}
