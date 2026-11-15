import AloBrowser from "@/components/browser/AloBrowser";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/browser")({
  component: AloBrowser,
});
