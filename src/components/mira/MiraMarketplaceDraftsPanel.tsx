import { useEffect, useState } from "react";
import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import {
  listMiraMarketplaceDrafts,
  removeMiraMarketplaceDraft,
  type MiraMarketplaceDraftSummary,
} from "@/lib/mira-marketplace-drafts";

type Props = Readonly<{
  userId: string;
  onOpenSession: (sessionId: string) => void;
}>;

export function MiraMarketplaceDraftsPanel({ userId, onOpenSession }: Props) {
  const [drafts, setDrafts] = useState<MiraMarketplaceDraftSummary[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(listMiraMarketplaceDrafts(userId));
    setConfirmingId(null);
  }, [userId]);

  const remove = (sessionId: string) => {
    removeMiraMarketplaceDraft(userId, sessionId);
    setDrafts((items) => items.filter((entry) => entry.sessionId !== sessionId));
    setConfirmingId(null);
  };

  return (
    <section
      className="mt-3 rounded-2xl border border-border bg-card/80 p-3"
      aria-label="Meine App-Entwürfe"
    >
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Meine App-Entwürfe
      </div>
      {drafts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine App-Entwürfe. Frage Mira nach einer eigenen Alo-App — dein Entwurf bleibt
          dauerhaft gespeichert und nur für dich sichtbar.
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {drafts.map((draft) => (
            <li
              key={draft.sessionId}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-secondary/50"
            >
              <MarketplaceIcon icon={draft.icon} className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{draft.name}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {new Date(draft.updatedAt).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {draft.providerLabel ? ` · ${draft.providerLabel}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onOpenSession(draft.sessionId)}
                className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-primary"
              >
                Öffnen
              </button>
              {confirmingId === draft.sessionId ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => remove(draft.sessionId)}
                    aria-label={`${draft.name} endgültig löschen`}
                    className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-semibold text-destructive-foreground"
                  >
                    Löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg border border-border px-2 py-1 text-[10px]"
                  >
                    Abbrechen
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(draft.sessionId)}
                  aria-label={`${draft.name} löschen`}
                  className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground"
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Entwürfe sind nur für dich sichtbar. Veröffentlichen im Marketplace bleibt admin-geprüft.
      </p>
    </section>
  );
}
