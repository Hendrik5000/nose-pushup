import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { publishFeatureReleaseDigest } from "@/lib/marketplace.functions";
import {
  FEATURE_RELEASE_BODY_MAX,
  FEATURE_RELEASE_KEY_PATTERN,
  FEATURE_RELEASE_TITLE_MAX,
  isSafeFeatureDigestText,
} from "@/lib/feature-release-digest";

export function FeatureReleaseDigestPanel() {
  const publishDigest = useServerFn(publishFeatureReleaseDigest);
  const [releaseKey, setReleaseKey] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const prepareConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!FEATURE_RELEASE_KEY_PATTERN.test(releaseKey)) {
      setError(
        "Verwende eine eindeutige Release-Kennung in Kleinbuchstaben, zum Beispiel 2026-11-mira.",
      );
      return;
    }
    if (!isSafeFeatureDigestText(title, FEATURE_RELEASE_TITLE_MAX)) {
      setError("Der Titel muss 1–72 Zeichen umfassen und darf keine Links oder HTML enthalten.");
      return;
    }
    if (!isSafeFeatureDigestText(body, FEATURE_RELEASE_BODY_MAX)) {
      setError("Der Text muss 1–320 Zeichen umfassen und darf keine Links oder HTML enthalten.");
      return;
    }
    setConfirmOpen(true);
  };

  const sendDigest = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    setStatus("");
    try {
      const result = await publishDigest({
        data: { releaseKey, title, body, confirmed: true as const },
      });
      if (!result.wasCreated) {
        setStatus(
          "Diese Release-Kennung wurde bereits verarbeitet; es wurde nichts erneut eingereiht.",
        );
      } else if (result.recipientCount === 0) {
        setStatus("Der Digest wurde gespeichert, aber es gab keine registrierten Konten.");
      } else {
        setStatus(`Ein Digest wurde für ${result.recipientCount} Konten ins Postfach eingereiht.`);
        setReleaseKey("");
        setTitle("");
        setBody("");
      }
      setConfirmOpen(false);
    } catch {
      setError(
        "Digest konnte nicht eingereiht werden. Prüfe die Release-Kennung und Admin-Berechtigung.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-labelledby="feature-release-digest-title"
      className="rounded-3xl border border-border bg-card/45 p-5 sm:p-7"
    >
      <h2 id="feature-release-digest-title" className="text-lg font-semibold">
        Feature-Digest ins Postfach
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Ein kurzer Eintrag pro aktuell registriertem, nicht anonymem Konto. Es werden keine E-Mails
        oder Push-Mitteilungen versandt. Dieselbe Release-Kennung kann nur einmal zugestellt werden.
      </p>

      <form className="mt-5 space-y-4" onSubmit={prepareConfirmation}>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="feature-digest-release-key">
            Eindeutige Release-Kennung
          </label>
          <input
            id="feature-digest-release-key"
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground"
            maxLength={64}
            onChange={(event) => {
              setReleaseKey(event.target.value.toLowerCase());
              setConfirmOpen(false);
            }}
            placeholder="2026-11-mira"
            required
            value={releaseKey}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="feature-digest-title">
            Titel
          </label>
          <input
            id="feature-digest-title"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground"
            maxLength={FEATURE_RELEASE_TITLE_MAX}
            onChange={(event) => {
              setTitle(event.target.value);
              setConfirmOpen(false);
            }}
            required
            value={title}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="feature-digest-body">
            Kurzer Überblick
          </label>
          <textarea
            id="feature-digest-body"
            className="min-h-28 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-base leading-6 text-foreground"
            maxLength={FEATURE_RELEASE_BODY_MAX}
            onChange={(event) => {
              setBody(event.target.value.replace(/[\r\n]+/gu, " "));
              setConfirmOpen(false);
            }}
            required
            value={body}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Ein Absatz, ohne HTML oder Links; höchstens 320 Zeichen.
          </p>
        </div>

        <button className="alo-btn min-h-11 w-full sm:w-auto" type="submit">
          Vorschau und Bestätigung
        </button>
      </form>

      {error && !confirmOpen && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="mt-4 text-sm text-foreground" role="status" aria-live="polite">
          {status}
        </p>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Digest an alle Postfächer einreihen?</AlertDialogTitle>
            <AlertDialogDescription>
              Ein Eintrag pro aktuell registriertem, nicht anonymem Konto. Keine E-Mail- oder
              Push-Mitteilung. Für diese Release-Kennung wird höchstens einmal zugestellt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
          <div className="space-y-2 rounded-xl border border-border bg-card/60 p-3 text-sm">
            <p className="break-all text-xs text-muted-foreground">Release: {releaseKey}</p>
            <p className="font-semibold text-foreground">{title.trim()}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{body.trim()}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={pending}>
              Zurück
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void sendDigest();
              }}
            >
              {pending ? "Wird eingereiht …" : "Jetzt einreihen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
