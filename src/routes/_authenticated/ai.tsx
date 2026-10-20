import { createFileRoute } from "@tanstack/react-router";
import { SuperAiPage } from "@/components/mira/SuperAiPage";

// Full UI restored in SuperAiPage — this route file stays thin.
export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Mira — Alo" },
      {
        name: "description",
        content:
          "Mira ist deine vielseitige KI. Fotos kannst du mitschicken.",
      },
    ],
  }),
  component: SuperAiPage,
});
