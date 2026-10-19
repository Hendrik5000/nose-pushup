import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ALO_EVENT, ALO_REMOTE_EVENT, getMiraGrants } from "@/lib/alo-store";
import { MiraContextControls } from "./MiraContextControls";
export function MiraSources({ userId }: { userId: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState(() => getMiraGrants(userId));
  useEffect(() => {
    const refresh = () => setGrants(getMiraGrants(userId));
    refresh();
    window.addEventListener(ALO_EVENT, refresh);
    window.addEventListener(ALO_REMOTE_EVENT, refresh);
    return () => {
      window.removeEventListener(ALO_EVENT, refresh);
      window.removeEventListener(ALO_REMOTE_EVENT, refresh);
    };
  }, [userId]);
  const active = grants.training || grants.rooms.length > 0;
  const label = active
    ? `Quellen: ${[grants.training ? "Training & Gesundheit" : "", grants.rooms.length ? `${grants.rooms.length} Nexus-${grants.rooms.length === 1 ? "Raum" : "Räume"}` : ""].filter(Boolean).join(" · ")}`
    : "Quellen: aus · nur dein Mira-Chat";
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="alo-source-trigger"
        data-active={active}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="alo-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle>Mira · Datenquellen</DialogTitle>
          <DialogDescription>
            Du entscheidest, was zusätzlich zu deiner Frage und diesem Chat an deinen KI-Anbieter
            gesendet wird.
          </DialogDescription>
          <MiraContextControls userId={userId} />
          <button className="alo-btn" onClick={() => setOpen(false)}>
            Zurück zur Frage
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
