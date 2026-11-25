import { useEffect, useState } from "react";
import {
  DEFAULT_PROVIDERS,
  GEMINI_MODEL_LABELS,
  SUPPORTED_PROVIDER_CATALOG,
  isSupportedProvider,
  loadProviders,
  saveProviders,
  type GeminiModelMode,
  type ProviderConfig,
  type ProviderId,
} from "@/lib/ai-providers";

export function AiProviderSettings({
  onSaved,
  userId,
}: {
  onSaved?: () => void;
  userId?: string | null;
}) {
  const currentUserId = userId ?? null;
  const [list, setList] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(currentUserId);
  const [saved, setSaved] = useState(false);
  const visibleList = loadedUserId === currentUserId ? list : DEFAULT_PROVIDERS;

  useEffect(() => {
    setList(loadProviders(currentUserId));
    setLoadedUserId(currentUserId);
    setSaved(false);
  }, [currentUserId]);

  const update = (id: ProviderId, patch: Partial<ProviderConfig>) => {
    if (!isSupportedProvider(id)) return;
    setList((previous) => previous.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider)));
    setSaved(false);
  };

  const onSave = () => {
    saveProviders(visibleList, currentUserId);
    setList(visibleList);
    setLoadedUserId(currentUserId);
    setSaved(true);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Für Google Gemini musst du deinen eigenen API-Key eingeben und Gemini aktivieren. Der Key
        bleibt nur im flüchtigen Arbeitsspeicher dieses Tabs, getrennt nach Konto; er wird weder in
        localStorage noch sessionStorage gespeichert. Wenn Gemini aktiviert ist, kann Mira es für
        passende Aufgaben auswählen. Erst wenn du Mira bewusst sendest, wird der Key über den
        authentifizierten Alo-Server an Google weitergegeben. Google erhält dann deine Nachricht,
        ausdrücklich freigegebene Alo-Kontextdaten und die von dir gesendeten Anhänge. Bei Nutzung
        des Gemini-Free-Tiers kann Google Inhalte laut Anbieter zur Produktverbesserung verwenden;
        Limits und mögliche Kosten hängen von deinem Google-Konto ab. Prüfe die aktuellen
        Bedingungen, bevor du sensible Inhalte sendest. Abmelden, Kontowechsel, Neuladen oder
        Schließen des Tabs entfernt den Key.
      </p>
      <p className="text-xs text-muted-foreground">
        OpenRouter Free ist optional; sein Key bleibt ebenfalls nur im Arbeitsspeicher dieses Tabs.
        Andere Anbieter bleiben serverseitig gesperrt.
      </p>
      {visibleList.map((provider) => {
        const canUseProvider = isSupportedProvider(provider.id);
        const isGemini = provider.id === "google";
        const catalogEntry = SUPPORTED_PROVIDER_CATALOG.find((entry) => entry.id === provider.id);
        return (
          <div
            key={provider.id}
            className="space-y-2 rounded-2xl border border-border bg-background/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{provider.label}</div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Aktiv
                <input
                  type="checkbox"
                  checked={canUseProvider && provider.enabled}
                  disabled={!canUseProvider}
                  onChange={(event) => update(provider.id, { enabled: event.target.checked })}
                />
              </label>
            </div>
            {canUseProvider && (
              <input
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={provider.apiKey}
                onChange={(event) => update(provider.id, { apiKey: event.target.value })}
                placeholder={isGemini ? "Gemini API-Key (nur für diesen Tab)" : "OpenRouter API-Key"}
                aria-label={isGemini ? "Google Gemini API-Key" : "OpenRouter API-Key"}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            )}
            {isGemini ? (
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Gemini-Modus</span>
                <select
                  aria-label="Gemini-Modus"
                  value={provider.model}
                  onChange={(event) =>
                    update(provider.id, { model: event.target.value as GeminiModelMode })
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  {(Object.keys(GEMINI_MODEL_LABELS) as GeminiModelMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {GEMINI_MODEL_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input
                value={provider.model}
                onChange={(event) => update(provider.id, { model: event.target.value })}
                disabled={!canUseProvider}
                readOnly={canUseProvider}
                placeholder="Modell"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            )}
            {catalogEntry && (
              <div className="space-y-1 rounded-xl bg-muted/40 p-2 text-[10px] text-muted-foreground">
                <p>{catalogEntry.summary}</p>
                <p>{catalogEntry.freeAccess}</p>
                <p>Freigegebene Modelle: {catalogEntry.models.join(", ")}</p>
                <div className="flex gap-3 text-primary">
                  <a href={catalogEntry.keyUrl} target="_blank" rel="noreferrer">
                    API-Key holen
                  </a>
                  <a href={catalogEntry.docsUrl} target="_blank" rel="noreferrer">
                    API-Doku und Preise
                  </a>
                </div>
              </div>
            )}
            {!canUseProvider && (
              <p className="text-[10px] text-muted-foreground">
                Dieser Anbieter ist in Alo serverseitig gesperrt.
              </p>
            )}
            <div className="text-[10px] text-muted-foreground">
              Aufgaben: {provider.tasks.join(", ")}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        {saved ? "Im Arbeitsspeicher dieses Tabs ✓" : "Für diesen Tab merken"}
      </button>
    </div>
  );
}
