import { ALO_APP_VERSION } from "@/lib/app-version";

export function AloAppVersion() {
  return (
    <p className="px-4 py-4 text-center text-xs text-muted-foreground">
      Alo-Version <span className="font-medium text-foreground">{ALO_APP_VERSION}</span>
    </p>
  );
}
