import { createFileRoute } from "@tanstack/react-router";
import { LocalChatShell } from "@/components/chat/LocalChatShell";
import { AloPageSidebar } from "@/components/alo/AloPageSidebar";

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
  validateSearch: (search: Record<string, unknown>): { dm?: string } => ({
    dm: typeof search.dm === "string" && /^[0-9a-f-]{36}$/i.test(search.dm) ? search.dm : undefined,
  }),
  component: ChatPage,
});

function ChatPage() {
  const { dm } = Route.useSearch();
  return (
    <AloPageSidebar active="nexus">
      <LocalChatShell initialDmId={dm} />
    </AloPageSidebar>
  );
}
