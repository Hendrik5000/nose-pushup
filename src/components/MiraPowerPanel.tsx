import { useMemo, useRef, useState } from "react";
import {
  MIRA_POWER_FEATURES,
  STYLE_PRESETS,
  WORKFLOW_STEPS,
  loadPersonaMix,
  savePersonaMix,
  type FormatId,
  type PersonaMix,
  type StyleId,
} from "@/lib/mira-power-features";
import {
  addMiraMemoryNote,
  isMiraMemoryEnabled,
  loadMiraMemoryNotes,
  setMiraMemoryEnabled,
} from "@/lib/mira-memory";
import { MiraMemoryPanel } from "@/components/MiraMemoryPanel";

export type MiraPowerAction =
  | { type: "debate"; question: string }
  | { type: "fact_check"; text: string }
  | { type: "style"; text: string; style: StyleId }
  | { type: "format"; text: string; format: FormatId }
  | { type: "simplify"; text: string }
  | { type: "workflow"; goal: string; stepIndex: number; prior: string }
  | { type: "sandbox"; prompt: string };

type Props = {
  userId?: string | null;
  loading: boolean;
  lastUserText?: string;
  lastAssistantText?: string;
  input: string;
  onAction: (action: MiraPowerAction) => void;
};

export function MiraPowerPanel({
  userId,
  loading,
  lastUserText,
  lastAssistantText,
  input,
  onAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mix, setMix] = useState<PersonaMix>(() => loadPersonaMix(userId));
  const [memQuery, setMemQuery] = useState("");
  const [confirmMulti, setConfirmMulti] = useState<string | null>(null);
  const pendingRef = useRef<MiraPowerAction | null>(null);

  const notes = useMemo(() => {
    if (!isMiraMemoryEnabled(userId)) return [];
    const q = memQuery.trim().toLowerCase();
    const all = loadMiraMemoryNotes(userId);
    if (!q) return all.slice(0, 12);
    return all.filter((n) => n.text.toLowerCase().includes(q)).slice(0, 12);
  }, [userId, memQuery, open]);

  const question = (input.trim() || lastUserText || "").trim();
  const answer = (lastAssistantText || "").trim();

  const request = (action: MiraPowerAction, multiLabel?: string) => {
    if (multiLabel) {
      pendingRef.current = action;
      setConfirmMulti(multiLabel);
      return;
    }
    onAction(action);
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Mira Power · 10 Funktionen</span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          <p className="text-[11px] text-muted-foreground">
            Multi-KI-Aktionen starten nur nach deinem Klick und verbrauchen extra Anfragen.
            Routing-Hinweise siehst du unter jeder Antwort.
          </p>

          <div className="rounded-xl border border-border/70 p-3">
            <div className="text-xs font-semibold">Persona-Mixer</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Steuert den Ton im Prompt — keine stille Kombination mehrerer API-Keys.
            </p>
            {(
              [
                ["empathy", "Empathie"],
                ["logic", "Logik"],
                ["creativity", "Kreativität"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mix[key]}
                  disabled={loading}
                  onChange={(e) => {
                    const next = { ...mix, [key]: Number(e.target.value) };
                    setMix(next);
                    savePersonaMix(next, userId);
                  }}
                  className="min-w-0 flex-1"
                />
                <span className="w-8 text-right tabular-nums">{mix[key]}</span>
              </label>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {MIRA_POWER_FEATURES.filter(
              (f) =>
                f.id !== "routing_ui" &&
                f.id !== "persona_mixer" &&
                f.id !== "memory_architect",
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={loading}
                className="rounded-xl border border-border bg-background/80 px-3 py-2 text-left text-[11px] disabled:opacity-50"
                onClick={() => {
                  if (f.id === "debate") {
                    if (!question) return;
                    request({ type: "debate", question }, f.callsHint);
                  } else if (f.id === "fact_check") {
                    if (!answer) return;
                    request({ type: "fact_check", text: answer }, f.callsHint);
                  } else if (f.id === "simplify") {
                    if (!answer) return;
                    request({ type: "simplify", text: answer }, f.callsHint);
                  } else if (f.id === "sandbox") {
                    if (!question) return;
                    request({ type: "sandbox", prompt: question }, f.callsHint);
                  } else if (f.id === "workflow") {
                    if (!question) return;
                    request(
                      { type: "workflow", goal: question, stepIndex: 0, prior: "" },
                      f.callsHint,
                    );
                  } else if (f.id === "style_transfer") {
                    if (!answer) return;
                    request({ type: "style", text: answer, style: "business" }, f.callsHint);
                  } else if (f.id === "format_workspace") {
                    if (!answer) return;
                    request({ type: "format", text: answer, format: "bullets" }, f.callsHint);
                  }
                }}
              >
                <div className="font-semibold text-foreground">{f.title}</div>
                <div className="text-muted-foreground">{f.blurb}</div>
                {f.multiCall && (
                  <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                    {f.callsHint} · nur auf Klick
                  </div>
                )}
              </button>
            ))}
          </div>

          {answer && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold">Stil-Transfer (letzte Antwort)</div>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={loading}
                    className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold"
                    onClick={() => request({ type: "style", text: answer, style: s.id }, "1 Anfrage")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="text-[11px] font-semibold">Format</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["bullets", "Stichpunkte"],
                    ["table", "Tabelle"],
                    ["code", "Code"],
                    ["text", "Text"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={loading}
                    className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold"
                    onClick={() =>
                      request({ type: "format", text: answer, format: id }, "1 Anfrage")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border/70 p-3">
            <div className="text-xs font-semibold">Gedächtnis-Architekt</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Durchsuche lokale Notizen. Speichere die letzte Nutzer-Idee mit einem Tippen.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold"
                disabled={!lastUserText || loading}
                onClick={() => {
                  if (!isMiraMemoryEnabled(userId)) setMiraMemoryEnabled(true, userId);
                  if (lastUserText) addMiraMemoryNote(lastUserText, userId, "suggested");
                }}
              >
                Letzte Frage merken
              </button>
              <input
                value={memQuery}
                onChange={(e) => setMemQuery(e.target.value)}
                placeholder="Notizen durchsuchen…"
                className="min-w-[8rem] flex-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
              />
            </div>
            <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
              {notes.map((n) => (
                <li key={n.id} className="truncate">
                  · {n.text}
                </li>
              ))}
              {notes.length === 0 && <li>Keine Treffer / Gedächtnis aus.</li>}
            </ul>
            <div className="mt-2">
              <MiraMemoryPanel userId={userId} />
            </div>
          </div>

          {question && (
            <div>
              <div className="text-[11px] font-semibold">Workflow-Schritte einzeln</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {WORKFLOW_STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    disabled={loading}
                    className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold"
                    onClick={() =>
                      request(
                        {
                          type: "workflow",
                          goal: question,
                          stepIndex: index,
                          prior: answer,
                        },
                        "1 Anfrage",
                      )
                    }
                  >
                    {index + 1}. {step.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {confirmMulti && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px]">
              <p className="font-semibold">Extra KI-Anfragen bestätigen</p>
              <p className="mt-1 text-muted-foreground">
                Diese Aktion kann {confirmMulti} auslösen (BYOK/Lovable-Kontingent). Fortfahren?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  onClick={() => {
                    const a = pendingRef.current;
                    setConfirmMulti(null);
                    pendingRef.current = null;
                    if (a) onAction(a);
                  }}
                >
                  Ja, starten
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                  onClick={() => {
                    setConfirmMulti(null);
                    pendingRef.current = null;
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
