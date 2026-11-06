import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MarketplaceCustomApps } from "@/components/marketplace/MarketplaceCustomApps";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import { isMarketplaceAdminAccessGranted } from "@/lib/marketplace";

type AccessState = Readonly<{
  userId: string;
  checked: boolean;
  isAdmin: boolean;
}>;

export function MarketplaceMiraAuthoring({ userId }: { userId: string }) {
  const checkAdminAccess = useServerFn(getAdminAreaAccess);
  const [access, setAccess] = useState<AccessState>({ userId, checked: false, isAdmin: false });
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const isAdmin = access.userId === userId && access.checked && access.isAdmin;

  useEffect(() => {
    let active = true;
    setAccess({ userId, checked: false, isAdmin: false });
    setOpen(false);
    void checkAdminAccess()
      .then((value) => {
        if (active) {
          setAccess({
            userId,
            checked: true,
            isAdmin: isMarketplaceAdminAccessGranted(value),
          });
        }
      })
      .catch(() => {
        if (active) setAccess({ userId, checked: true, isAdmin: false });
      });
    return () => {
      active = false;
    };
  }, [checkAdminAccess, userId]);

  const openAuthoring = async () => {
    if (!isAdmin) return;
    try {
      const currentAccess = await checkAdminAccess();
      if (!isMarketplaceAdminAccessGranted(currentAccess)) {
        setAccess({ userId, checked: true, isAdmin: false });
        setStatus("Admin-Zugriff ist nicht mehr bestätigt.");
        return;
      }
      setStatus("");
      setOpen(true);
    } catch {
      setStatus("Admin-Zugriff konnte nicht bestätigt werden.");
    }
  };

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => void openAuthoring()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-haspopup="dialog"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Alo-Apps erstellen oder bearbeiten
      </button>
      {status && (
        <p role="status" className="text-xs text-muted-foreground" aria-live="polite">
          {status}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!fixed !left-0 !top-0 !z-50 !m-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-hidden !rounded-none !border-0 !p-0 !shadow-none">
          <header className="shrink-0 border-b border-border bg-background px-4 py-5 pr-14 sm:px-6">
            <DialogTitle className="text-xl font-bold">Alo-Apps mit Mira</DialogTitle>
            <DialogDescription className="mt-2 max-w-3xl leading-relaxed">
              Erstelle eine neue deklarative App oder entwirf mit Mira eine neue Version deiner
              eigenen Veröffentlichung. Hier werden keine Alo-Website-Quelltexte oder beliebigen
              Skripte geändert.
            </DialogDescription>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto w-full max-w-5xl">
              <MarketplaceCustomApps userId={userId} isAdmin={isAdmin} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
