const ADMIN_ACCESS_DENIED_NOTICE_KEY = "alo-admin-access-denied";

export const ADMIN_ACCESS_DENIED_NOTICE =
  "Der Admin-Bereich ist nur für berechtigte Alo-Konten verfügbar. Dein Zugriff wurde nicht freigegeben; andere Apps bleiben verfügbar.";

type NoticeStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type NoticeStorageGetter = () => NoticeStorage;

export function markAdminAccessDeniedNotice(getStorage: NoticeStorageGetter): void {
  try {
    getStorage().setItem(ADMIN_ACCESS_DENIED_NOTICE_KEY, "1");
  } catch {
    // Storage can be disabled; access stays denied even if the explanation cannot be saved.
  }
}

export function consumeAdminAccessDeniedNotice(getStorage: NoticeStorageGetter): boolean {
  try {
    const storage = getStorage();
    if (storage.getItem(ADMIN_ACCESS_DENIED_NOTICE_KEY) !== "1") return false;
    storage.removeItem(ADMIN_ACCESS_DENIED_NOTICE_KEY);
    return true;
  } catch {
    return false;
  }
}
