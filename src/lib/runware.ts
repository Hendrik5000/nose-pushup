/** Browser-safe Runware UI contract. No credentials or server-only imports belong here. */
export const RUNWARE_CAPABILITIES = [
  {
    id: "text",
    label: "Mira-Text",
    description:
      "Mira als allgemeine Assistentin für explizit eingegebene Texte; keine App-Kontextdaten werden automatisch übertragen.",
    effort: "mittel",
  },
  {
    id: "image-generation",
    label: "Bilderzeugung",
    description: "Erzeugt ein Bild aus einem Textprompt.",
    effort: "mittel",
  },
  {
    id: "image-editing",
    label: "Bildbearbeitung",
    description: "Bearbeitet ein ausgewähltes Bild anhand eines Textprompts.",
    effort: "mittel",
    inputImage: true,
  },
  {
    id: "image-upscale",
    label: "Verbessern / Upscaling",
    description:
      "Vergrößert ein Bild; Detail- und Realismusverbesserung sind im festen Serverrequest aktiviert.",
    effort: "mittel",
    inputImage: true,
  },
  {
    id: "audio-generation",
    label: "Sprache / Audio",
    description: "Erzeugt gesprochene Ausgabe aus dem eingegebenen Text.",
    effort: "mittel",
  },
  {
    id: "3d-generation",
    label: "3D-Modell",
    description: "Erzeugt ein 3D-Modell aus einem Textprompt.",
    effort: "hoch",
  },
  {
    id: "image-analysis",
    label: "Bildanalyse",
    description:
      "Derzeit nicht verfügbar: Es ist kein Bildanalysemodell mit verifiziertem Requestschema freigegeben.",
    effort: "mittel",
    inputImage: true,
  },
] as const;

export type RunwareCapability = (typeof RUNWARE_CAPABILITIES)[number]["id"];

export const RUNWARE_MODELS = [
  {
    id: "minimax:m2.7@0",
    label: "MiniMax M2.7",
    capability: "text",
    parameters:
      "1 Antwort; max. 1.024 Tokens; Temperatur 0,7; Textstream; Istkosten zurückgemeldet, keine Preisobergrenze.",
  },
  {
    id: "xai:grok-imagine@image-2.0",
    label: "Grok Imagine 2.0",
    capability: "image-generation",
    parameters: "1024×1024; 1 Ergebnis; Istkosten zurückgemeldet, keine Preisobergrenze.",
  },
  {
    id: "prunaai:2@1",
    label: "P-Image-Edit",
    capability: "image-editing",
    parameters: "1 Referenzbild, 1024×1024; Istkosten zurückgemeldet, keine Preisobergrenze.",
  },
  {
    id: "prunaai:p-image@upscale",
    label: "P-Image Upscale",
    capability: "image-upscale",
    parameters:
      "Faktor 2; Detail- und Realismusverbesserung; Istkosten zurückgemeldet, keine Preisobergrenze.",
  },
  {
    id: "fishaudio:s2.1@pro",
    label: "Fish Audio S2.1 Pro",
    capability: "audio-generation",
    parameters: "Sprachausgabe aus Prompt; Istkosten zurückgemeldet, keine Preisobergrenze.",
  },
  {
    id: "tripo:v3.1@0",
    label: "Tripo v3.1",
    capability: "3d-generation",
    parameters: "3D-Erzeugung aus Prompt; Istkosten zurückgemeldet, keine Preisobergrenze.",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  capability: RunwareCapability;
  parameters: string;
}[];

export type RunwareModel = (typeof RUNWARE_MODELS)[number];
export type RunwareResult = {
  id: string;
  capability: RunwareCapability;
  model: string;
  text?: string;
  url?: string;
  kind: "text" | "image" | "audio" | "model";
  /** Actual USD cost returned by Runware when available; never a quote. */
  cost?: number;
};

export type RunwareStatus = {
  available: boolean;
  reason: string;
  models: readonly RunwareModel[];
  capabilities: typeof RUNWARE_CAPABILITIES;
};

/** Streaming is implemented as an authenticated server-function Response with NDJSON frames. */
export const RUNWARE_TEXT_STREAMING_AVAILABLE = true as const;
export const RUNWARE_TEXT_STREAMING_REASON =
  "REST-SSE ist dokumentiert und wird als NDJSON an die UI weitergereicht. Kostenpflichtige Ausführung bleibt bis zu einer technisch durchsetzbaren Preisobergrenze gesperrt.";

export const RUNWARE_COST_LIMIT_AVAILABLE = false as const;
export const RUNWARE_COST_LIMIT_REASON =
  "Runware liefert Istkosten nach dem Lauf. Die dokumentierte routing.maxPrice-Grenze greift nur mit Modellrouting (model:auto), nicht mit der hier fest gewählten Modell-ID. Bis zu einer verifizierbaren Preisobergrenze bleiben bezahlte Aufrufe deaktiviert.";
