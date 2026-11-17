import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import { friendAppSharesClient } from "@/lib/friend-app-shares.supabase";
import {
  getMiraMarketplaceDraftManifest,
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
  const [sharedSessionIds, setSharedSessionIds] = useState<string[]>([]);
  const [pendingShareId, setPendingShareId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(listMiraMarketplaceDrafts(userId));
    setConfirmingId(null);
    setPendingShareId(null);
    let active = true;
    friendAppSharesClient
      .listShares()
      .then((shares) => {
        if (!active) return;
        setSharedSessionIds(
          shares.filter((share) => share.sharerId === userId).map((share) => share.sessionId),
        );
      })
      .catch(() => {
        if (active) setSharedSessionIds([]);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const remove = (sessionId: string) => {
    removeMiraMarketplaceDraft(userId, sessionId);
    setDrafts((items) => items.filter((entry) => entry.sessionId !== sessionId));
    setConfirmingId(null);
  };

  const share = async (sessionId: string) => {
    setPendingShareId(sessionId);
    try {
      const manifest = getMiraMarketplaceDraftManifest(userId, sessionId);
      if (!manifest) {
        toast.error("Entwurf konnte nicht geladen werden.");
        return;
      }
      await friendAppSharesClient.shareDraft({ sessionId, appName: manifest.name, manifest });
      setSharedSessionIds((ids) => (ids.includes(sessionId) ? ids : [...ids, sessionId]));
      toast.success("App mit deinen Freunden geteilt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Teilen fehlgeschlagen.");
    } finally {
      setPendingShareId(null);
    }
  };

  const unshare = async (sessionId: string) => {
    setPendingShareId(sessionId);
    try {
      const shares = await friendAppSharesClient.listShares();
      const share = shares.find(
        (entry) => entry.sharerId === userId && entry.sessionId === sessionId,
      );
      if (!share) {
        setSharedSessionIds((ids) => ids.filter((id) => id !== sessionId));
        return;
      }
      await friendAppSharesClient.unshare(share.id);
      setSharedSessionIds((ids) => ids.filter((id) => id !== sessionId));
      toast.success("Freigabe beendet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Freigabe konnte nicht beendet werden.");
    } finally {
      setPendingShareId(null);
    }
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
              {sharedSessionIds.includes(draft.sessionId) ? (
                <button
                  type="button"
                  disabled={pendingShareId === draft.sessionId}
                  onClick={() => void unshare(draft.sessionId)}
                  aria-label={`${draft.name} nicht mehr teilen`}
                  className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground disabled:opacity-50"
                >
                  Teilen beenden
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pendingShareId === draft.sessionId}
                  onClick={() => void share(draft.sessionId)}
                  aria-label={`${draft.name} mit Freunden teilen`}
                  className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-primary disabled:opacity-50"
                >
                  Teilen
                </button>
              )}
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
        Entwürfe sind privat, bis du sie mit deinen Freunden teilst. Veröffentlichen im Marketplace
        bleibt admin-geprüft.
      </p>
    </section>
  );
}
