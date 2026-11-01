import { useEffect } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import type { IncomingCall } from "@/lib/calls/calls-client";
import { startRingtone } from "@/lib/calls/ringtone";

export function IncomingCallDialog({
  call,
  onAnswer,
}: {
  call: IncomingCall | null;
  onAnswer: (accept: boolean) => void;
}) {
  const callId = call?.callId ?? null;
  useEffect(() => {
    if (!callId) return;
    const ringtone = startRingtone();
    return () => ringtone.stop();
  }, [callId]);

  if (!call) return null;
  const initial = call.callerName.slice(0, 1).toUpperCase() || "?";
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      data-no-module-swipe
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-2xl font-semibold">
          {call.callerAvatarUrl ? (
            <img src={call.callerAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <h2 id="incoming-call-title" className="mt-4 text-lg font-semibold">
          {call.callerName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {call.kind === "video" ? "Eingehender Videoanruf" : "Eingehender Anruf"}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onAnswer(false)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground"
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" />
            Ablehnen
          </button>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {call.kind === "video" ? (
              <Video className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Phone className="h-4 w-4" aria-hidden="true" />
            )}
            Annehmen
          </button>
        </div>
      </div>
    </div>
  );
}
