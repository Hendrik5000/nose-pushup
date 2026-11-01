export type WatchSyncFields = {
  steps?: number;
  activeKcal?: number;
  sleepMin?: number;
};

export type ExistingWatchHealthEntry = {
  steps: number | null;
  active_kcal: number | null;
  sleep_min: number | null;
  weight_kg: number | null;
};

export type WatchHealthEntryPayload = {
  user_id: string;
  day: string;
  steps: number;
  active_kcal: number;
  sleep_min: number;
  weight_kg: number | null;
  source: "watch";
};

export type WatchSyncGateway = {
  getUserId(): Promise<string | null>;
  getEntry(userId: string, day: string): Promise<ExistingWatchHealthEntry | null>;
  upsert(payload: WatchHealthEntryPayload): Promise<void>;
};

/** Confirms the account, merge read, and write before reporting a day as synced. */
export async function syncWatchDay(
  day: string,
  fields: WatchSyncFields,
  gateway: WatchSyncGateway,
): Promise<void> {
  const userId = await gateway.getUserId();
  if (!userId) throw new Error("Watch sync requires an authenticated user");

  const existing = await gateway.getEntry(userId, day);
  const payload: WatchHealthEntryPayload = {
    user_id: userId,
    day,
    steps: fields.steps ?? existing?.steps ?? 0,
    active_kcal: fields.activeKcal ?? existing?.active_kcal ?? 0,
    sleep_min: fields.sleepMin ?? existing?.sleep_min ?? 0,
    weight_kg: existing?.weight_kg ?? null,
    source: "watch",
  };

  await gateway.upsert(payload);
}

export type WatchImportRow = { day: string };

export type WatchImportResult<T extends WatchImportRow> = {
  imported: T[];
  failed: T[];
};

/** Saves rows independently so one failed day does not hide successful days. */
export async function importWatchRows<T extends WatchImportRow>(
  rows: readonly T[],
  sync: (row: T) => Promise<void>,
): Promise<WatchImportResult<T>> {
  const imported: T[] = [];
  const failed: T[] = [];

  for (const row of rows) {
    try {
      await sync(row);
      imported.push(row);
    } catch {
      failed.push(row);
    }
  }

  return { imported, failed };
}

function formatDay(day: string): string {
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : day;
}

/** Keeps partial imports honest and shows a few dates that can be retried. */
export function formatWatchImportResult(result: WatchImportResult<WatchImportRow>): string {
  const importedCount = result.imported.length;
  const failedCount = result.failed.length;

  if (failedCount === 0) {
    if (importedCount === 0) return "Keine erkennbaren Daten in der Datei";
    return `${importedCount} ${importedCount === 1 ? "Tag" : "Tage"} importiert ✓`;
  }

  const importedText = importedCount
    ? `${importedCount} ${importedCount === 1 ? "Tag" : "Tage"} importiert; `
    : "Nichts importiert; ";
  const failedDays = result.failed
    .slice(0, 3)
    .map(({ day }) => formatDay(day))
    .join(", ");
  const omittedDays = failedCount > 3 ? ", …" : "";
  const failedText = `${failedCount} ${failedCount === 1 ? "Tag konnte" : "Tage konnten"} nicht gespeichert werden`;

  return `${importedText}${failedText} (${failedDays}${omittedDays}). Bitte Datei erneut importieren.`;
}
