import { supabase } from "@/integrations/supabase/client";

/**
 * Offline-Warteschlange: Trainings, Läufe und Health-Einträge werden bei
 * fehlender Verbindung lokal in IndexedDB gepuffert und automatisch
 * nachgesendet, sobald die App wieder online ist.
 */

export type QueueTable = "workouts" | "runs" | "health_entries";

export type QueueItem = {
  id: number;
  table: QueueTable;
  row: Record<string, unknown>;
  created_at: number;
};

const DB_NAME = "nosy-offline";
const STORE = "queue";
const EVENT = "offline-queue-change";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => resolve(null);
      }),
  );
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onQueueChange(cb: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export async function enqueue(table: QueueTable, row: Record<string, unknown>) {
  await tx("readwrite", (s) => s.add({ table, row, created_at: Date.now() } as never));
  notify();
}

export async function pendingItems(): Promise<QueueItem[]> {
  const all = await tx<QueueItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueueItem[]>);
  return all ?? [];
}

export async function pendingCount(): Promise<number> {
  return (await pendingItems()).length;
}

async function remove(id: number) {
  await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

/** Alle gepufferten Einträge nachsenden. Gibt die Anzahl erfolgreicher Sends zurück. */
export async function flushQueue(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const items = await pendingItems();
  let sent = 0;
  for (const item of items) {
    const { error } = await supabase.from(item.table as never).insert(item.row as never);
    // Bereits vorhandene/ungültige Zeilen nicht endlos wiederholen.
    if (!error || error.code === "23505") {
      await remove(item.id);
      sent++;
    }
  }
  if (sent) notify();
  return sent;
}

/**
 * Speichert eine Zeile — offline landet sie in der Warteschlange.
 * Gibt zurück, ob der Eintrag direkt gespeichert wurde.
 */
export async function saveOrQueue(
  table: QueueTable,
  row: Record<string, unknown>,
): Promise<{ queued: boolean; error: string | null }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueue(table, row);
    return { queued: true, error: null };
  }
  const { error } = await supabase.from(table as never).insert(row as never);
  if (error) {
    await enqueue(table, row);
    return { queued: true, error: null };
  }
  return { queued: false, error: null };
}
