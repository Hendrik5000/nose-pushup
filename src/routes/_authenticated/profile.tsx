import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "./profile-page-impl";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Einstellungen — Nose Push" }],
  }),
  component: ProfilePage,
});
