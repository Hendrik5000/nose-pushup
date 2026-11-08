import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  clearHomeAppName,
  EMPTY_HOME_APP_CUSTOMIZATION,
  HOME_BACKGROUND_PRESETS,
  moveHomeApp,
  orderHomeAppIds,
  setHomeAppName,
  setHomeBackground,
  type HomeAppCustomizationSettings,
} from "@/lib/home-app-customization";

type HomeAppForCustomization = Readonly<{ id: string; title: string }>;

type HomeAppCustomizationDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apps: readonly HomeAppForCustomization[];
  settings: HomeAppCustomizationSettings;
  onSave: (settings: HomeAppCustomizationSettings) => boolean;
}>;

export function HomeAppCustomizationDialog({
  open,
  onOpenChange,
  apps,
  settings,
  onSave,
}: HomeAppCustomizationDialogProps) {
  const [draft, setDraft] = useState(settings);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const appIds = apps.map(({ id }) => id);
  const orderedApps = orderHomeAppIds(appIds, draft.order)
    .map((id) => apps.find((app) => app.id === id))
    .filter((app): app is HomeAppForCustomization => Boolean(app));

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    setDraftNames(
      Object.fromEntries(apps.map((app) => [app.id, settings.nameOverrides[app.id] ?? app.title])),
    );
    setError(null);
  }, [apps, open, settings]);

  const handleMove = (appId: string, direction: -1 | 1) => {
    try {
      setDraft((current) => moveHomeApp(current, appIds, appId, direction));
    } catch {
      setError("Die Reihenfolge konnte nicht geändert werden.");
    }
  };

  const handleSave = () => {
    try {
      let next = { ...draft, order: orderHomeAppIds(appIds, draft.order) };
      for (const app of apps) {
        const name = draftNames[app.id] ?? app.title;
        next =
          name.trim() === app.title
            ? clearHomeAppName(next, app.id)
            : setHomeAppName(next, app.id, name);
      }
      const background = setHomeBackground(next, draft.background);
      if (onSave(background)) onOpenChange(false);
      else
        setError(
          "Die Änderungen konnten nicht lokal gespeichert werden. Bitte prüfe den Gerätespeicher und versuche es erneut.",
        );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Die Home-Einstellungen sind ungültig.",
      );
    }
  };

  const handleReset = () => {
    setDraft(EMPTY_HOME_APP_CUSTOMIZATION);
    setDraftNames(Object.fromEntries(apps.map((app) => [app.id, app.title])));
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(86dvh,48rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle>Startseite anpassen</DialogTitle>
          <DialogDescription>
            Sortiere und benenne deine Alo-Apps um oder wähle einen Hintergrund. Die Änderungen
            bleiben lokal auf diesem Konto und Gerät.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">App-Reihenfolge und Namen</legend>
          {orderedApps.map((app, index) => (
            <div
              key={app.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl border border-border/70 bg-card/50 p-3"
            >
              <label
                className="min-w-0 space-y-1.5 text-sm font-medium"
                htmlFor={`home-app-name-${app.id}`}
              >
                <span className="block truncate">{app.title}</span>
                <input
                  id={`home-app-name-${app.id}`}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  maxLength={48}
                  autoComplete="off"
                  value={draftNames[app.id] ?? app.title}
                  onChange={(event) =>
                    setDraftNames((current) => ({ ...current, [app.id]: event.target.value }))
                  }
                />
              </label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label={`${app.title} nach oben verschieben`}
                  title="Nach oben"
                  disabled={index === 0}
                  onClick={() => handleMove(app.id, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label={`${app.title} nach unten verschieben`}
                  title="Nach unten"
                  disabled={index === orderedApps.length - 1}
                  onClick={() => handleMove(app.id, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </fieldset>

        <label className="space-y-2 text-sm font-semibold" htmlFor="home-background-choice">
          <span className="block">Hintergrund</span>
          <select
            id="home-background-choice"
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.background}
            onChange={(event) =>
              setDraft((current) => setHomeBackground(current, event.target.value))
            }
          >
            <option value="none">Standard</option>
            {HOME_BACKGROUND_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Eigene veröffentlichte Apps und Marketplace-Verwaltung sind hiervon getrennt und werden
          nicht verändert.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-11 justify-start sm:mr-auto"
            onClick={handleReset}
          >
            <RotateCcw aria-hidden="true" /> Zurücksetzen
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button type="button" className="h-11" onClick={handleSave}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
