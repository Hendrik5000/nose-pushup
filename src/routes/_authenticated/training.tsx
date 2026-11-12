import { createFileRoute } from "@tanstack/react-router";
import { TrainingDashboard } from "@/components/TrainingDashboard";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({ meta: [{ title: "Trainingsübersicht & Gym — Alo" }] }),
  component: TrainingPage,
});

function TrainingPage() {
  const { user } = Route.useRouteContext();
  return <TrainingDashboard user={user} />;
}
