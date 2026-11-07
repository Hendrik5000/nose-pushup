import { createFileRoute } from "@tanstack/react-router";
import { AloPageSidebar } from "@/components/alo/AloPageSidebar";
import { ProfilePage } from "./profile-page-impl";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Einstellungen — Alo" }],
  }),
  component: ProfileSettingsHubRoute,
});

function ProfileSettingsHubRoute() {
  return (
    <AloPageSidebar active="settings">
      <ProfilePage />
    </AloPageSidebar>
  );
}
