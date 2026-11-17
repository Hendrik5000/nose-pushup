import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MarketplaceIcon } from "@/components/marketplace/MarketplaceIcon";
import { MarketplaceManifestView } from "@/components/marketplace/MarketplaceManifestView";
import { type FriendAppShare } from "@/lib/friend-app-shares";
import { friendAppSharesClient } from "@/lib/friend-app-shares.supabase";
import { loadFriendEntries } from "@/lib/friends/supabase-friends";

type Props = Readonly<{
  userId: string;
}>;

export function FriendAppSharesSection({ userId }: Props) {
  const [shares, setShares] = useState<FriendAppShare[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = shares.find((share) => share.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setShares([]);
    setNames({});
    setSelectedId(null);
    Promise.all([friendAppSharesClient.listShares(), loadFriendEntries(userId)])
      .then(([loadedShares, friends]) => {
        if (!active) return;
        const friendNames: Record<string, string> = {};
        for (const friend of friends) friendNames[friend.id] = friend.displayName;
        setNames(friendNames);
        setShares(loadedShares.filter((share) => share.sharerId !== userId));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Unbekannter Fehler.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (status === "loading") {
    return (
      <section
        className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center"
        aria-live="polite"
      >
        <p className="text-sm text-muted-foreground" role="status">
          Geteilte Apps werden geladen …
        </p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section
        className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-8"
        aria-live="polite"
      >
        <p className="text-base font-semibold">Geteilte Apps konnten nicht geladen werden</p>
        <p
          className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground"
          role="alert"
        >
          {errorMessage}
        </p>
      </section>
    );
  }

  if (shares.length === 0) {
    return (
      <section
        className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center"
        aria-live="polite"
      >
        <p className="text-base font-semibold">Noch keine Apps von Freunden</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Hier erscheinen Apps, sobald Freunde etwas für den Alo-Marketplace freigeben.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="space-y-1" aria-label="Apps von Freunden">
        <h2 className="px-1 pb-1 text-lg font-bold">Von Freunden</h2>
        {shares.map((share) => {
          const sharerName = names[share.sharerId] ?? "ein Freund";
          return (
            <div
              key={share.id}
              className="flex items-center gap-3 rounded-2xl px-1 py-2 transition hover:bg-card/70 sm:gap-4 sm:px-2"
            >
              <button
                type="button"
                aria-label={`${share.manifest.name} von ${sharerName}. Details öffnen`}
                onClick={() => setSelectedId(share.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:gap-4"
              >
                <MarketplaceIcon
                  icon={share.manifest.icon}
                  className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {share.manifest.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    Von {sharerName} geteilt
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {share.manifest.description}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(share.id)}
                className="min-h-11 shrink-0 rounded-full border border-primary/40 px-4 text-sm font-semibold text-primary"
              >
                Ansehen
              </button>
            </div>
          );
        })}
      </section>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <div>
              <DialogTitle className="text-lg font-bold">{selected.manifest.name}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Von {names[selected.sharerId] ?? "ein Freund"} geteilt
              </DialogDescription>
              <MarketplaceManifestView
                manifest={selected.manifest}
                preview={false}
                canRunActions={false}
                checklistStorageScope={`friend-share:${selected.id}`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
