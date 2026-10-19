export const ALO_MODULES = [
  { id: "nose", label: "Nose-Pushup", to: "/" },
  { id: "mira", label: "Mira", to: "/ai" },
  { id: "nexus", label: "Nexus Chat", to: "/chat" },
] as const;

export type AloModuleId = (typeof ALO_MODULES)[number]["id"];
export type AloModuleRoute = (typeof ALO_MODULES)[number]["to"];

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

export function isModuleSwipeBlocked(target: EventTarget | null, pathname: string): boolean {
  if (pathname.startsWith("/workout") || pathname.startsWith("/cali-workout")) return true;
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_TARGETS));
}

/** Left swipe advances Nose → Mira → Nexus; right swipe reverses. */
export function getSwipeDestination(
  pathname: string,
  deltaX: number,
  deltaY: number,
  blocked = false,
): AloModuleRoute | null {
  if (pathname.startsWith("/workout") || pathname.startsWith("/cali-workout")) return null;
  if (blocked || Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return null;
  const current = moduleFromPath(pathname);
  if (!current) return null;
  const index = ALO_MODULES.findIndex((module) => module.id === current);
  const next = ALO_MODULES[index + (deltaX < 0 ? 1 : -1)];
  return next?.to ?? null;
}
