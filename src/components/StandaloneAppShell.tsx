import type { ReactNode } from "react";
import { AppNavigation } from "@/components/TopNav";

/** Gives public, standalone app routes the same app-specific navigation shell as authenticated routes. */
export function StandaloneAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="alo-public-app-shell min-h-[100dvh]">
      <AppNavigation />
      <div className="alo-module-surface">{children}</div>
    </div>
  );
}
