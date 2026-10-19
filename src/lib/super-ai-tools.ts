/** Super-AI skill tools + personas + session helpers. */

import { getAloOwner, listAlo, putAlo, removeAlo } from "@/lib/alo-store";
import type { AiWorkoutPlan, PlanFeedback } from "@/lib/ai-plan";

export type AiPersona = "general" | "writer" | "coach" | "analyst" | "motivator";

export const PERSONAS: Array<{ id: AiPersona; label: string; hint: string; system: string }> = [
  {
    id: "general",
    label: "Mira",
    hint: "Alltag & Wissen",
    system:
      "Persona: vielseitige, verlässliche Alltags-KI. Hilf bei Wissen, Schreiben, Ideen, Lernen und Planung. Passe Ton und Detailtiefe an die Frage an.",
  },
  {
    id: "writer",
    label: "Kreativ",
    hint: "Schreiben & Ideen",
    system:
      "Persona: kreative Schreib- und Ideenpartnerin. Biete mehrere originelle, brauchbare Optionen und überarbeite Texte nach dem gewünschten Ton.",
  },
  {
    id: "coach",
    label: "Sport",
    hint: "Optionaler Trainingscoach",
    system:
      "Persona: sachlicher Sport-Coach. Gib auf Nachfrage sichere, konkrete Trainingstipps; erfinde keine persönlichen Werte.",
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
    hint: "Energie & Trainingsserie",
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
    id: "ideas",
    icon: "✦",
    label: "Ideen",
    description: "Neue Perspektiven und Ansätze",
    prompt:
      "Hilf mir, 10 originelle Ideen für ein Vorhaben zu sammeln. Stelle zuerst nur dann eine Rückfrage, wenn sie wirklich nötig ist.",
  },
  {
    id: "draft",
    icon: "✍️",
    label: "Text entwerfen",
    description: "Eine Nachricht oder einen Text verfassen",
    prompt:
      "Hilf mir, einen klaren, freundlichen Text zu schreiben. Bitte frage nach Empfänger, Zweck und gewünschtem Ton, falls das noch offen ist.",
  },
  {
    id: "explain",
    icon: "💡",
    label: "Einfach erklären",
    description: "Ein Thema verständlich machen",
    prompt:
      "Erkläre mir ein komplexes Thema einfach, strukturiert und mit einem anschaulichen Beispiel. Frage mich, welches Thema, falls es fehlt.",
  },

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
    label: "Wochenrückblick",
    description: "Was lief gut / schwach",
    prompt:
      "Analysiere meine letzten Workouts und Health-Daten der Woche. Was lief gut, wo stockt es, 3 konkrete Verbesserungen für die nächste Woche.",
  },
  {
    id: "form_check",
    icon: "🦴",
    label: "Technikprüfung",
    description: "Technik & Schultern",
    prompt:
      "Gib mir einen Form-Check für klassische Push-Ups: 5 häufige Fehler, wie ich sie korrigiere, und eine 5-Minuten-Mobility-Routine für Schultern/Wrist.",
  },
  {
    id: "recovery",
    icon: "😴",
    label: "Erholung",
    description: "Schlaf & Entlastung",
    prompt:
      "Erstelle einen Recovery-Plan für die nächsten 48 Stunden anhand meiner Schlaf-/Schrittdaten und Trainingslast. Inkl. wann ich trainieren sollte und wann Pause.",
  },
  {
    id: "micro",
    icon: "⚡",
    label: "Kurze Herausforderung",
    description: "Heute in 10 Min",
    prompt:
      "Schlage eine Micro-Challenge für heute vor (max. 10 Minuten), passend zu meinem Bestwert und Tagesziel. Regeln klar, XP-Feeling, machbar auch bei wenig Zeit.",
  },
  {
    id: "chat_summary",
    icon: "💬",
    label: "Chat-Fazit",
    description: "Nexus Chat kurz fassen",
    prompt:
      "Fasse meine letzten Chat-Nachrichten und aktiven Räume zusammen: Themen, offene Fragen, ob jemand auf Antwort wartet. Maximal 8 Bulletpoints.",
  },
  {
    id: "motivation",
    icon: "🔥",
    label: "Motivationshilfe",
    description: "Trainingsserie erhalten",
    prompt:
      "Ich brauche einen kurzen Motivations-Boost und ein Mini-Ziel für die nächsten 15 Minuten, das meinen Streak schützt. Direkt, ehrlich, ohne Floskeln.",
  },
  {
    id: "pr_strategy",
    icon: "🏆",
    label: "Bestwert-Strategie",
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
    label: "Ernährungstipps",
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
    plan?: AiWorkoutPlan;
    feedback?: PlanFeedback;
    meta?: { provider?: string; model?: string; task?: string };
  }>;
};

const SESSIONS_KEY = "super-ai-sessions-v2";
const PERSONA_KEY = "alo-mira-persona-v1";
const FAV_PROMPTS_KEY = "super-ai-fav-prompts";
const accountKey = (key: string) => (getAloOwner() ? `${key}:${getAloOwner()}` : key);

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPersona(): AiPersona {
  if (!canStore()) return "general";
  try {
    const value = window.localStorage.getItem(accountKey(PERSONA_KEY));
    return PERSONAS.find((persona) => persona.id === value)?.id ?? "general";
  } catch {
    return "general";
  }
}

export function savePersona(p: AiPersona) {
  if (!canStore()) return;
  window.localStorage.setItem(accountKey(PERSONA_KEY), p);
}

export function loadSessions(): AiSession[] {
  if (getAloOwner())
    return listAlo("mira")
      .map((r) => r.body as unknown as AiSession)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!canStore()) return [];
  let sessions: AiSession[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSIONS_KEY) ?? "[]");
    sessions = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
  // Import once without deleting the original classic history or trimming existing chats.
  // A malformed legacy archive or blocked write must never hide healthy current sessions.
  try {
    const importKey = "super-ai-imported-classic-coach";
    if (!window.localStorage.getItem(importKey)) {
      const legacy = JSON.parse(window.localStorage.getItem("coach-chat-v1") ?? "[]");
      const messages = Array.isArray(legacy)
        ? legacy.filter(
            (message) =>
              message &&
              ["user", "assistant"].includes(message.role) &&
              typeof message.content === "string",
          )
        : [];
      if (messages.length && !sessions.some((session) => session.id === "classic-coach-import")) {
        sessions = [
          {
            id: "classic-coach-import",
            title: "Smart Coach · bisheriger Chat",
            updatedAt: new Date().toISOString(),
            messages,
          },
          ...sessions,
        ];
        window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      }
      window.localStorage.setItem(importKey, "1");
    }
  } catch {
    /* Keep the readable sessions even when the optional import fails. */
  }
  return sessions;
}

export function saveSessions(list: AiSession[]) {
  if (getAloOwner()) {
    for (const session of list)
      putAlo("mira", session as unknown as Record<string, unknown>, `mira:${session.id}`);
    return;
  }
  if (!canStore()) return;
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
}

export function newSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function loadFavPrompts(): string[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(accountKey(FAV_PROMPTS_KEY));
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
  if (canStore()) window.localStorage.setItem(accountKey(FAV_PROMPTS_KEY), JSON.stringify(next));
  return next;
}

export function exportChatMarkdown(title: string, messages: AiSession["messages"]): string {
  const lines = [`# ${title}`, `Export: ${new Date().toLocaleString("de-DE")}`, ""];
  for (const m of messages) {
    lines.push(m.role === "user" ? "## Du" : "## Mira");
    if (m.meta)
      lines.push(`_${m.meta.task ?? ""} · ${m.meta.provider ?? ""}/${m.meta.model ?? ""}_`);
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
