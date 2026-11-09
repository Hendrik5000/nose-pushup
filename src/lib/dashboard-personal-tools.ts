export type HabitEntry = {
  id: string;
  title: string;
  completedDates: string[];
};

export type IfThenPlan = {
  trigger: string;
  action: string;
  fallback: string;
};

export type ChecklistTemplate = {
  id: string;
  title: string;
  items: string[];
};

export type Milestone = {
  id: string;
  title: string;
  date: string;
  repeatYearly: boolean;
};

export type WorldClock = {
  id: string;
  zone: string;
};

export type PersonalToolData = {
  habitTracker: HabitEntry[];
  ifThenPlan: IfThenPlan | null;
  checklistTemplates: ChecklistTemplate[];
  decisionPicker: string[];
  milestones: Milestone[];
  worldClock: WorldClock[];
};

export type PersonalToolName = keyof PersonalToolData;

const TOOL_KEYS: Record<PersonalToolName, string> = {
  habitTracker: "habits",
  ifThenPlan: "if-then",
  checklistTemplates: "checklists",
  decisionPicker: "decision-picker",
  milestones: "milestones",
  worldClock: "world-clock",
};

const DEFAULTS: PersonalToolData = {
  habitTracker: [],
  ifThenPlan: null,
  checklistTemplates: [],
  decisionPicker: [],
  milestones: [],
  worldClock: [{ id: "local-berlin", zone: "Europe/Berlin" }],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isTextArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidData<K extends PersonalToolName>(
  kind: K,
  value: unknown,
): value is PersonalToolData[K] {
  if (kind === "habitTracker")
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          isObject(item) &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          isTextArray(item.completedDates),
      )
    );
  if (kind === "ifThenPlan")
    return (
      value === null ||
      (isObject(value) &&
        typeof value.trigger === "string" &&
        typeof value.action === "string" &&
        typeof value.fallback === "string")
    );
  if (kind === "checklistTemplates")
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          isObject(item) &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          isTextArray(item.items),
      )
    );
  if (kind === "decisionPicker") return isTextArray(value);
  if (kind === "milestones")
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          isObject(item) &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.date === "string" &&
          typeof item.repeatYearly === "boolean",
      )
    );
  return (
    Array.isArray(value) &&
    value.every(
      (item) => isObject(item) && typeof item.id === "string" && typeof item.zone === "string",
    )
  );
}

export function personalToolStorageKey(owner: string, kind: PersonalToolName) {
  return `np-alo-personal-tools-v1:${encodeURIComponent(owner)}:${TOOL_KEYS[kind]}`;
}

function freshDefault<K extends PersonalToolName>(kind: K): PersonalToolData[K] {
  const value = DEFAULTS[kind];
  return (Array.isArray(value) ? [...value] : value) as PersonalToolData[K];
}

export function loadPersonalTool<K extends PersonalToolName>(
  owner: string,
  kind: K,
): PersonalToolData[K] {
  if (!owner || typeof window === "undefined") return freshDefault(kind);
  try {
    const raw = window.localStorage.getItem(personalToolStorageKey(owner, kind));
    if (!raw) return freshDefault(kind);
    const parsed: unknown = JSON.parse(raw);
    return isValidData(kind, parsed) ? (parsed as PersonalToolData[K]) : freshDefault(kind);
  } catch {
    return freshDefault(kind);
  }
}

export function savePersonalTool<K extends PersonalToolName>(
  owner: string,
  kind: K,
  value: PersonalToolData[K],
): boolean {
  if (!owner || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(personalToolStorageKey(owner, kind), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let idSequence = 0;
export function createPersonalToolId(prefix: string) {
  idSequence += 1;
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}`;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function recentLocalDateKeys(date = new Date(), count = 7) {
  return Array.from({ length: count }, (_, offset) => {
    const day = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - (count - 1 - offset),
    );
    return localDateKey(day);
  });
}

export function parseChecklistItems(value: string) {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, 80))
    .filter((line) => {
      if (!line || seen.has(line.toLocaleLowerCase())) return false;
      seen.add(line.toLocaleLowerCase());
      return true;
    })
    .slice(0, 12);
}

export function chooseDecision(options: string[], random = Math.random): string | null {
  const cleaned = options.map((option) => option.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  const sample = Math.min(0.999999999, Math.max(0, random()));
  return cleaned[Math.floor(sample * cleaned.length)] ?? cleaned[0] ?? null;
}

export function milestoneDistance(
  milestone: Pick<Milestone, "date" | "repeatYearly">,
  now = new Date(),
): { direction: "until" | "since" | "today"; days: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(milestone.date);
  if (!match) return null;
  const originalYear = Number(match[1]);
  const month = Number(match[2]) - 1;
  const originalDay = Number(match[3]);
  const validDate = new Date(Date.UTC(originalYear, month, originalDay));
  if (
    validDate.getUTCFullYear() !== originalYear ||
    validDate.getUTCMonth() !== month ||
    validDate.getUTCDate() !== originalDay
  )
    return null;

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let targetYear = originalYear;
  if (milestone.repeatYearly) {
    targetYear = now.getFullYear();
    const lastDay = new Date(targetYear, month + 1, 0).getDate();
    const day = Math.min(originalDay, lastDay);
    let target = Date.UTC(targetYear, month, day);
    if (target < today) {
      targetYear += 1;
      const nextLastDay = new Date(targetYear, month + 1, 0).getDate();
      target = Date.UTC(targetYear, month, Math.min(originalDay, nextLastDay));
    }
    const difference = Math.round((target - today) / 86_400_000);
    return difference === 0
      ? { direction: "today", days: 0 }
      : { direction: "until", days: difference };
  }

  const target = Date.UTC(originalYear, month, originalDay);
  const difference = Math.round((target - today) / 86_400_000);
  if (difference === 0) return { direction: "today", days: 0 };
  return difference > 0
    ? { direction: "until", days: difference }
    : { direction: "since", days: Math.abs(difference) };
}

export function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone: zone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function formatWorldClock(zone: string, date = new Date()) {
  try {
    const time = new Intl.DateTimeFormat("de-DE", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
    const day = new Intl.DateTimeFormat("de-DE", {
      timeZone: zone,
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(date);
    return { time, day };
  } catch {
    return null;
  }
}
