import {
  getPcConfiguratorProfile,
  PC_CONFIGURATOR_BUDGET_STEP,
  PC_CONFIGURATOR_MAX_BUDGET,
  PC_CONFIGURATOR_MIN_BUDGET,
  validateMiraInteraction,
  type PcConfiguratorInteraction,
} from "@/lib/mira-interactions";

type MiraInteractiveCardProps = {
  interaction: unknown;
  onChange: (interaction: PcConfiguratorInteraction) => void;
};

/** Renders only the fixed pcConfigurator shape; untrusted or stale payloads produce no controls. */
export function MiraInteractiveCard({ interaction, onChange }: MiraInteractiveCardProps) {
  const config = validateMiraInteraction(interaction);
  if (!config) return null;

  const profile = getPcConfiguratorProfile(config);
  const update = (candidate: unknown) => {
    const validated = validateMiraInteraction(candidate);
    if (validated) onChange(validated);
  };

  return (
    <section
      className="mt-3 grid min-w-0 gap-3 rounded-2xl border border-primary/25 bg-card/80 p-3 text-foreground sm:p-4"
      aria-label="Interaktives PC-Leistungsprofil"
    >
      <header className="grid gap-1">
        <h3 className="text-sm font-semibold">PC-Leistungsprofil</h3>
        <p className="text-xs text-muted-foreground">
          Lokale Konfiguration · Profil {profile.version}
        </p>
      </header>

      <label className="grid min-w-0 gap-2 text-xs font-medium">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>Budgetgrenze (dein Wunschrahmen)</span>
          <output>{config.budget.toLocaleString("de-DE")} €</output>
        </span>
        <input
          type="range"
          aria-label="Budgetgrenze in Euro"
          aria-valuetext={`${config.budget} Euro`}
          min={PC_CONFIGURATOR_MIN_BUDGET}
          max={PC_CONFIGURATOR_MAX_BUDGET}
          step={PC_CONFIGURATOR_BUDGET_STEP}
          value={config.budget}
          onChange={(event) => update({ ...config, budget: Number(event.currentTarget.value) })}
          className="min-h-11 w-full accent-primary"
        />
      </label>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
          <span>Auflösung</span>
          <select
            aria-label="Zielauflösung"
            className="min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
            value={config.resolution}
            onChange={(event) => update({ ...config, resolution: event.currentTarget.value })}
          >
            <option value="1080p">1080p</option>
            <option value="1440p">1440p</option>
            <option value="4k">4K</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
          <span>Priorität</span>
          <select
            aria-label="Leistungspriorität"
            className="min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
            value={config.priority}
            onChange={(event) => update({ ...config, priority: event.currentTarget.value })}
          >
            <option value="fps">Möglichst viele FPS</option>
            <option value="quiet">Möglichst leiser Betrieb</option>
          </select>
        </label>
      </div>

      <div
        className="grid min-w-0 gap-2 rounded-xl border border-border/70 bg-background/70 p-3 text-xs leading-relaxed"
        role="status"
        aria-live="polite"
        aria-label="Aktualisiertes Leistungsprofil"
      >
        <p className="font-semibold">
          {config.resolution.toUpperCase()} ·{" "}
          {config.priority === "fps" ? "FPS-Fokus" : "Leise-Fokus"}
        </p>
        <p>{profile.budgetGuidance}</p>
        <p>{profile.resolutionGuidance}</p>
        <p>{profile.priorityGuidance}</p>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Preis und Verfügbarkeit nicht geprüft. Keine Händlerabfrage, konkrete SKU- oder
        Kompatibilitätsprüfung. Änderungen werden im Mira-Verlauf gespeichert und lösen keine
        weitere Mira-Anfrage aus.
      </p>
    </section>
  );
}
