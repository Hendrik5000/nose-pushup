import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProfilePage } from "./profile-page-impl";
import { getProfileSettingsCategory, isProfileSettingsCategory } from "@/lib/profile-settings";

export const Route = createFileRoute("/_authenticated/settings/$category")({
  beforeLoad: ({ params }) => {
    if (!isProfileSettingsCategory(params.category)) throw redirect({ to: "/profile" });
  },
  head: ({ params }) => ({
    meta: [
      { title: `${getProfileSettingsCategory(params.category)?.title ?? "Einstellungen"} — Alo` },
    ],
  }),
  component: ProfileSettingsCategoryRoute,
});

function ProfileSettingsCategoryRoute() {
  const { category } = Route.useParams();
  if (!isProfileSettingsCategory(category)) return null;
  return <ProfilePage sectionId={category} />;
}
