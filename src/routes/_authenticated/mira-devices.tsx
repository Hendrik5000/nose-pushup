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
          "Mira Device Control: gekoppelte Geräte, Berechtigungen, Fernsteuerung und Not-Aus.",
      },
    ],
  }),
  component: MiraDevicesRoute,
});

function MiraDevicesRoute() {
  return (
    <AloPageSidebar active="mira">
      <MiraDevicesPage />
    </AloPageSidebar>
  );
}
