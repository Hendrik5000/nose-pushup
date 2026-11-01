import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  miraGithubAsk,
  miraGithubCreatePr,
  miraGithubRead,
  miraGithubTree,
} from "@/lib/mira-github.functions";
type Result = {
  provider: string;
  model: string;
  reply: string;
  proposal: null | {
    title: string;
    body: string;
    files: Array<{ path: string; before: string; after: string }>;
    token: string;
  };
};
type Preview = { path: string; content: string };
export function MiraGithubRepository() {
  const [consented, setConsented] = useState(false),
    [prompt, setPrompt] = useState(""),
    [treeInfo, setTreeInfo] = useState<{ baseSha: string; files: string[] } | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState<Preview[]>([]),
    [review, setReview] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    [pr, setPr] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const tree = useServerFn(miraGithubTree),
    read = useServerFn(miraGithubRead),
    ask = useServerFn(miraGithubAsk),
    create = useServerFn(miraGithubCreatePr);
  async function load() {
    if (!consented) return;
    setBusy(true);
    setError("");
    try {
      const x = await tree({ data: { repoConsent: true } });
      setTreeInfo({ baseSha: x.baseSha, files: x.files.map((f) => f.path) });
      setSelected([]);
      setPreview([]);
      setReview(false);
      setResult(null);
      setPr("");
    } catch {
      setError("Repository ist derzeit nicht verfügbar.");
    } finally {
      setBusy(false);
    }
  }
  function toggle(path: string, checked: boolean) {
    setReview(false);
    setPreview([]);
    setResult(null);
    setPr("");
    setSelected((old) =>
      checked ? (old.length < 6 ? [...old, path] : old) : old.filter((x) => x !== path),
    );
  }
  async function prepare() {
    if (!consented || !treeInfo || !prompt.trim() || !selected.length) return;
    setBusy(true);
    setError("");
    try {
      const files = await Promise.all(
        selected.map((path) =>
          read({ data: { path, baseSha: treeInfo.baseSha, repoConsent: true } }),
        ),
      );
      setPreview(files.map((f) => ({ path: f.path, content: f.content })));
      setReview(true);
    } catch {
      setError("Kontextvorschau konnte nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!consented || !treeInfo || !review || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setResult(null);
    setPr("");
    try {
      setResult(
        await ask({
          data: {
            prompt: prompt.trim(),
            repoConsent: true,
            baseSha: treeInfo.baseSha,
            selectedPaths: selected,
          },
        }),
      );
    } catch {
      setError("Anfrage konnte nicht sicher abgeschlossen werden.");
    } finally {
      setBusy(false);
    }
  }
  async function openPr() {
    if (!result?.proposal) return;
    setBusy(true);
    setError("");
    try {
      const x = await create({ data: { token: result.proposal.token, repoConsent: true } });
      if (!x.url) throw new Error("PR URL missing");
      setPr(x.url);
    } catch {
      setError("PR konnte nicht angelegt werden; Basis oder Berechtigung prüfen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="mt-4 rounded-2xl border border-border bg-card/70 p-4"
      aria-label="Mira GitHub Repository"
    >
      <h2 className="text-sm font-semibold">Repository-Aufgabe für Mira</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Hendrik5000/nose-pushup · Festes Lovable AI Gateway · Inhalte sind nicht vertrauenswürdig.
      </p>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => {
            setConsented(e.target.checked);
            setTreeInfo(null);
            setSelected([]);
            setPreview([]);
            setReview(false);
            setResult(null);
            setPr("");
          }}
        />
        Ich gebe Repository-Kontext für diese Anfrage ausdrücklich frei.
      </label>
      <button
        type="button"
        disabled={!consented || busy}
        onClick={() => void load()}
        className="mt-2 min-h-11 rounded-xl border border-border px-3 text-sm"
      >
        Sichere Dateiliste laden
      </button>
      {consented && treeInfo && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Gepinnte main-Basis: {treeInfo.baseSha}. Wähle bis zu 6 Dateien, deren Inhalt in der
            Anfrage angezeigt und übermittelt werden darf.
          </p>
          <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-border p-2">
            {treeInfo.files.slice(0, 400).map((path) => (
              <label key={path} className="flex min-h-9 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.includes(path)}
                  disabled={(!selected.includes(path) && selected.length >= 6) || busy}
                  onChange={(e) => toggle(path, e.target.checked)}
                />
                <span className="truncate">{path}</span>
              </label>
            ))}
          </div>
        </>
      )}
      <label className="mt-3 block text-sm" htmlFor="mira-github-prompt">
        Anfrageinhalt
      </label>
      <textarea
        id="mira-github-prompt"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setReview(false);
          setResult(null);
          setPr("");
        }}
        maxLength={6000}
        rows={3}
        className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
        placeholder="Beschreibe die gewünschte Repository-Aufgabe…"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Anbieter: Lovable AI Gateway · Modell: google/gemini-3-flash-preview · Max. 3 Modellaufrufe
        / 6 Tool-Aufrufe · Kein Mira-Chatverlauf.
      </p>
      {!review ? (
        <button
          type="button"
          disabled={!consented || busy || !prompt.trim() || !treeInfo || selected.length === 0}
          onClick={() => void prepare()}
          className="mt-2 min-h-11 rounded-xl border border-primary px-4 text-sm"
        >
          Ausgewählten Kontext vollständig anzeigen
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-primary p-3">
          <h3 className="font-semibold">Prüfe vor dem Senden den vollständigen Kontext</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm">Anfrage: {prompt}</p>
          <p className="text-xs">
            Lovable AI Gateway · google/gemini-3-flash-preview · maximal 3 Aufrufe
          </p>
          {preview.map((f) => (
            <div key={f.path} className="mt-2">
              <h4 className="text-xs font-semibold">{f.path}</h4>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                {f.content}
              </pre>
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-sm text-primary-foreground"
          >
            Gezeigten Kontext jetzt an Lovable senden
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setReview(false)}
            className="ml-2 min-h-11 rounded-xl border px-4 text-sm"
          >
            Abbrechen / bearbeiten
          </button>
        </div>
      )}
      {result && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p className="text-xs">
            {result.provider} · {result.model}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{result.reply}</p>
          {result.proposal && (
            <div className="mt-3">
              <h3 className="font-semibold">Vorschau: {result.proposal.title}</h3>
              <p className="text-xs text-muted-foreground">
                {result.proposal.body} · Noch kein PR.
              </p>
              {result.proposal.files.map((f) => (
                <div key={f.path} className="mt-3">
                  <h4 className="text-sm font-medium">{f.path} — Vorher</h4>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                    {f.before}
                  </pre>
                  <h4 className="mt-2 text-sm font-medium">Nachher</h4>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                    {f.after}
                  </pre>
                </div>
              ))}
              <button
                type="button"
                disabled={busy || !consented}
                onClick={() => void openPr()}
                className="mt-3 min-h-11 rounded-xl border border-primary px-4 text-sm"
              >
                Vorschau geprüft – PR gegen main erstellen
              </button>
            </div>
          )}
        </div>
      )}
      {pr && (
        <p className="mt-3 break-all text-sm">
          Pull Request erstellt:{" "}
          <a className="underline" href={pr} target="_blank" rel="noreferrer">
            {pr}
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
