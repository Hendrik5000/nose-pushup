import { useEffect, useState } from "react";
import {
  DEFAULT_PROVIDERS,
  FREE_PROVIDER_CATALOG,
  isFreeOnlyProvider,
  loadProviders,
  saveProviders,
  type ProviderConfig,
} from "@/lib/ai-providers";

export function AiProviderSettings({
  onSaved,
  userId,
}: {
  onSaved?: () => void;
  userId?: string | null;
}) {
  const [list, setList] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);
  const [saved, setSaved] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    setList(loadProviders(userId));
  }, [userId]);

  const update = (id: string, patch: Partial<ProviderConfig>) => {
    if (id !== "openrouter") return;
    setList((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(false);
  };

  const onSave = () => {
    try {
      saveProviders(list, userId);
      setSaved(true);
      setStorageError(null);
      onSaved?.();
    } catch {
      setSaved(false);
      setStorageError(
        "Der Browser-Sitzungsspeicher ist nicht verfügbar. Der API-Key wurde nicht gespeichert.",
      );
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Alo ist im Free-only-Modus: Aktuell ist ausschließlich OpenRouter Free freigeschaltet; der
        Router verwendet nur kostenlose Modelle (20 Anfragen/Minute, 50/Tag). Es gibt keinen
        kostenpflichtigen Fallback. Andere Anbieter bleiben gesperrt, solange eine garantierte
        Nutzung ohne Zahlungsdaten oder Abrechnung nicht nachgewiesen ist. Dein OpenRouter-Key wird
        nur in dieser Browser-Sitzung gespeichert und beim Abmelden gelöscht. Er ist nicht
        verschlüsselt und für aktive Seitenskripte zugänglich; nutze einen separaten Key mit minimalen
        Berechtigungen.
      </p>
      {list.map((p) => {
        const canUseProvider = isFreeOnlyProvider(p.id);
        return (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-background/40 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{p.label}</div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Aktiv
                <input
                  type="checkbox"
                  checked={canUseProvider && p.enabled}
                  disabled={!canUseProvider}
                  onChange={(e) => update(p.id, { enabled: e.target.checked })}
                />
              </label>
            </div>
            {canUseProvider && (
              <input
                type="password"
                autoComplete="off"
                value={p.apiKey}
                onChange={(e) => update(p.id, { apiKey: e.target.value })}
                placeholder="API-Key"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            )}
            <input
              value={p.model}
              onChange={(e) => update(p.id, { model: e.target.value })}
              disabled={!canUseProvider}
              readOnly={canUseProvider}
              placeholder="Modell"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
            {FREE_PROVIDER_CATALOG.some((entry) => entry.id === p.id) && (
              <div className="space-y-1 rounded-xl bg-muted/40 p-2 text-[10px] text-muted-foreground">
                {(() => {
                  const entry = FREE_PROVIDER_CATALOG.find((item) => item.id === p.id)!;
                  return (
                    <>
                      <p>{entry.summary}</p>
                      <p>{entry.freeAccess}</p>
                      <p>Freigegebene Modelle: {entry.models.join(", ")}</p>
                      <div className="flex gap-3 text-primary">
                        <a href={entry.keyUrl} target="_blank" rel="noreferrer">
                          API-Key holen
                        </a>
                        <a href={entry.docsUrl} target="_blank" rel="noreferrer">
                          API-Doku
                        </a>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {!canUseProvider && (
              <p className="text-[10px] text-muted-foreground">
                Dieser Anbieter ist im Free-only-Modus serverseitig gesperrt.
              </p>
            )}
            <div className="text-[10px] text-muted-foreground">
              Aufgaben: {p.tasks.join(", ")}
            </div>
          </div>
        );
      })}
      {storageError && (
        <p role="alert" className="text-xs text-destructive">
          {storageError}
        </p>
      )}
      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        {saved ? "Für diese Sitzung gespeichert ✓" : "Sitzung speichern"}
      </button>
    </div>
  );
}
