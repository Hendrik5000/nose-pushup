import {
  describeEndReason,
  isFinalStatus,
  type CallKind,
  type CallSignal,
  type CallSignalType,
} from "./calls-client";

export type CallRole = "caller" | "callee";
export type CallPhase = "ringing" | "connecting" | "connected" | "ended" | "failed";

/** Minimal surface of RTCPeerConnection that the session needs (and that tests can fake). */
export interface PeerLike {
  localDescription: { type: string; sdp?: string } | null;
  remoteDescription: unknown;
  onicecandidate: ((event: { candidate: { toJSON(): unknown } | null }) => void) | null;
  ontrack: ((event: { streams: unknown[]; track: unknown }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  connectionState: string;
  addTrack(track: unknown, stream: unknown): unknown;
  createOffer(): Promise<{ type: string; sdp?: string }>;
  createAnswer(): Promise<{ type: string; sdp?: string }>;
  setLocalDescription(description: { type: string; sdp?: string }): Promise<void>;
  setRemoteDescription(description: unknown): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  close(): void;
}

export interface MediaLike {
  getTracks(): { kind: string; enabled: boolean; stop(): void }[];
}

export interface CallTransport {
  sendSignal(callId: string, type: CallSignalType, payload: unknown): Promise<boolean>;
  fetchSignals(callId: string, afterId: number): Promise<CallSignal[]>;
  fetchStatus(callId: string): Promise<string | null>;
  end(callId: string, failed: boolean): Promise<string>;
  /** Realtime hint: the session pulls immediately. Returns an unsubscribe function. */
  subscribe(callId: string, onChange: () => void): () => void;
}

export type CallState = {
  phase: CallPhase;
  muted: boolean;
  cameraOff: boolean;
  localStream: MediaLike | null;
  remoteStream: unknown | null;
  startedAt: number | null;
  message: string | null;
};

export type CallSessionOptions = {
  callId: string;
  role: CallRole;
  kind: CallKind;
  myUserId: string;
  transport: CallTransport;
  createPeer: () => PeerLike;
  getMedia: (kind: CallKind) => Promise<MediaLike>;
  pollMs?: number;
  ringTimeoutMs?: number;
  disconnectGraceMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export class CallSession {
  private state: CallState;
  private listeners = new Set<(state: CallState) => void>();
  private peer: PeerLike | null = null;
  private unsubscribe: (() => void) | null = null;
  private pollHandle: unknown = null;
  private ringHandle: unknown = null;
  private disconnectHandle: unknown = null;
  private lastSignalId = 0;
  private pendingCandidates: unknown[] = [];
  private offerSent = false;
  private answerSent = false;
  private finished = false;
  private pulling = false;
  private pullAgain = false;

  private readonly pollMs: number;
  private readonly ringTimeoutMs: number;
  private readonly disconnectGraceMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(private readonly opts: CallSessionOptions) {
    this.pollMs = opts.pollMs ?? 2000;
    this.ringTimeoutMs = opts.ringTimeoutMs ?? 60_000;
    this.disconnectGraceMs = opts.disconnectGraceMs ?? 10_000;
    this.now = opts.now ?? (() => Date.now());
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      opts.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.state = {
      phase: opts.role === "caller" ? "ringing" : "connecting",
      muted: false,
      cameraOff: false,
      localStream: null,
      remoteStream: null,
      startedAt: null,
      message: null,
    };
  }

  getState(): CallState {
    return this.state;
  }

  onChange(listener: (state: CallState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(patch: Partial<CallState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  async start(): Promise<void> {
    let media: MediaLike;
    try {
      media = await this.opts.getMedia(this.opts.kind);
    } catch {
      await this.finish(
        "failed",
        this.opts.kind === "video"
          ? "Kamera oder Mikrofon sind nicht verfügbar. Prüfe die Berechtigungen."
          : "Das Mikrofon ist nicht verfügbar. Prüfe die Berechtigungen.",
        true,
      );
      return;
    }
    if (this.finished) {
      for (const track of media.getTracks()) track.stop();
      return;
    }
    this.update({ localStream: media });

    const peer = this.opts.createPeer();
    this.peer = peer;
    for (const track of media.getTracks()) peer.addTrack(track, media);
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void this.opts.transport.sendSignal(
          this.opts.callId,
          "candidate",
          event.candidate.toJSON(),
        );
      }
    };
    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) this.update({ remoteStream: stream });
    };
    peer.onconnectionstatechange = () => this.onConnectionState(peer.connectionState);

    this.unsubscribe = this.opts.transport.subscribe(this.opts.callId, () => void this.pull());
    this.schedulePoll();
    if (this.opts.role === "caller") {
      this.ringHandle = this.setTimer(() => void this.hangup(), this.ringTimeoutMs);
    }
    await this.pull();
  }

  private schedulePoll(): void {
    if (this.finished) return;
    this.pollHandle = this.setTimer(async () => {
      await this.pull();
      this.schedulePoll();
    }, this.pollMs);
  }

  /** Reads call status and new signals. Serialised so signals are applied in order. */
  async pull(): Promise<void> {
    if (this.finished) return;
    if (this.pulling) {
      this.pullAgain = true;
      return;
    }
    this.pulling = true;
    try {
      do {
        this.pullAgain = false;
        const status = await this.opts.transport.fetchStatus(this.opts.callId).catch(() => null);
        if (this.finished) return;
        if (status && isFinalStatus(status)) {
          // Drain remaining signals is pointless once the call is closed.
          await this.finish(
            status === "failed" ? "failed" : "ended",
            describeEndReason(status, this.opts.role),
            false,
          );
          return;
        }
        if (status === "accepted" && this.opts.role === "caller") await this.sendOfferOnce();
        const signals = await this.opts.transport
          .fetchSignals(this.opts.callId, this.lastSignalId)
          .catch(() => [] as CallSignal[]);
        for (const signal of signals) {
          if (this.finished) return;
          if (signal.id <= this.lastSignalId) continue;
          this.lastSignalId = signal.id;
          if (signal.senderId === this.opts.myUserId) continue;
          await this.applySignal(signal);
        }
      } while (this.pullAgain && !this.finished);
    } finally {
      this.pulling = false;
    }
  }

  private async sendOfferOnce(): Promise<void> {
    const peer = this.peer;
    if (!peer || this.offerSent) return;
    this.offerSent = true;
    this.clearRing();
    this.update({ phase: "connecting" });
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const ok = await this.opts.transport.sendSignal(this.opts.callId, "offer", {
        type: offer.type,
        sdp: offer.sdp,
      });
      if (!ok) await this.finish("failed", "Die Verbindung konnte nicht aufgebaut werden.", true);
    } catch {
      await this.finish("failed", "Die Verbindung konnte nicht aufgebaut werden.", true);
    }
  }

  private async applySignal(signal: CallSignal): Promise<void> {
    const peer = this.peer;
    if (!peer) return;
    try {
      if (signal.type === "offer" && this.opts.role === "callee" && !this.answerSent) {
        this.answerSent = true;
        await peer.setRemoteDescription(signal.payload);
        await this.flushCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        const ok = await this.opts.transport.sendSignal(this.opts.callId, "answer", {
          type: answer.type,
          sdp: answer.sdp,
        });
        if (!ok) await this.finish("failed", "Die Verbindung konnte nicht aufgebaut werden.", true);
      } else if (
        signal.type === "answer" &&
        this.opts.role === "caller" &&
        !peer.remoteDescription
      ) {
        await peer.setRemoteDescription(signal.payload);
        await this.flushCandidates();
      } else if (signal.type === "candidate") {
        if (peer.remoteDescription) await peer.addIceCandidate(signal.payload);
        else this.pendingCandidates.push(signal.payload);
      }
    } catch {
      await this.finish("failed", "Die Verbindung konnte nicht aufgebaut werden.", true);
    }
  }

  private async flushCandidates(): Promise<void> {
    const peer = this.peer;
    if (!peer) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) await peer.addIceCandidate(candidate).catch(() => undefined);
  }

  private onConnectionState(connection: string): void {
    if (this.finished) return;
    if (connection === "connected") {
      if (this.disconnectHandle) this.clearTimer(this.disconnectHandle);
      this.disconnectHandle = null;
      this.clearRing();
      if (this.state.phase !== "connected")
        this.update({ phase: "connected", startedAt: this.now() });
    } else if (connection === "failed") {
      void this.finish(
        "failed",
        "Die Verbindung wurde unterbrochen. Möglicherweise blockiert dein Netzwerk direkte Anrufe.",
        true,
      );
    } else if (connection === "disconnected" && !this.disconnectHandle) {
      this.disconnectHandle = this.setTimer(() => {
        this.disconnectHandle = null;
        if (this.peer?.connectionState !== "connected") {
          void this.finish("failed", "Die Verbindung wurde unterbrochen.", true);
        }
      }, this.disconnectGraceMs);
    }
  }

  private clearRing(): void {
    if (this.ringHandle) this.clearTimer(this.ringHandle);
    this.ringHandle = null;
  }

  setMuted(muted: boolean): void {
    for (const track of this.state.localStream?.getTracks() ?? []) {
      if (track.kind === "audio") track.enabled = !muted;
    }
    this.update({ muted });
  }

  setCameraOff(cameraOff: boolean): void {
    for (const track of this.state.localStream?.getTracks() ?? []) {
      if (track.kind === "video") track.enabled = !cameraOff;
    }
    this.update({ cameraOff });
  }

  /** User ends the call (or the ring timeout fires). */
  async hangup(): Promise<void> {
    if (this.finished) return;
    const status = await this.opts.transport.end(this.opts.callId, false).catch(() => "stale");
    await this.finish(
      "ended",
      describeEndReason(status === "cancelled" ? "cancelled" : "ended", this.opts.role),
      false,
    );
  }

  private async finish(
    phase: "ended" | "failed",
    message: string,
    reportFailure: boolean,
  ): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    if (this.pollHandle) this.clearTimer(this.pollHandle);
    if (this.disconnectHandle) this.clearTimer(this.disconnectHandle);
    this.clearRing();
    this.pollHandle = this.disconnectHandle = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const track of this.state.localStream?.getTracks() ?? []) track.stop();
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
    }
    this.update({ phase, message, localStream: null, remoteStream: null });
    if (reportFailure) await this.opts.transport.end(this.opts.callId, true).catch(() => undefined);
  }
}
