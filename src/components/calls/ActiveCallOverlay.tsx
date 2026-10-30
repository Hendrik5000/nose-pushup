import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import type { CallState } from "@/lib/calls/call-session";
import type { ActiveCall } from "./CallProvider";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function phaseLabel(state: CallState): string {
  switch (state.phase) {
    case "ringing":
      return "Klingelt…";
    case "connecting":
      return "Verbinde…";
    case "connected":
      return "Verbunden";
    case "failed":
    case "ended":
      return state.message ?? "Anruf beendet.";
  }
}

export function ActiveCallOverlay({ call, state }: { call: ActiveCall; state: CallState }) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (remoteRef.current)
      remoteRef.current.srcObject = (state.remoteStream as MediaStream | null) ?? null;
  }, [state.remoteStream]);
  useEffect(() => {
    if (localRef.current)
      localRef.current.srcObject = (state.localStream as MediaStream | null) ?? null;
  }, [state.localStream, state.cameraOff]);
  useEffect(() => {
    if (!state.startedAt) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - (state.startedAt ?? Date.now())) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.startedAt]);

  const over = state.phase === "ended" || state.phase === "failed";
  const video = call.kind === "video";
  const initial = call.peer.name.slice(0, 1).toUpperCase() || "?";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Anruf mit ${call.peer.name}`}
      data-no-module-swipe
      className="fixed inset-0 z-[110] flex flex-col bg-black text-white"
    >
      {/* The remote element always exists so audio plays in audio-only calls too. */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className={
          video && state.remoteStream ? "absolute inset-0 h-full w-full object-cover" : "hidden"
        }
      />
      {!(video && state.remoteStream) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-4xl font-semibold">
            {call.peer.avatarUrl ? (
              <img src={call.peer.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <h2 className="text-xl font-semibold">{call.peer.name}</h2>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-5 text-center">
        {video && Boolean(state.remoteStream) && (
          <div className="text-base font-semibold">{call.peer.name}</div>
        )}
        <div role="status" aria-live="polite" className="text-sm text-white/80">
          {phaseLabel(state)}
          {state.phase === "connected" && ` · ${formatDuration(seconds)}`}
        </div>
      </div>
      {video && state.localStream && !state.cameraOff && (
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute right-4 top-20 h-36 w-24 rounded-xl border border-white/30 bg-black object-cover [transform:scaleX(-1)]"
        />
      )}
      <div className="relative z-10 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={over}
          onClick={() => call.session.setMuted(!state.muted)}
          aria-pressed={state.muted}
          aria-label={state.muted ? "Mikrofon einschalten" : "Mikrofon stummschalten"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
        >
          {state.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        {video && (
          <button
            type="button"
            disabled={over}
            onClick={() => call.session.setCameraOff(!state.cameraOff)}
            aria-pressed={state.cameraOff}
            aria-label={state.cameraOff ? "Kamera einschalten" : "Kamera ausschalten"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
          >
            {state.cameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </button>
        )}
        <button
          type="button"
          disabled={over}
          onClick={() => void call.session.hangup()}
          aria-label="Auflegen"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 disabled:opacity-40"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
