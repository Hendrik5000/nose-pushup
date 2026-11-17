/**
 * Mira Computer-Use: Mira bekommt einen sichtbaren virtuellen Mauszeiger und kann
 * damit die Alo-Website bedienen (Apps öffnen, klicken, tippen, scrollen, suchen).
 * Ablauf: Anweisung → deterministischer Plan → Ausführung mit echten DOM-Ereignissen;
 * der Cursor wird über das globale "mira-pointer"-Event gesteuert und überall sichtbar.
 * Ehrliche Grenze: Fremde Websites im Alo-Browser laufen in einem sandboxed iframe ohne
 * allow-same-origin — dort bedient Mira die Browser-Oberfläche (Adressleiste, Tabs,
 * Modi) und bewegt den Zeiger sichtbar, kann aber nicht in die Seite selbst klicken.
 */

export type MiraPointerStep =
  | { kind: "open"; label: string; route: string }
  | { kind: "click"; label: string; target: string }
  | { kind: "type"; label: string; target: string; text: string }
  | { kind: "scroll"; label: string; direction: "up" | "down" }
  | { kind: "search"; label: string; query: string };

export const MIRA_POINTER_EVENT = "mira-pointer";

export interface MiraPointerState {
  x: number;
  y: number;
  label: string;
  active: boolean;
}

export function emitMiraPointer(state: MiraPointerState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MIRA_POINTER_EVENT, { detail: state }));
}

export function describePointerStep(step: MiraPointerStep): string {
  switch (step.kind) {
    case "open":
      return `Öffne ${step.label}`;
    case "click":
      return `Klicke auf „${step.label}“`;
    case "type":
      return `Tippe „${step.text}“ in ${step.label}`;
    case "scroll":
      return step.label;
    case "search":
      return `Suche nach „${step.query}“`;
  }
}

type MinimalRouter = { navigate: (opts: { to: string }) => unknown };
const registered: { router: MinimalRouter | null } = { router: null };

export function setActiveMiraRouter(router: MinimalRouter | null) {
  registered.router = router;
}

export function navigateMiraRoute(route: string) {
  if (registered.router) {
    try {
      registered.router.navigate({ to: route });
      return;
    } catch {
      /* Fallback unten */
    }
  }
  if (typeof window !== "undefined") window.location.assign(route);
}

export const MIRA_POINTER_ROUTES: Array<{ keys: string[]; route: string; label: string }> = [
  { keys: ["einstellungen", "settings", "profil"], route: "/profile", label: "Einstellungen" },
  { keys: ["sport"], route: "/sports", label: "Alo Sports" },
  { keys: ["fußball", "fussball", "football"], route: "/football", label: "Alo Fußball" },
  { keys: ["health", "gesundheit"], route: "/health", label: "Alo Health" },
  {
    keys: ["spiele", "games", "grid defense", "kupferkern", "starfighter"],
    route: "/games",
    label: "Alo Spiele",
  },
  { keys: ["marketplace", "app store", "store"], route: "/marketplace", label: "Marketplace" },
  { keys: ["browser", "internet"], route: "/browser", label: "Browser" },
  { keys: ["mira", "ki-app"], route: "/ai", label: "Mira" },
  { keys: ["nexus", "chat"], route: "/chat", label: "Nexus" },
  { keys: ["training"], route: "/training", label: "Training" },
  { keys: ["werkzeuge", "tools"], route: "/tools", label: "Alo-Werkzeuge" },
  { keys: ["start", "home", "startbildschirm"], route: "/", label: "Start" },
];

const SPLIT_PATTERN =
  /(?:,\s*)?\bund\s+(?=(?:klicke|tippe|schreibe|gib|scrolle|öffne|oeffne|geh|gehe|suche|bewege)\b)|\s*\bdann\s+(?=(?:klicke|tippe|schreibe|gib|scrolle|öffne|oeffne|geh|gehe|suche|bewege)\b)|;\s*/i;

export function planMiraPointerSteps(instruction: string): MiraPointerStep[] {
  const clean = instruction.trim();
  if (!clean) return [];
  const fragments = clean
    .split(SPLIT_PATTERN)
    .map((part) => part.trim())
    .filter(Boolean);

  const steps: MiraPointerStep[] = [];
  for (const fragment of fragments) {
    const step = planSinglePointerStep(fragment);
    if (step) steps.push(step);
  }
  return steps;
}

function planSinglePointerStep(fragment: string): MiraPointerStep | null {
  const text = fragment.trim().replace(/^[,.!?]+|[,.!?]+$/g, "");
  if (!text) return null;

  const openMatch = text.match(
    /^(?:öffne|oeffne|starte|wechsle\s+zu|geh\s+(?:zu|zur|zum|auf)|gehe\s+(?:zu|zur|zum|auf)|mach\s+auf)\s+(?:die\s+|den\s+|das\s+|der\s+)?(.+)$/i,
  );
  if (openMatch) {
    const rest = openMatch[1].trim();
    const route = findPointerRoute(rest);
    return route
      ? { kind: "open", label: route.label, route: route.route }
      : { kind: "click", label: rest, target: rest };
  }

  const clickMatch = text.match(
    /^(?:klicke?|drücke|tippe\s+auf)\s+(?:auf\s+|auf\s+das\s+|auf\s+die\s+|auf\s+den\s+)?(.+)$/i,
  );
  if (clickMatch) {
    const rest = clickMatch[1].trim();
    const route = findPointerRoute(rest);
    return route
      ? { kind: "open", label: route.label, route: route.route }
      : { kind: "click", label: rest, target: rest };
  }

  const typeMatch = text.match(
    /^(?:tippe|schreibe|gib)\s+(.+?)\s+in\s+(?:das\s+|die\s+|dem\s+|den\s+)?(.+?)\s*(?:ein)?[.!?]*$/i,
  );
  if (typeMatch?.[1] && typeMatch[2]) {
    return {
      kind: "type",
      label: typeMatch[2].trim(),
      target: typeMatch[2].trim(),
      text: typeMatch[1].trim().replace(/^["'„“]|["'„“]$/g, ""),
    };
  }

  const scrollMatch = text.match(/^scrolle?\s+(?:nach\s+)?(unten|oben)/i);
  if (scrollMatch) {
    return {
      kind: "scroll",
      label: scrollMatch[1].toLowerCase() === "unten" ? "Nach unten" : "Nach oben",
      direction: scrollMatch[1].toLowerCase() === "unten" ? "down" : "up",
    };
  }

  const searchMatch = text.match(
    /^(?:suche|such|finde)\s+(?:nach\s+|im\s+web\s+nach\s+|bitte\s+)?(.+)$/i,
  );
  if (searchMatch?.[1]) {
    return { kind: "search", label: "Suche", query: searchMatch[1].trim() };
  }

  return null;
}

function findPointerRoute(text: string) {
  const lower = text.toLowerCase();
  return MIRA_POINTER_ROUTES.find((entry) => entry.keys.some((key) => lower.includes(key)));
}

export function findPointerTarget(target: string): HTMLElement | null {
  if (typeof document === "undefined" || !target.trim()) return null;
  const trimmed = target.trim();
  if (/^[#.[]/.test(trimmed)) {
    const bySelector = document.querySelector<HTMLElement>(trimmed);
    if (bySelector) return bySelector;
  }
  const needle = trimmed.toLowerCase();
  const candidates = document.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], input, textarea, select, [role="switch"], [role="tab"], [role="menuitem"], summary, h1, h2, h3',
  );
  let partial: HTMLElement | null = null;
  for (const el of candidates) {
    const label =
      el.getAttribute("aria-label") ||
      (el instanceof HTMLInputElement ? el.placeholder : "") ||
      el.textContent ||
      "";
    const normalized = label.trim().toLowerCase();
    if (!normalized) continue;
    if (normalized === needle) return isVisible(el) ? el : null;
    if (!partial && normalized.includes(needle) && isVisible(el)) partial = el;
  }
  return partial;
}

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

export function centerOfElement(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function fireMouse(el: HTMLElement, type: string, x: number, y: number) {
  el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
    }),
  );
}

export function clickElementLikePointer(el: HTMLElement) {
  const { x, y } = centerOfElement(el);
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  fireMouse(el, "pointerover", x, y);
  fireMouse(el, "pointermove", x, y);
  fireMouse(el, "pointerdown", x, y);
  fireMouse(el, "pointerup", x, y);
  fireMouse(el, "click", x, y);
  if (el instanceof HTMLElement && el.tabIndex >= 0) el.focus();
}

export function typeIntoElement(el: HTMLElement, text: string) {
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto =
      el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runMiraPointerPlan(
  steps: MiraPointerStep[],
  options: { stepDelayMs?: number } = {},
): Promise<string[]> {
  const stepDelayMs = options.stepDelayMs ?? 650;
  const transcript: string[] = [];
  for (const step of steps) {
    const line = await performMiraPointerStep(step);
    transcript.push(line);
    await wait(stepDelayMs);
  }
  emitMiraPointer({ x: 0, y: 0, label: "", active: false });
  return transcript;
}

export async function performMiraPointerStep(step: MiraPointerStep): Promise<string> {
  switch (step.kind) {
    case "open": {
      emitMiraPointer({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        label: `Öffne ${step.label}`,
        active: true,
      });
      navigateMiraRoute(step.route);
      return `${step.label} geöffnet`;
    }
    case "click": {
      const el = findPointerTarget(step.target);
      if (!el) {
        emitMiraPointer({ x: 0, y: 0, label: "", active: false });
        return `„${step.label}" nicht gefunden`;
      }
      const { x, y } = centerOfElement(el);
      emitMiraPointer({ x, y, label: `Klicke: ${step.label}`, active: true });
      await wait(450);
      clickElementLikePointer(el);
      return `Auf „${step.label}" geklickt`;
    }
    case "type": {
      const el = step.target
        ? findPointerTarget(step.target)
        : (document.activeElement as HTMLElement | null);
      const field =
        el ??
        document.querySelector<HTMLElement>("input:not([type='checkbox']):not([type='radio'])");
      if (!field) {
        emitMiraPointer({ x: 0, y: 0, label: "", active: false });
        return `Kein Eingabefeld für „${step.text}" gefunden`;
      }
      const { x, y } = centerOfElement(field);
      emitMiraPointer({ x, y, label: `Tippe: ${step.text}`, active: true });
      await wait(450);
      typeIntoElement(field, step.text);
      return `„${step.text}" eingegeben`;
    }
    case "scroll": {
      emitMiraPointer({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        label: step.label,
        active: true,
      });
      window.scrollBy({
        top: step.direction === "down" ? window.innerHeight * 0.8 : -window.innerHeight * 0.8,
        behavior: "smooth",
      });
      return step.direction === "down" ? "Nach unten gescrollt" : "Nach oben gescrollt";
    }
    case "search": {
      window.dispatchEvent(new CustomEvent("alo-open", { detail: "search" }));
      await wait(700);
      const dialogInput = document.querySelector<HTMLElement>(
        '[role="dialog"] input, [role="dialog"] input[type="search"]',
      );
      const fallbackInput = Array.from(
        document.querySelectorAll<HTMLInputElement>("input[type='search'], input"),
      ).find((input) => /such/i.test(input.placeholder || ""));
      const field = dialogInput ?? fallbackInput;
      if (!field) return `Suche nach „${step.query}" geöffnet`;
      const { x, y } = centerOfElement(field);
      emitMiraPointer({ x, y, label: `Suche: ${step.query}`, active: true });
      typeIntoElement(field, step.query);
      field.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      return `Suche nach „${step.query}" ausgeführt`;
    }
  }
}
