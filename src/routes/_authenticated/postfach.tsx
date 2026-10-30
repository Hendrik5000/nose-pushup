import { createFileRoute } from "@tanstack/react-router";
import { PostfachPage } from "@/components/postfach/PostfachPage";

export const Route = createFileRoute("/_authenticated/postfach")({
  head: () => ({
    meta: [
      { title: "Postfach — Alo" },
      {
        name: "description",
        content: "Freundschaftseinladungen, Battle-Anfragen und verpasste Anrufe in Alo.",
      },
    ],
  }),
  component: PostfachPage,
});
