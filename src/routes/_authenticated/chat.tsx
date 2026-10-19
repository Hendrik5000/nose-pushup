import { createFileRoute } from "@tanstack/react-router";
import { LocalChatShell } from "@/components/chat/LocalChatShell";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Nexus Chat — Alo" },
      {
        name: "description",
        content:
          "Nexus Chat in Alo — Räume, Direktnachrichten und Reaktionen. Lokal oder verbunden.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return <LocalChatShell />;
}
