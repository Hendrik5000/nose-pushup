import { useEffect, useState } from "react";
import {
  MIRA_ACTIVITY_KIND_LABELS,
  readMiraActivity,
  type MiraActivityEntry,
} from "@/lib/mira-activity-log";

/** Ehrliches lokales Protokoll: nur dieses Gerät, nie die Cloud. */
export function MiraActivityLog({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<MiraActivityEntry[]>([]);
  useEffect(() => {
    setEntries(readMiraActivity(userId));
  }, [userId]);

  return (
    <section className="mt-3" aria-label="Was Mira gemacht hat">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Was Mira gemacht hat (7 Tage)
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Mira-Aktivität auf diesem Gerät protokolliert.
        </p>
      ) : (
        <ul className="grid gap-1 text-xs">
          {entries.map((entry, index) => (
            <li
              key={entry.at + ":" + index}
              className="flex min-w-0 items-baseline justify-between gap-2"
            >
              <span className="min-w-0 break-words">
                {(MIRA_ACTIVITY_KIND_LABELS[entry.kind] ?? entry.kind) + ": " + entry.label}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {new Date(entry.at).toLocaleString("de-DE")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        Nur dieses Gerät, nie in die Cloud; Einträge fallen nach 7 Tagen automatisch heraus.
      </p>
    </section>
  );
}
