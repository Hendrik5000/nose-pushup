import { useEffect, useState } from "react";
import {
  DEFAULT_PROVIDERS,
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

  useEffect(() => {
    setList(loadProviders(userId));
  }, [userId]);

  const update = (id: string, patch: Partial<ProviderConfig>) => {
    setList((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(false);
  };

  const onSave = () => {
    saveProviders(list, userId);
    setSaved(true);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Keys sind kontogebunden auf diesem Gerät (localStorage) und werden beim Abmelden gelöscht.
        Super-AI wählt je nach Aufgabe den passenden Provider. Custom-URL: nur HTTPS, serverseitig
        gegen interne Netze gesperrt.
      </p>
      {list.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{p.label}</div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Aktiv
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) => update(p.id, { enabled: e.target.checked })}
              />
            </label>
          </div>
          {p.id !== "lovable" && (
            <input
              type="password"
              autoComplete="off"
              value={p.apiKey}
              onChange={(e) => update(p.id, { apiKey: e.target.value })}
              placeholder="API-Key"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
          )}
          {p.id === "custom" && (
            <input
              value={p.baseUrl ?? ""}
              onChange={(e) => update(p.id, { baseUrl: e.target.value })}
              placeholder="Base-URL (https://…/v1)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
          )}
          <input
            value={p.model}
            onChange={(e) => update(p.id, { model: e.target.value })}
            placeholder="Modell"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          />
          <div className="text-[10px] text-muted-foreground">Aufgaben: {p.tasks.join(", ")}</div>
        </div>
      ))}
      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        {saved ? "Gespeichert ✓" : "Keys speichern"}
      </button>
    </div>
  );
}
