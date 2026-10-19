/** Super-AI skill tools + personas + session helpers. */

export type AiPersona = "coach" | "analyst" | "motivator";

export const PERSONAS: Array<{ id: AiPersona; label: string; hint: string; system: string }> = [
  {
    id: "coach",
    label: "Coach",
    hint: "Pläne & Technik",
    system:
      "Persona: erfahrener Calisthenics-Coach. Konkrete Sets/Reps, progressive Überlastung, Form-Hinweise. Kurz und umsetzbar.",
  },
  {
    id: "analyst",
    label: "Analyst",
    hint: "Daten & Trends",
    system:
      "Persona: Daten-Analyst. Nutze Zahlen aus dem App-Kontext, vergleiche Wochen, nenne klare Insights und nächste Schritte.",
  },
  {
    id: "motivator",
    label: "Motivator",
    hint: "Energie & Streak",
    system:
      "Persona: motivierender Trainingspartner. Positiv, ehrlich, kurze Pep-Talks und realistische Mini-Ziele. Kein Hype ohne Inhalt.",
  },
];

export type SuperTool = {
  id: string;
  icon: string;
  label: string;
  description: string;
  prompt: string;
};

/** 10 neue Super-AI Funktionen als One-Tap-Tools */
export const SUPER_TOOLS: SuperTool[] = [
  {
    id: "week_plan",
    icon: "📅",
    label: "Wochenplan",
    description: "7-Tage-Plan aus deinen Daten",
    prompt:
      "Erstelle mir einen realistischen 7-Tage-Trainingsplan (Push-Ups + ergänzende Übungen) basierend auf meinem aktuellen Level, Streak und Tagesziel. Je Tag: Fokus, Sets×Reps, Pause, optionale Alternative. Kurz und tabellarisch.",
  },
  {
    id: "week_review",
    icon: "📊",
    label: "Wochen-Review",
    description: "Was lief gut / schwach",
    prompt:
      "Analysiere meine letzten Workouts und Health-Daten der Woche. Was lief gut, wo stockt es, 3 konkrete Verbesserungen für die nächste Woche.",
  },
  {
    id: "form_check",
    icon: "🦴",
    label: "Form-Check",
    description: "Technik & Schultern",
    prompt:
      "Gib mir einen Form-Check für klassische Push-Ups: 5 häufige Fehler, wie ich sie korrigiere, und eine 5-Minuten-Mobility-Routine für Schultern/Wrist.",
  },
  {
    id: "recovery",
    icon: "😴",
    label: "Recovery",
    description: "Schlaf & Entlastung",
    prompt:
      "Erstelle einen Recovery-Plan für die nächsten 48 Stunden anhand meiner Schlaf-/Schrittdaten und Trainingslast. Inkl. wann ich trainieren sollte und wann Pause.",
  },
  {
    id: "micro",
    icon: "⚡",
    label: "Micro-Challenge",
    description: "Heute in 10 Min",
    prompt:
      "Schlage eine Micro-Challenge für heute vor (max. 10 Minuten), passend zu meinem Bestwert und Tagesziel. Regeln klar, XP-Feeling, machbar auch bei wenig Zeit.",
  },
  {
    id: "chat_summary",
    icon: "💬",
    label: "Chat-Fazit",
    description: "Community kurz fassen",
    prompt:
      "Fasse meine letzten Chat-Nachrichten und aktiven Räume zusammen: Themen, offene Fragen, ob jemand auf Antwort wartet. Maximal 8 Bulletpoints.",
  },
  {
    id: "motivation",
    icon: "🔥",
    label: "Motivations-Boost",
    description: "Streak retten",
    prompt:
      "Ich brauche einen kurzen Motivations-Boost und ein Mini-Ziel für die nächsten 15 Minuten, das meinen Streak schützt. Direkt, ehrlich, ohne Floskeln.",
  },
  {
    id: "pr_strategy",
    icon: "🏆",
    label: "PR-Strategie",
    description: "Nächster Bestwert",
    prompt:
      "Entwickle eine 2-Wochen-Strategie für einen neuen Push-Up-Personal-Best. Aufbau, Test-Tag, Deload, woran ich merke dass ich bereit bin.",
  },
  {
    id: "today_checklist",
    icon: "✅",
    label: "Heute-Checkliste",
    description: "Prioritäten des Tages",
    prompt:
      "Erstelle eine priorisierte Checkliste für heute: Training, Schritte, Wasser, Schlaf, Erholung. Maximal 6 Punkte, abhakbar formuliert.",
  },
  {
    id: "nutrition",
    icon: "🥗",
    label: "Fuel-Tipps",
    description: "Vor/nach Training",
    prompt:
      "Gib praxisnahe Ernährungs-Tipps rund ums Training (vor/nach Push-Up-Sessions), ohne Diät-Dogma. 5 konkrete, einfache Maßnahmen für den Alltag.",
  },
];

export type AiSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    meta?: { provider?: string; model?: string; task?: string };
  }>;
};

const SESSIONS_KEY = "super-ai-sessions-v2";
const PERSONA_KEY = "super-ai-persona";
const FAV_PROMPTS_KEY = "super-ai-fav-prompts";

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPersona(): AiPersona {
  if (!canStore()) return "coach";
  const v = window.localStorage.getItem(PERSONA_KEY);
  if (v === "analyst" || v === "motivator" || v === "coach") return v;
  return "coach";
}

export function savePersona(p: AiPersona) {
  if (!canStore()) return;
  window.localStorage.setItem(PERSONA_KEY, p);
}

export function loadSessions(): AiSession[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(list: AiSession[]) {
  if (!canStore()) return;
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 12)));
}

export function newSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function loadFavPrompts(): string[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(FAV_PROMPTS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as string[];
    return Array.isArray(p) ? p.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function toggleFavPrompt(text: string): string[] {
  const cur = loadFavPrompts();
  const next = cur.includes(text) ? cur.filter((x) => x !== text) : [text, ...cur].slice(0, 8);
  if (canStore()) window.localStorage.setItem(FAV_PROMPTS_KEY, JSON.stringify(next));
  return next;
}

export function exportChatMarkdown(
  title: string,
  messages: AiSession["messages"],
): string {
  const lines = [`# ${title}`, `Export: ${new Date().toLocaleString("de-DE")}`, ""];
  for (const m of messages) {
    lines.push(m.role === "user" ? "## Du" : "## Super-AI");
    if (m.meta) lines.push(`_${m.meta.task ?? ""} · ${m.meta.provider ?? ""}/${m.meta.model ?? ""}_`);
    lines.push(m.content, "");
  }
  return lines.join("\n");
}

/** Very light markdown → React-friendly lines (bold **x**, bullets). */
export function formatAssistantText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^### /gm, "")
    .replace(/^## /gm, "")
    .replace(/^# /gm, "");
}
