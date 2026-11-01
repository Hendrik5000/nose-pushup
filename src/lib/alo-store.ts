/** Account-scoped local-first Alo data. No keys, auth tokens or provider settings enter sync. */
export type AloKind = "capture" | "task" | "collection" | "shortcut" | "mira" | "draft" | "note";
export type AloBody = Record<string, unknown>;
export type AloRecord = {
  id: string;
  kind: AloKind;
  body: AloBody;
  updatedAt: string;
  revision: number;
  dirty: boolean;
  deleted: boolean;
  conflict?: { body: AloBody; revision: number; deleted: boolean; updatedAt: string };
};
export type MiraGrants = { training: boolean; rooms: string[] };
export const ALO_EVENT = "alo-data-changed";
export const ALO_REMOTE_EVENT = "alo-remote-applied";
let owner: string | null = null;
export function setAloOwner(id: string | null) {
  owner = id;
}
export function getAloOwner() {
  return owner;
}
export const aloKey = (id: string) => `alo-workspace-v1:${id}`;
const grantsKey = (id: string) => `alo-mira-grants-v1:${id}`;
export const cloudKey = (id: string) => `alo-cloud-enabled-v1:${id}`;
export function signalAlo(remote = false) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(remote ? ALO_REMOTE_EVENT : ALO_EVENT));
}
export function readRecords(id = owner): AloRecord[] {
  if (!id || typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(aloKey(id));
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((row: unknown) => {
      if (!row || typeof row !== "object") return false;
      const r = row as Partial<AloRecord>;
      return (
        typeof r.id === "string" &&
        ["capture", "task", "collection", "shortcut", "mira", "draft", "note"].includes(
          String(r.kind),
        ) &&
        !!r.body &&
        typeof r.body === "object" &&
        !Array.isArray(r.body) &&
        typeof r.revision === "number" &&
        Number.isSafeInteger(r.revision) &&
        r.revision >= 0 &&
        typeof r.dirty === "boolean" &&
        typeof r.deleted === "boolean" &&
        typeof r.updatedAt === "string"
      );
    })
  )
    throw new Error("Alo-Speicher beschädigt. Bitte Daten exportieren, nicht überschreiben.");
  return parsed as AloRecord[];
}
export function writeRecords(id: string, records: AloRecord[], remote = false) {
  // Deliberately propagate storage/quota errors: never show a false 'saved'.
  window.localStorage.setItem(aloKey(id), JSON.stringify(records));
  signalAlo(remote);
}
export function listAlo(kind?: AloKind, id = owner) {
  return readRecords(id).filter((r) => !r.deleted && (!kind || r.kind === kind));
}
export function putAlo(
  kind: AloKind,
  body: AloBody,
  recordId: string = crypto.randomUUID(),
  id = owner,
): AloRecord {
  if (!id) throw new Error("Bitte zuerst anmelden.");
  const all = readRecords(id);
  const old = all.find((r) => r.id === recordId);
  if (old && JSON.stringify(old.body) === JSON.stringify(body) && !old.deleted) return old;
  const row: AloRecord = {
    ...old,
    id: recordId,
    kind,
    body,
    revision: old?.revision ?? 0,
    updatedAt: new Date().toISOString(),
    dirty: true,
    deleted: false,
  };
  writeRecords(id, [...all.filter((r) => r.id !== recordId), row]);
  return row;
}
export function removeAlo(recordId: string, id = owner) {
  if (!id) return;
  writeRecords(
    id,
    readRecords(id).map((r) =>
      r.id === recordId
        ? {
            ...r,
            body: {},
            deleted: true,
            dirty: true,
            conflict: undefined,
            updatedAt: new Date().toISOString(),
          }
        : r,
    ),
  );
}
export function getMiraGrants(id = owner): MiraGrants {
  if (!id || typeof window === "undefined") return { training: false, rooms: [] };
  try {
    const raw = JSON.parse(window.localStorage.getItem(grantsKey(id)) ?? "{}");
    return {
      training: raw.training === true,
      rooms: Array.isArray(raw.rooms)
        ? raw.rooms.filter((r: unknown) => typeof r === "string")
        : [],
    };
  } catch {
    return { training: false, rooms: [] };
  }
}
export function saveMiraGrants(grants: MiraGrants, id = owner) {
  if (!id) return;
  window.localStorage.setItem(grantsKey(id), JSON.stringify(grants));
  signalAlo();
}
export function cloudEnabled(id = owner) {
  return (
    !!id && typeof window !== "undefined" && window.localStorage.getItem(cloudKey(id)) === "true"
  );
}
export function setCloudEnabled(enabled: boolean, id = owner) {
  if (!id) return;
  window.localStorage.setItem(cloudKey(id), String(enabled));
  signalAlo();
}
export type CloudRecord = {
  id: string;
  kind: AloKind;
  body: AloBody;
  revision: number;
  deleted: boolean;
  updated_at: string;
};
/** Pure merge: retain unsent edits; concurrent writes become explicit conflicts, not last-write-wins. */
export function mergeRemote(local: AloRecord[], remote: CloudRecord[]): AloRecord[] {
  const result = new Map(local.map((r) => [r.id, r]));
  for (const row of remote) {
    const old = result.get(row.id);
    if (old?.dirty && old.revision !== row.revision) {
      result.set(row.id, {
        ...old,
        conflict: {
          body: row.body,
          revision: row.revision,
          deleted: row.deleted,
          updatedAt: row.updated_at,
        },
      });
    } else if (!old?.dirty) {
      result.set(row.id, {
        id: row.id,
        kind: row.kind,
        body: row.body,
        revision: row.revision,
        deleted: row.deleted,
        dirty: false,
        updatedAt: row.updated_at,
      });
    }
  }
  return [...result.values()];
}
export function resolveConflict(recordId: string, choice: "local" | "remote", id = owner) {
  if (!id) return;
  writeRecords(
    id,
    readRecords(id).map((r) => {
      if (r.id !== recordId || !r.conflict) return r;
      const c = r.conflict;
      return choice === "local"
        ? { ...r, revision: c.revision, conflict: undefined, dirty: true }
        : {
            ...r,
            body: c.body,
            revision: c.revision,
            updatedAt: c.updatedAt,
            deleted: c.deleted,
            dirty: false,
            conflict: undefined,
          };
    }),
  );
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function safeLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export async function fileToData(file: File): Promise<string> {
  if (file.size > 1024 * 1024)
    throw new Error("Datei zu groß. Bitte höchstens 1 MB pro Datei verwenden.");
  // Do not persist active HTML/SVG documents or executable content.
  if (
    !/^(image\/(png|jpeg|webp|gif)|audio\/(webm|ogg|mp4|mpeg|wav)|application\/pdf|text\/plain)(;.*)?$/.test(
      file.type,
    )
  ) {
    throw new Error(
      "Unterstützt: PNG, JPEG, WebP, GIF, Audio, PDF und Text (keine aktiven HTML-/SVG-Dateien).",
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}
export function searchAlo<T extends { title: string; text: string }>(
  rows: T[],
  query: string,
): T[] {
  const terms = query.trim().toLocaleLowerCase("de-DE").split(/\s+/).filter(Boolean);
  return terms.length
    ? rows.filter((r) =>
        terms.every((t) => `${r.title} ${r.text}`.toLocaleLowerCase("de-DE").includes(t)),
      )
    : [];
}
