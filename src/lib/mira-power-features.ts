/**
 * Mira power features (user-facing multi-KI ideas).
 * Multi-provider calls are NEVER automatic — only after explicit user action.
 */

export type MiraPowerId =
  | "debate"
  | "routing_ui"
  | "persona_mixer"
  | "fact_check"
  | "style_transfer"
  | "format_workspace"
  | "memory_architect"
  | "workflow"
  | "simplify"
  | "sandbox";

export const MIRA_POWER_FEATURES: Array<{
  id: MiraPowerId;
  title: string;
  blurb: string;
  multiCall: boolean;
  callsHint?: string;
}> = [
  {
    id: "debate",
    title: "KI-Rat",
    blurb: "Drei Rollen (kreativ, logisch, kritisch) diskutieren kurz, dann gemeinsame Empfehlung.",
    multiCall: true,
    callsHint: "bis zu 4 KI-Anfragen",
  },
  {
    id: "routing_ui",
    title: "Transparente Modell-Wahl",
    blurb: "Zeigt, welches Modell warum gewählt wurde (bereits in jeder Antwort).",
    multiCall: false,
  },
  {
    id: "persona_mixer",
    title: "Persona-Mixer",
    blurb:
      "Mischt Ton: Empathie, Logik, Kreativität — steuert den System-Prompt, nicht stille Multi-KI.",
    multiCall: false,
  },
  {
    id: "fact_check",
    title: "Quellen-Check",
    blurb: "Zweite, kritische Prüfung der letzten Antwort (extra Anfrage).",
    multiCall: true,
    callsHint: "1 extra Anfrage",
  },
  {
    id: "style_transfer",
    title: "Stil-Transfer",
    blurb: "Antwort umschreiben: Business, Kumpel, Einstein-Stil …",
    multiCall: true,
    callsHint: "1 Anfrage",
  },
  {
    id: "format_workspace",
    title: "Format-Workspace",
    blurb: "Antwort als Tabelle, Stichpunkte oder Code-Struktur neu fassen.",
    multiCall: true,
    callsHint: "1 Anfrage",
  },
  {
    id: "memory_architect",
    title: "Gedächtnis-Architekt",
    blurb: "Notizen aus Chats speichern und durchsuchen (lokal, opt-in).",
    multiCall: false,
  },
  {
    id: "workflow",
    title: "Workflow-Kette",
    blurb:
      "Ziel in Schritte zerlegen (Brainstorm → Plan → Checkliste) — Schritte nacheinander, mit Bestätigung.",
    multiCall: true,
    callsHint: "3 Anfragen nacheinander",
  },
  {
    id: "simplify",
    title: "Einfach-Erklärer",
    blurb: "Letzte Antwort in einfacher Sprache.",
    multiCall: true,
    callsHint: "1 Anfrage",
  },
  {
    id: "sandbox",
    title: "Sandbox A/B",
    blurb: "Gleicher Prompt an zwei aktivierte Anbieter — nur nach Freigabe.",
    multiCall: true,
    callsHint: "2 Anfragen",
  },
];

export type PersonaMix = {
  empathy: number;
  logic: number;
  creativity: number;
};

const MIX_KEY = "alo-mira-persona-mix-v1";

export function loadPersonaMix(userId?: string | null): PersonaMix {
  const fallback: PersonaMix = { empathy: 40, logic: 40, creativity: 20 };
  if (typeof window === "undefined") return fallback;
  try {
    const key = userId ? `${MIX_KEY}:${userId}` : MIX_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as PersonaMix;
    return {
      empathy: clamp(p.empathy ?? 40),
      logic: clamp(p.logic ?? 40),
      creativity: clamp(p.creativity ?? 20),
    };
  } catch {
    return fallback;
  }
}

export function savePersonaMix(mix: PersonaMix, userId?: string | null) {
  if (typeof window === "undefined") return;
  const key = userId ? `${MIX_KEY}:${userId}` : MIX_KEY;
  localStorage.setItem(
    key,
    JSON.stringify({
      empathy: clamp(mix.empathy),
      logic: clamp(mix.logic),
      creativity: clamp(mix.creativity),
    }),
  );
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

export function personaMixSystemBlock(mix: PersonaMix): string {
  return [
    "PERSONA-MIXER (Nutzerwunsch für Ton & Schwerpunkt, kein zweites Modell):",
    `Empathie ${mix.empathy}%, Logik ${mix.logic}%, Kreativität ${mix.creativity}%.`,
    "Passe Stil und Argumentation entsprechend an; erfinde keine Fakten.",
  ].join(" ");
}

export type StyleId = "business" | "buddy" | "einstein" | "davinci" | "neutral";

export const STYLE_PRESETS: Array<{ id: StyleId; label: string; instruction: string }> = [
  {
    id: "business",
    label: "Business",
    instruction: "Formuliere klar, professionell, strukturiert, ohne Floskeln.",
  },
  {
    id: "buddy",
    label: "Kumpel",
    instruction: "Formuliere locker, freundschaftlich, auf Deutsch mit alltäglicher Sprache.",
  },
  {
    id: "einstein",
    label: "Einstein-Stil",
    instruction:
      "Erkläre anschaulich mit Gedankenexperimenten, bleib aber sachlich richtig; keine historischen Zitate erfinden.",
  },
  {
    id: "davinci",
    label: "Da-Vinci-Stil",
    instruction:
      "Verbinde Beobachtung, Skizze in Worten und praktische Schritte; keine erfundenen Fakten.",
  },
  {
    id: "neutral",
    label: "Neutral",
    instruction: "Sachlich, kurz, ohne Stilmittel.",
  },
];

export type FormatId = "text" | "bullets" | "table" | "code";

export function detectPreferredFormat(text: string): FormatId {
  const t = text.toLowerCase();
  if (/```|function |const |class |select |import /.test(t)) return "code";
  if (/\|.+\|/.test(text) || /tabelle|spalten|vergleich/.test(t)) return "table";
  if (/^- |\n- |\d+\. /.test(text) || /stichpunkte|liste|checkliste/.test(t)) return "bullets";
  return "text";
}

export function formatRewriteInstruction(format: FormatId): string {
  switch (format) {
    case "table":
      return "Strukturiere die Antwort als Markdown-Tabelle, wo sinnvoll; sonst klare Abschnitte.";
    case "code":
      return "Nutze Markdown-Codeblöcke mit Sprache, wo Code sinnvoll ist; erkläre knapp drumherum.";
    case "bullets":
      return "Antworte vor allem in klaren Stichpunkten oder einer nummerierten Liste.";
    default:
      return "Antworte in gut lesbarem Fließtext mit kurzen Absätzen.";
  }
}

export const DEBATE_ROLES = [
  {
    id: "creative",
    label: "Kreativ",
    system:
      "Du bist die kreative Stimme im KI-Rat. Bringe originelle Ideen; bleib knapp (max. 120 Wörter); keine erfundenen Fakten.",
  },
  {
    id: "logic",
    label: "Logik",
    system:
      "Du bist die logische Stimme im KI-Rat. Prüfe Argumente und Risiken; knapp (max. 120 Wörter).",
  },
  {
    id: "critical",
    label: "Kritisch",
    system:
      "Du bist die kritische Stimme im KI-Rat. Hinterfrage Annahmen und Lücken; knapp (max. 120 Wörter).",
  },
] as const;

export function debateSynthesisPrompt(question: string, parts: string[]): string {
  return [
    `Nutzerfrage: ${question}`,
    "Die drei Rat-Stimmen haben gesagt:",
    ...parts.map((p, i) => `--- Stimme ${i + 1} ---\n${p}`),
    "Fasse zu EINER gemeinsamen Empfehlung zusammen (max. 180 Wörter). Kennzeichne Unsicherheiten. Keine neuen Fakten erfinden.",
  ].join("\n\n");
}

export const WORKFLOW_STEPS = [
  {
    id: "brainstorm",
    label: "Brainstorm",
    instruction: "Nur Ideen sammeln (8–12 Stichpunkte). Noch kein detaillierter Plan.",
  },
  {
    id: "plan",
    label: "Plan",
    instruction: "Aus den Ideen einen realistischen Plan mit Reihenfolge und grobem Aufwand.",
  },
  {
    id: "checklist",
    label: "Checkliste",
    instruction: "Konkrete Checkliste mit abhakbaren Schritten und offenen Fragen.",
  },
] as const;

export function factCheckPrompt(claimText: string): string {
  return [
    "Du bist ein unabhängiger Fakten- und Plausibilitätsprüfer.",
    "Prüfe die folgende Antwort. Markiere: (1) gut belegt / plausibel, (2) unsicher, (3) problematisch.",
    "Erfinde keine Quellen. Wenn du keine Quelle kennst, sage das klar.",
    "Antwort maximal 200 Wörter.",
    "---",
    claimText.slice(0, 6000),
  ].join("\n");
}

export function simplifyPrompt(text: string): string {
  return [
    "Erkläre den folgenden Text einfach und klar, geeignet für Laien. Kurze Sätze, keine Fachwörter ohne Erklärung.",
    "---",
    text.slice(0, 6000),
  ].join("\n");
}

export function styleRewritePrompt(text: string, styleInstruction: string): string {
  return [
    "Schreibe den folgenden Text um. Behalte den inhaltlichen Kern; erfinde nichts dazu.",
    `Stilvorgabe: ${styleInstruction}`,
    "---",
    text.slice(0, 6000),
  ].join("\n");
}
