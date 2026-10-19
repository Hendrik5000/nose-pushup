import { createFileRoute } from "@tanstack/react-router";
import { LocalChatShell } from "@/components/chat/LocalChatShell";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Community-Chat — Nose Push" },
      {
        name: "description",
        content: "Nexus Chat nativ in Nosy Push-Ups — Räume, DMs, Reaktionen (lokal).",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return <LocalChatShell />;
}
