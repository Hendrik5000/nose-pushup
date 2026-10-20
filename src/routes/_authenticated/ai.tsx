import { createFileRoute } from "@tanstack/react-router";
import { SuperAiPage } from "@/components/mira/SuperAiPage";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Mira — Alo" },
      {
        name: "description",
        content:
          "Mira — deine vielseitige KI für Alltag, Wissen, Schreiben und Ideen. Fotos und Dateien sendest du nur mit deiner Freigabe.",
      },
    ],
  }),
  component: SuperAiPage,
});
