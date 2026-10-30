import { useCallback, useEffect, useState } from "react";
import {
  describeFriendCodeProblem,
  FRIEND_CODE_PROBLEM_TEXT,
  formatFriendCode,
  formatFriendCodeInput,
} from "@/lib/friends/friend-code";
import { friendsClient } from "@/lib/friends/supabase-friends";
import { BackendNotReadyError, RegisteredAccountRequiredError } from "@/lib/friends/rpc";

function errorText(error: unknown): string {
  if (error instanceof BackendNotReadyError) {
    return "Freundescodes sind auf dem Server noch nicht eingerichtet.";
  }
  if (error instanceof RegisteredAccountRequiredError) {
    return "Für Freunde brauchst du ein registriertes Konto (kein Gastzugang).";
  }
  return "Das hat nicht geklappt. Versuche es erneut.";
}

/** My friend code (copy, share, renew) and the form to invite a friend by entering their code. */
export function FriendCodeCard({ onSent }: { onSent?: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState<"send" | "renew" | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const loadCode = useCallback(async () => {
    try {
      setCode(await friendsClient.getMyCode());
      setCodeError(null);
    } catch (error) {
      setCodeError(errorText(error));
    }
  }, []);

  useEffect(() => {
    void loadCode();
  }, [loadCode]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(formatFriendCode(code));
      setFeedback({ ok: true, text: "Code kopiert." });
    } catch {
      setFeedback({
        ok: false,
        text: "Kopieren nicht möglich. Markiere den Code und kopiere ihn von Hand.",
      });
    }
  };

  const share = async () => {
    if (!code) return;
    const text = `Füge mich in Alo als Freund hinzu. Mein Freundescode: ${formatFriendCode(code)}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
      } catch {
        // Cancelled by the user.
      }
    } else {
      await copy();
    }
  };

  const renew = async () => {
    setBusy("renew");
    try {
      setCode(await friendsClient.regenerateMyCode());
      setFeedback({ ok: true, text: "Neuer Code erzeugt. Der alte Code funktioniert nicht mehr." });
    } catch (error) {
      setFeedback({ ok: false, text: errorText(error) });
    } finally {
      setConfirmRenew(false);
      setBusy(null);
    }
  };

  const send = async () => {
    const problem = describeFriendCodeProblem(entry);
    if (problem) {
      setFeedback({ ok: false, text: FRIEND_CODE_PROBLEM_TEXT[problem] });
      return;
    }
    setBusy("send");
    setFeedback(null);
    try {
      const result = await friendsClient.sendRequestByCode(entry);
      setFeedback({ ok: result.ok, text: result.message });
      if (result.ok) {
        setEntry("");
        onSent?.();
      }
    } catch (error) {
      setFeedback({ ok: false, text: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="my-friend-code-title"
        className="rounded-2xl border border-border bg-card/40 p-4"
      >
        <h3
          id="my-friend-code-title"
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          Dein Freundescode
        </h3>
        {codeError ? (
          <p role="alert" className="mt-2 text-xs text-muted-foreground">
            {codeError}
          </p>
        ) : (
          <>
            <p
              aria-live="polite"
              className="mt-2 select-all text-center font-mono text-3xl font-semibold tracking-[0.25em]"
              data-testid="my-friend-code"
            >
              {code ? formatFriendCode(code) : "…"}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold uppercase tracking-[0.15em]">
              <button
                type="button"
                onClick={() => void copy()}
                disabled={!code}
                className="min-h-11 rounded-xl border border-border disabled:opacity-50"
              >
                Kopieren
              </button>
              <button
                type="button"
                onClick={() => void share()}
                disabled={!code}
                className="min-h-11 rounded-xl border border-border disabled:opacity-50"
              >
                Teilen
              </button>
              {confirmRenew ? (
                <button
                  type="button"
                  onClick={() => void renew()}
                  disabled={busy !== null}
                  className="min-h-11 rounded-xl bg-destructive text-destructive-foreground disabled:opacity-50"
                >
                  {busy === "renew" ? "…" : "Sicher?"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRenew(true)}
                  disabled={!code}
                  className="min-h-11 rounded-xl border border-border disabled:opacity-50"
                >
                  Erneuern
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Gib den Code an Freunde weiter. Eine Einladung wird erst zur Freundschaft, wenn sie im
              Postfach angenommen wird.
            </p>
          </>
        )}
      </section>

      <section
        aria-labelledby="enter-friend-code-title"
        className="rounded-2xl border border-border bg-card/40 p-4"
      >
        <h3
          id="enter-friend-code-title"
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          Freund hinzufügen
        </h3>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <input
            value={entry}
            onChange={(event) => setEntry(formatFriendCodeInput(event.currentTarget.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Freundescode des Freundes"
            placeholder="XXXX-XXXX"
            maxLength={9}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-center font-mono text-lg tracking-[0.2em] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="min-h-11 rounded-xl bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground transition active:scale-95 disabled:opacity-50"
          >
            {busy === "send" ? "Sende…" : "Einladen"}
          </button>
        </form>
        {feedback && (
          <p
            role={feedback.ok ? "status" : "alert"}
            className={`mt-2 text-xs ${feedback.ok ? "text-muted-foreground" : "text-destructive"}`}
          >
            {feedback.text}
          </p>
        )}
      </section>
    </div>
  );
}
