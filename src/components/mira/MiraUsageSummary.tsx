import { useEffect, useState } from "react";
import { formatMiraUsageLine, readMiraUsage, type MiraUsageEntry } from "@/lib/mira-usage";

/** Ehrliche lokale Nutzungsuebersicht: nur Anfragen-Zaehlung, keine Token- oder Kostenzahlen. */
export function MiraUsageSummary({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<MiraUsageEntry[]>([]);
  useEffect(() => {
    setEntries(readMiraUsage(userId));
  }, [userId]);

  return (
    <section className="mt-3" aria-label="Nutzung auf diesem Gerät">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Nutzung auf diesem Gerät
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Mira-Anfragen auf diesem Gerät gezählt.
        </p>
      ) : (
        <ul className="grid gap-1 text-xs">
          {entries.map((entry) => (
            <li
              key={entry.provider + ":" + entry.model}
              className="flex min-w-0 items-baseline justify-between gap-2"
            >
              <span className="min-w-0 break-words">{entry.provider + " · " + entry.model}</span>
              <span className="shrink-0 text-muted-foreground">
                {entry.count.toLocaleString("de-DE")}
                {" Anfragen"}
                {entry.errors ? ", " + entry.errors.toLocaleString("de-DE") + " Fehler" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        Nur grobe Zählung erfolgreicher Anfragen, lokal auf diesem Gerät gespeichert; keine
        Token- oder Kostenzahlen.
      </p>
    </section>
  );
}
