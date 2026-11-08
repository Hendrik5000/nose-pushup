import { useEffect, useRef, useState } from "react";
import { requestWaitingWorkerActivation } from "@/lib/pwa-update";

export function PwaUpdateNotice() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;

    const onControllerChange = () => {
      if (reloadAfterUpdate.current) window.location.reload();
    };
    const onStateChange = () => {
      if (installingWorker?.state === "installed" && navigator.serviceWorker.controller) {
        setWaitingWorker(registration?.waiting ?? installingWorker);
        setError("");
      }
    };
    const onUpdateFound = () => {
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener("statechange", onStateChange);
      onStateChange();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.ready
      .then((activeRegistration) => {
        if (cancelled) return;
        registration = activeRegistration;
        if (registration.waiting && navigator.serviceWorker.controller)
          setWaitingWorker(registration.waiting);
        registration.addEventListener("updatefound", onUpdateFound);
        return registration.update().catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
      installingWorker?.removeEventListener("statechange", onStateChange);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="App-Aktualisierung verfügbar"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-[100] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl"
    >
      <p className="text-sm font-semibold">Neue Alo-Version verfügbar</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Du kannst jetzt neu laden oder erst deine aktuelle Eingabe beenden.
      </p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={updating}
          onClick={() => setWaitingWorker(null)}
          className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium"
        >
          Später
        </button>
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setError("");
            if (!requestWaitingWorkerActivation(waitingWorker)) {
              setError(
                "Die Aktualisierung konnte nicht gestartet werden. Bitte später erneut versuchen.",
              );
              return;
            }
            reloadAfterUpdate.current = true;
            setUpdating(true);
          }}
          className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {updating ? "Wird vorbereitet…" : "Jetzt aktualisieren"}
        </button>
      </div>
    </aside>
  );
}
