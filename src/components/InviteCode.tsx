import { useEffect, useState } from "react";

/** A bearer invitation is copied only on the user's explicit button press. */
export function InviteCode({ code, label }: { code: string; label: string }) {
  const [status, setStatus] = useState("");
  useEffect(() => setStatus(""), [code]);

  async function copyCode() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
      setStatus("Code kopiert.");
    } catch {
      setStatus("Bitte den Code markieren und kopieren.");
    }
  }

  return (
    <div className="min-w-0" role="group" aria-label={label}>
      <code className="block min-w-0 break-words font-mono text-base font-semibold tracking-wider text-foreground select-all">
        {code.match(/.{1,4}/g)?.join(" ") ?? code}
      </code>
      <button
        type="button"
        onClick={() => void copyCode()}
        aria-label={`${label} kopieren`}
        className="mt-3 min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
      >
        Code kopieren
      </button>
      <p
        className="mt-1 min-h-4 text-xs tracking-normal text-muted-foreground normal-case"
        role="status"
      >
        {status}
      </p>
    </div>
  );
}
