import { supabase } from "@/integrations/supabase/client";

/** Offline entries keep their original save timestamp and stable row ID. */
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
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const req = fn(transaction.objectStore(STORE));
      let result: T;
      req.onsuccess = () => {
        result = req.result;
      };
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onerror = transaction.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}
function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}
export function onQueueChange(cb: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
export async function enqueue(table: QueueTable, row: Record<string, unknown>): Promise<boolean> {
  const id = await tx("readwrite", (store) => store.add({ table, row, created_at: Date.now() }));
  if (id === null) return false;
  notify();
  return true;
}
export async function pendingItems(): Promise<QueueItem[]> {
  return (await tx<QueueItem[]>("readonly", (store) => store.getAll())) ?? [];
}
export async function pendingCount(): Promise<number> {
  return (await pendingItems()).length;
}
async function remove(id: number) {
  await tx("readwrite", (store) => store.delete(id));
}
let flushing: Promise<number> | null = null;
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  flushing = flush().finally(() => {
    flushing = null;
  });
  return flushing;
}
async function flush(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return 0;
  let sent = 0;
  for (const item of await pendingItems()) {
    // Never send another account's locally buffered data under the current login.
    if (item.row.user_id !== data.user.id) continue;
    try {
      const { error } = await supabase.from(item.table as never).insert(item.row as never);
      if (!error || (error.code === "23505" && typeof item.row.id === "string")) {
        await remove(item.id);
        sent++;
      }
    } catch {
      break;
    }
  }
  if (sent) notify();
  return sent;
}

export async function saveOrQueue(
  table: QueueTable,
  row: Record<string, unknown>,
): Promise<{ queued: boolean; error: string | null }> {
  const stableRow =
    table === "health_entries"
      ? row
      : {
          ...row,
          id: row.id ?? crypto.randomUUID(),
          created_at: row.created_at ?? new Date().toISOString(),
        };
  const queue = async () => {
    const ok = await enqueue(table, stableRow);
    return {
      queued: ok,
      error: ok
        ? null
        : "Nicht gespeichert: Der lokale Speicher ist nicht verfügbar. Bitte erneut versuchen und diese Seite geöffnet lassen.",
    };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  try {
    const { error, status } = await supabase.from(table as never).insert(stableRow as never);
    if (!error) return { queued: false, error: null };
    if (error.code === "23505" && typeof stableRow.id === "string")
      return { queued: false, error: null };
    // Invalid values and permission errors need attention, not an endless queue.
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return {
        queued: false,
        error:
          "Nicht gespeichert: Trainingsdaten oder Zugriffsberechtigung prüfen und erneut versuchen.",
      };
    }
    return queue();
  } catch {
    return queue();
  }
}
