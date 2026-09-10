import { useEffect, useState } from "react";
import { flushQueue, onQueueChange, pendingCount } from "@/lib/offline-queue";

/** Zeigt Offline-Status und wartende Einträge, synchronisiert automatisch. */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const refresh = () => void pendingCount().then(setPending);
    void refresh();

    const goOnline = async () => {
      setOnline(true);
      setSyncing(true);
      await flushQueue();
      setSyncing(false);
      void refresh();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const off = onQueueChange(refresh);
    const t = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      off();
      clearInterval(t);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.5rem+env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-xl">
        <span>{online ? "🔄" : "📴"}</span>
        <span>
          {!online
            ? "Offline — Einträge werden gespeichert"
            : syncing
              ? "Synchronisiere…"
              : `${pending} Eintrag${pending === 1 ? "" : "e"} warten auf Synchronisierung`}
        </span>
        {online && pending > 0 && !syncing && (
          <button
            onClick={async () => {
              setSyncing(true);
              await flushQueue();
              setSyncing(false);
              setPending(await pendingCount());
            }}
            className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground"
          >
            Jetzt senden
          </button>
        )}
      </div>
    </div>
  );
}
