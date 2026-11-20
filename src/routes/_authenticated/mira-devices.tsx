import { createFileRoute } from "@tanstack/react-router";
import { MiraDevicesPage } from "@/components/mira/MiraDevicesPage";
import { AloPageSidebar } from "@/components/alo/AloPageSidebar";

export const Route = createFileRoute("/_authenticated/mira-devices")({
  head: () => ({
    meta: [
      { title: "Geräte — Mira" },
      {
        name: "description",
        content:
          "Mira Device Control: gekoppelte Geräte, Berechtigungen und Not-Aus. Phase 1 – lokale Planungsvorschau ohne echte Fernsteuerung.",
      },
    ],
  }),
  component: MiraDevicesRoute,
});

function MiraDevicesRoute() {
  const { user } = Route.useRouteContext();
  return (
    <AloPageSidebar active="mira">
      <MiraDevicesPage userId={user.id} />
    </AloPageSidebar>
  );
}
