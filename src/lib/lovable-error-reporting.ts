import { reportError } from "@/lib/error-reports";

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  // Keep the full diagnostic only in the existing local report store.
  reportError(error, {
    source: String(context.boundary ?? context.source ?? "react_error_boundary"),
    severity: "error",
    extra: context,
  });
}
