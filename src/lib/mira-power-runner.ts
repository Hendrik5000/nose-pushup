import type { AiTask, ProviderConfig } from "@/lib/ai-providers";
import { toPayload } from "@/lib/ai-providers";
import type { MiraPowerAction } from "@/components/MiraPowerPanel";
import {
  DEBATE_ROLES,
  STYLE_PRESETS,
  WORKFLOW_STEPS,
  debateSynthesisPrompt,
  factCheckPrompt,
  formatRewriteInstruction,
  simplifyPrompt,
  styleRewritePrompt,
} from "@/lib/mira-power-features";

type SendFn = (args: {
  data: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    provider: ReturnType<typeof toPayload>;
    task: string;
    systemExtra: string;
  };
}) => Promise<{ reply: string; provider: string; model: string; task: string }>;

export type PowerRunnerDeps = {
  send: SendFn;
  loadProviders: () => ProviderConfig[];
  generationRef: { current: number };
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setSettingsOpen: (v: boolean) => void;
  appendUser: (content: string) => void;
  appendAssistant: (
    content: string,
    meta?: { provider?: string; model?: string; task?: string; routingReason?: string },
  ) => void;
};

export async function runMiraPowerAction(action: MiraPowerAction, deps: PowerRunnerDeps) {
  const {
    send,
    loadProviders,
    generationRef,
    setLoading,
    setError,
    setSettingsOpen,
    appendUser,
    appendAssistant,
  } = deps;

  setError(null);
  setLoading(true);
  const generation = ++generationRef.current;

  try {
    const providers = loadProviders().filter(
      (p) => p.enabled && (p.id === "lovable" || p.apiKey.trim()),
    );
    const primary = providers[0];
    if (!primary) {
      setError("Kein aktiver KI-Anbieter.");
      setSettingsOpen(true);
      return;
    }

    const callOnce = async (
      userText: string,
      systemExtra: string,
      provider: ProviderConfig = primary,
      task: AiTask = "general",
    ) =>
      send({
        data: {
          messages: [{ role: "user", content: userText }],
          provider: toPayload(provider),
          task,
          systemExtra,
        },
      });

    if (action.type === "debate") {
      appendUser(`KI-Rat: ${action.question}`);
      const parts: string[] = [];
      for (const role of DEBATE_ROLES) {
        if (generation !== generationRef.current) return;
        const res = await callOnce(action.question, `${role.system}\nAntworte auf Deutsch.`);
        parts.push(`**${role.label}:** ${res.reply}`);
        appendAssistant(`**${role.label}:** ${res.reply}`, {
          provider: res.provider,
          model: res.model,
          task: res.task,
          routingReason: `KI-Rat · Rolle ${role.label} (explizit gestartet)`,
        });
      }
      if (generation !== generationRef.current) return;
      const synth = await callOnce(
        debateSynthesisPrompt(action.question, parts),
        "Du moderierst den KI-Rat und lieferst die gemeinsame Empfehlung auf Deutsch.",
      );
      appendAssistant(synth.reply, {
        provider: synth.provider,
        model: synth.model,
        task: synth.task,
        routingReason: "KI-Rat · Synthese (explizit gestartet)",
      });
      return;
    }

    if (action.type === "fact_check") {
      const res = await callOnce(
        factCheckPrompt(action.text),
        "Unabhängige Prüfung. Keine erfundenen Quellen.",
      );
      appendAssistant(`**Quellen-Check:**\n${res.reply}`, {
        provider: res.provider,
        model: res.model,
        task: res.task,
        routingReason: "Quellen-Check (explizit, 1 extra Anfrage)",
      });
      return;
    }

    if (action.type === "simplify") {
      const res = await callOnce(simplifyPrompt(action.text), "Einfache Sprache, Deutsch.");
      appendAssistant(`**Einfach erklärt:**\n${res.reply}`, {
        provider: res.provider,
        model: res.model,
        task: res.task,
        routingReason: "Einfach-Erklärer (explizit)",
      });
      return;
    }

    if (action.type === "style") {
      const style = STYLE_PRESETS.find((s) => s.id === action.style) ?? STYLE_PRESETS[0]!;
      const res = await callOnce(
        styleRewritePrompt(action.text, style.instruction),
        "Stil-Transfer. Inhalt beibehalten.",
      );
      appendAssistant(`**Stil · ${style.label}:**\n${res.reply}`, {
        provider: res.provider,
        model: res.model,
        task: res.task,
        routingReason: `Stil-Transfer · ${style.label}`,
      });
      return;
    }

    if (action.type === "format") {
      const res = await callOnce(
        `${formatRewriteInstruction(action.format)}\n\n---\n${action.text.slice(0, 6000)}`,
        "Format-Workspace: nur umstrukturieren, nichts erfinden.",
      );
      appendAssistant(res.reply, {
        provider: res.provider,
        model: res.model,
        task: res.task,
        routingReason: `Format-Workspace · ${action.format}`,
      });
      return;
    }

    if (action.type === "workflow") {
      const step = WORKFLOW_STEPS[action.stepIndex] ?? WORKFLOW_STEPS[0]!;
      const prompt = [
        `Ziel: ${action.goal}`,
        action.prior ? `Bisheriger Kontext:\n${action.prior.slice(0, 3000)}` : "",
        step.instruction,
      ]
        .filter(Boolean)
        .join("\n\n");
      appendUser(`Workflow · ${step.label}: ${action.goal}`);
      const res = await callOnce(prompt, `Workflow-Schritt „${step.label}". Antworte auf Deutsch.`);
      appendAssistant(`**${step.label}:**\n${res.reply}`, {
        provider: res.provider,
        model: res.model,
        task: res.task,
        routingReason: `Workflow · ${step.label} (explizit)`,
      });
      return;
    }

    if (action.type === "sandbox") {
      const pair = providers.slice(0, 2);
      if (pair.length < 2) {
        setError("Sandbox braucht mindestens zwei aktivierte Anbieter (z. B. Lovable + OpenAI).");
        return;
      }
      appendUser(`Sandbox A/B: ${action.prompt}`);
      for (const prov of pair) {
        if (generation !== generationRef.current) return;
        const res = await callOnce(
          action.prompt,
          "Sandbox-Vergleich: beantworte eigenständig auf Deutsch.",
          prov,
        );
        appendAssistant(`**${prov.label}:**\n${res.reply}`, {
          provider: res.provider,
          model: res.model,
          task: res.task,
          routingReason: `Sandbox A/B · ${prov.label} (explizit, 2 Anfragen)`,
        });
      }
    }
  } catch (e) {
    if (generation !== generationRef.current) return;
    const msg = e instanceof Error ? e.message : "Fehler";
    setError(msg);
    appendAssistant(`⚠️ ${msg}`);
  } finally {
    if (generation === generationRef.current) setLoading(false);
  }
}
