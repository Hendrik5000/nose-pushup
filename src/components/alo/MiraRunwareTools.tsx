import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MiraRunwareResult } from "@/components/alo/MiraRunwareResult";
import { ContentActions } from "@/components/alo/ContentActions";
import { putAlo } from "@/lib/alo-store";
import { getRunwareStatus, runMiraRunware, streamMiraRunware } from "@/lib/runware.functions";
import {
  RUNWARE_CAPABILITIES,
  RUNWARE_MODELS,
  RUNWARE_COST_LIMIT_AVAILABLE,
  RUNWARE_COST_LIMIT_REASON,
  RUNWARE_TEXT_STREAMING_AVAILABLE,
  RUNWARE_TEXT_STREAMING_REASON,
  type RunwareCapability,
  type RunwareResult,
} from "@/lib/runware";
import { readRunwareImage, runwareCostLabel, readRunwareStream } from "@/lib/runware-client";

type Status = { available: boolean; reason: string };

/** Optional tools, not a replacement for Mira's general-purpose conversation. No BYOK field. */
export function MiraRunwareTools({
  open,
  onOpenChange,
  userId,
  onKeepInChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onKeepInChat: (result: RunwareResult) => void;
}) {
  const getStatus = useServerFn(getRunwareStatus);
  const run = useServerFn(runMiraRunware);
  const stream = useServerFn(streamMiraRunware);
  const abortRef = useRef<AbortController | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [capability, setCapability] = useState<RunwareCapability>(RUNWARE_CAPABILITIES[0].id);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string>();
  const [imageName, setImageName] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<RunwareResult[]>([]);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const fileRead = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      fileRead.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setStatus(null);
    void getStatus()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active)
          setStatus({
            available: false,
            reason:
              "Serverstatus nicht verfügbar. Anmeldung und sichere Serverkonfiguration prüfen. Es wurde kein Runware-Auftrag gestartet.",
          });
      });
    return () => {
      active = false;
    };
  }, [open, getStatus]);
  const selected = RUNWARE_CAPABILITIES.find((item) => item.id === capability)!;
  const models = RUNWARE_MODELS.filter((item) => item.capability === capability);
  const chosenModel = models.find((item) => item.id === model) ?? models[0];
  const changeCapability = (next: RunwareCapability) => {
    fileRead.current += 1;
    setCapability(next);
    setModel("");
    setImage(undefined);
    setImageName("");
    setReview(false);
    setError("");
  };
  const chooseImage = async (file?: File) => {
    const generation = ++fileRead.current;
    setReview(false);
    setImage(undefined);
    setImageName("");
    setError("");
    if (!file) return;
    try {
      const data = await readRunwareImage(file);
      if (generation !== fileRead.current || !mounted.current) return;
      setImage(data);
      setImageName(file.name);
    } catch (err) {
      if (generation === fileRead.current)
        setError(err instanceof Error ? err.message : "Bild nicht lesbar.");
    }
  };
  const execute = async () => {
    if (busyRef.current || uncertain || !review || !status?.available || !chosenModel) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;
    const request = {
      capability,
      model: chosenModel.id,
      prompt: prompt.trim(),
      ...(image ? { inputImage: image } : {}),
      confirmed: true as const,
      requestId: crypto.randomUUID(),
    };
    try {
      let result: RunwareResult;
      if (request.capability === "text" && RUNWARE_TEXT_STREAMING_AVAILABLE) {
        const response = await stream({ data: request, signal: controller.signal });
        let completed: RunwareResult | undefined;
        await readRunwareStream(
          response,
          (raw) => {
            if (!raw || typeof raw !== "object") throw new Error("Ungültiger Textstream.");
            const event = raw as {
              type?: string;
              text?: string;
              result?: RunwareResult;
              message?: string;
            };
            if (event.type === "error") throw new Error("Textstream nicht abgeschlossen.");
            if (event.type === "delta" && typeof event.text === "string" && mounted.current)
              setStreamingText((old) => (old + event.text).slice(0, 100_000));
            if (event.type === "result" && event.result?.id === request.requestId)
              completed = event.result;
          },
          controller.signal,
        );
        if (!completed) throw new Error("Textstream unvollständig.");
        result = completed;
      } else {
        result = await run({ data: request, signal: controller.signal });
      }
      if (mounted.current) {
        setResults((old) => [result, ...old].slice(0, 10));
        setReview(false);
      }
    } catch {
      if (mounted.current) {
        setReview(false);
        setUncertain(true);
        setError(
          "Kein Ergebnis erhalten. Der Auftrag kann bereits gestartet sein. Nicht blind wiederholen; zuerst im Runware-Dashboard prüfen. Es erfolgt kein automatischer Neuversuch.",
        );
      }
    } finally {
      abortRef.current = null;
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const save = (result: RunwareResult) => {
    if (!userId) return;
    try {
      putAlo(
        "capture",
        {
          title: `Mira · ${RUNWARE_CAPABILITIES.find((item) => item.id === result.capability)?.label ?? "Runware"}`,
          text: result.text ?? result.url ?? "",
          area: "mira",
          source: "Mira",
          runware: result,
        },
        `runware:${result.id}`,
        userId,
      );
      setNotice(
        "In der Alo-Ablage gespeichert. Medienlinks ersetzen keinen dauerhaften Datei-Download.",
      );
    } catch {
      setError("Nicht gespeichert. Bitte den Gerätespeicher prüfen.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="alo-dialog mira-runware-dialog">
        <DialogTitle>Mira erweitern · Runware</DialogTitle>
        <DialogDescription>
          Optionale Text- und Medienwerkzeuge. Mira bleibt deine allgemeine Assistentin; dein
          normaler Chat-Anbieter wird nicht umgestellt.
        </DialogDescription>
        <p role="status" className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
          {status
            ? status.available
              ? "Sicherer Serverzugang bereit. Jeder Lauf benötigt deine Freigabe."
              : `Nicht eingerichtet / nicht verfügbar: ${status.reason}`
            : "Sicheren Serverzugang prüfen …"}
        </p>
        {!status?.available && (
          <details className="text-sm">
            <summary className="cursor-pointer py-2 font-semibold">Sichere Einrichtung</summary>
            <p className="mt-2 text-muted-foreground">
              Im Hosting-Secret-Store einen separaten, widerrufbaren Projektschlüssel als
              RUNWARE_API_KEY setzen und berechtigte Konto-IDs über RUNWARE_ALLOWED_USER_IDS
              freigeben. Der vorhandene authentifizierte App-Server muss laufen. Keine
              Datenbankmigration nötig. Niemals VITE_-Variablen oder Browser-Speicher für den
              Schlüssel verwenden.
            </p>
          </details>
        )}
        {!RUNWARE_COST_LIMIT_AVAILABLE && (
          <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
            {RUNWARE_COST_LIMIT_REASON}
          </p>
        )}
        {capability === "text" && !RUNWARE_TEXT_STREAMING_AVAILABLE && (
          <p className="text-xs text-muted-foreground">{RUNWARE_TEXT_STREAMING_REASON}</p>
        )}
        <fieldset disabled={busy} className="min-w-0 space-y-3">
          <label className="block text-sm font-semibold">
            Fähigkeit
            <select
              className="mt-1 w-full min-w-0 rounded-xl border border-border bg-background p-3 text-base"
              value={capability}
              onChange={(e) => changeCapability(e.target.value as RunwareCapability)}
            >
              {RUNWARE_CAPABILITIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{selected.description}</p>
          <label className="block text-sm font-semibold">
            Modell
            <select
              className="mt-1 w-full min-w-0 rounded-xl border border-border bg-background p-3 text-base"
              value={chosenModel?.id ?? ""}
              onChange={(e) => {
                setModel(e.target.value);
                setReview(false);
              }}
              disabled={!models.length}
            >
              {!models.length && <option value="">Noch kein sicher geprüfter Modellweg</option>}
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {capability === "image-upscale"
              ? "Auftragsnotiz (wird nicht ans Upscaling-Modell gesendet)"
              : "Dein Auftrag"}
            <textarea
              value={prompt}
              maxLength={4000}
              rows={3}
              onChange={(e) => {
                setPrompt(e.target.value);
                setReview(false);
              }}
              placeholder="Was soll Mira für dich erstellen oder untersuchen?"
              className="mt-1 w-full resize-y rounded-xl border border-border bg-background p-3 text-base font-normal"
            />
          </label>
          {"inputImage" in selected && selected.inputImage && (
            <label className="block text-sm font-semibold">
              Eigenes Bild · PNG, JPEG, WebP, höchstens 1 MB
              <input
                key={capability}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-2 block w-full min-w-0 text-sm"
                onChange={(e) => void chooseImage(e.target.files?.[0])}
              />
              {imageName && (
                <span className="mt-1 block break-all text-xs font-normal">
                  Ausgewählt: {imageName}
                </span>
              )}
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Es werden nur dieser Auftrag und gegebenenfalls dein ausgewähltes Bild an Runware
            übertragen. Kein automatischer Zugriff auf Training, Gesundheit oder Nexus. Nur eigene
            oder zur Nutzung freigegebene Inhalte hochladen.
          </p>
          {!review && (
            <button
              type="button"
              className="alo-btn-primary w-full"
              disabled={
                !chosenModel ||
                !prompt.trim() ||
                (!!("inputImage" in selected && selected.inputImage) && !image)
              }
              onClick={() => setReview(true)}
            >
              Auftrag & Kosten prüfen
            </button>
          )}
        </fieldset>
        {image && (
          <img
            src={image}
            alt="Ausgewähltes Referenzbild"
            className="max-h-40 w-full rounded-xl object-contain"
          />
        )}
        {review && (
          <section
            aria-label="Kostenfreigabe"
            className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm"
          >
            <h3 className="font-bold">Vor dem kostenpflichtigen Lauf</h3>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-background/60 p-2">
              {prompt.trim()}
            </p>
            {imageName && <p className="break-all">Referenzbild: {imageName}</p>}
            <dl className="space-y-1 break-words">
              <div>
                <dt className="inline font-semibold">Modell: </dt>
                <dd className="inline">
                  {chosenModel?.label} ({chosenModel?.id})
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Aufwand: </dt>
                <dd className="inline">{selected.effort}</dd>
              </div>
            </dl>
            <p className="break-words">
              <strong>Parameter / Anzahl:</strong> {chosenModel?.parameters}
            </p>
            <p>
              <strong>Kostenschätzung: nicht verfügbar.</strong> Der Betrag hängt von Modell und
              Parametern ab. Dies ist kein kostenloser Probelauf und keine Preisobergrenze.
              Ist-Kosten werden nach dem Lauf angezeigt, soweit Runware sie meldet.
            </p>
            <p>
              Abbrechen vor dem Start kostet nichts. Nach dem Start kann ein Schließen oder
              Verbindungsabbruch die Berechnung nicht zuverlässig stoppen.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="alo-btn"
                onClick={() => setReview(false)}
              >
                Abbrechen · nicht starten
              </button>
              <button
                type="button"
                disabled={busy || uncertain || !status?.available}
                className="alo-btn-primary"
                onClick={() => void execute()}
              >
                {busy ? "Auftrag läuft …" : "Kostenpflichtig starten · Preis nur nach Freigabe"}
              </button>
            </div>
          </section>
        )}
        {busy && (
          <div role="status" className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap break-words">
              {streamingText || "Mira wartet auf Runware …"}
            </p>
            <button
              type="button"
              className="alo-btn"
              onClick={() => {
                abortRef.current?.abort();
                setNotice(
                  "Warten abgebrochen. Eine gestartete Aufgabe kann weiterlaufen und Kosten verursachen.",
                );
              }}
            >
              Warten abbrechen (Auftrag kann weiterlaufen)
            </button>
          </div>
        )}
        {uncertain && (
          <div className="space-y-2 text-sm">
            <p>Vor einem neuen Lauf den bisherigen Auftrag im Runware-Dashboard prüfen.</p>
            <button
              type="button"
              className="alo-btn"
              onClick={() => {
                setUncertain(false);
                setReview(false);
                setError("");
              }}
            >
              Auftrag geprüft · neuen Lauf vorbereiten
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {!!results.length && (
          <section aria-label="Runware-Ergebnisse" className="space-y-4">
            <h3 className="font-bold">Ergebnisse</h3>
            {results.map((result) => (
              <article key={result.id} className="space-y-3 rounded-xl border border-border p-3">
                <p className="break-all text-xs text-muted-foreground">
                  {result.model} · {runwareCostLabel(result.cost)}
                </p>
                {result.text && (
                  <p className="whitespace-pre-wrap break-words text-sm">{result.text}</p>
                )}
                <MiraRunwareResult result={result} />
                {userId && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary"
                      onClick={() => {
                        onKeepInChat(result);
                        setNotice("Ergebnis in den aktuell geöffneten Mira-Verlauf übernommen.");
                      }}
                    >
                      Im aktuellen Mira-Verlauf behalten
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary"
                      onClick={() => save(result)}
                    >
                      In Alo-Ablage speichern
                    </button>
                    <ContentActions
                      userId={userId}
                      source="Mira"
                      title={`Mira · ${result.model}`}
                      text={result.text ?? result.url ?? ""}
                    />
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
        <p className="text-xs text-muted-foreground">
          Video-Generierung ist hier nicht verfügbar. Ergebnisse bleiben bis zum Verlassen der
          Mira-Seite in dieser Ansicht; wichtige Ergebnisse ausdrücklich speichern.
        </p>
      </DialogContent>
    </Dialog>
  );
}
