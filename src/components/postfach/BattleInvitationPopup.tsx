import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeBattleSettings, type PostfachItem } from "@/lib/friends/postfach";

const MODE_LABELS: Record<string, string> = {
  timed: "Zeitduell",
  first_to: "Erster auf Ziel",
  sprint: "Sprint",
  endurance: "Ausdauer",
};

/** Modal popup for an incoming Liegestütz-Battle: Annehmen, Ablehnen or later in the Postfach. */
export function BattleInvitationPopup({
  item,
  onAnswer,
  onLater,
}: {
  item: PostfachItem | null;
  onAnswer: (accept: boolean) => Promise<string>;
  onLater: () => void;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    setBusy(null);
  }, [item?.id]);

  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? "accept" : "decline");
    try {
      const message = await onAnswer(accept);
      if (message) toast(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onLater();
      }}
    >
      <DialogContent className="max-w-sm" data-no-module-swipe>
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>Battle-Einladung</DialogTitle>
              <DialogDescription>
                {item.fromName} fordert dich zu einem Liegestütz-Battle heraus.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {MODE_LABELS[item.mode ?? ""] ?? "Battle"}
              {describeBattleSettings(item)}
              {item.expiresAt && (
                <>
                  {" "}
                  · gültig bis{" "}
                  <time dateTime={item.expiresAt}>
                    {new Date(item.expiresAt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void answer(true)}
                className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === "accept" ? "Prüfe…" : "Annehmen"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void answer(false)}
                className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
              >
                Ablehnen
              </button>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={onLater}
              className="min-h-11 w-full rounded-xl px-3 text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              Später im Postfach ansehen
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
