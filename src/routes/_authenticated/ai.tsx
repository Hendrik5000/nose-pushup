import { createFileRoute } from "@tanstack/react-router";
import { SuperAiPage } from "@/components/mira/SuperAiPage";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Mira — Alo" },
      {
        name: "description",
        content: "Mira — deine KI im Gemini-Stil. Text, Foto und klare Antworten.",
      },
    ],
  }),
  component: SuperAiPage,
});
