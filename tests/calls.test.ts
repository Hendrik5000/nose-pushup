import assert from "node:assert/strict";
import test from "node:test";
import { buildIceServers, hasTurn } from "../src/lib/calls/ice";
import {
  createCallsClient,
  describeEndReason,
  isFinalStatus,
  parseCallSignals,
  parseIncomingCalls,
  type CallSignal,
} from "../src/lib/calls/calls-client";
import {
  CallSession,
  type CallSessionOptions,
  type CallTransport,
  type MediaLike,
  type PeerLike,
} from "../src/lib/calls/call-session";
import type { RpcGateway } from "../src/lib/friends/rpc";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CALL = "33333333-3333-4333-8333-333333333333";

test("STUN is the default, TURN needs url, user and credential", () => {
  assert.equal(buildIceServers({}).length, 1);
  assert.ok(buildIceServers({})[0].urls[0].startsWith("stun:"));
  assert.equal(hasTurn({ VITE_TURN_URLS: "turn:t.example:3478" }), false);
  const servers = buildIceServers({
    VITE_TURN_URLS: "turn:t.example:3478, https://bad, turns:t.example:5349",
    VITE_TURN_USERNAME: "u",
    VITE_TURN_CREDENTIAL: "p",
  });
  assert.equal(servers.length, 2);
  assert.deepEqual(servers[1].urls, ["turn:t.example:3478", "turns:t.example:5349"]);
});

test("calls client maps start_call answers", async () => {
  const answers: Record<string, unknown> = {
    ringing: { status: "ringing", call_id: CALL },
    callee_busy: { status: "callee_busy" },
    nonsense: { status: "weird" },
  };
  let key = "ringing";
  const gw: RpcGateway = { rpc: async () => ({ data: answers[key], error: null }) };
  const client = createCallsClient(gw);
  assert.deepEqual(await client.start(OTHER, "audio"), { ok: true, callId: CALL });
  key = "callee_busy";
  const busy = await client.start(OTHER, "video");
  assert.equal(busy.ok, false);
  key = "nonsense";
  const unknown = await client.start(OTHER, "video");
  assert.equal(!unknown.ok && unknown.status, "unavailable");
});

test("signals and incoming calls are parsed defensively and ordered", () => {
  const signals = parseCallSignals([
    { id: 5, call_id: CALL, sender_id: OTHER, type: "candidate", payload: {} },
    { id: "2", call_id: CALL, sender_id: OTHER, type: "offer", payload: {} },
    { id: 9, call_id: CALL, sender_id: OTHER, type: "evil", payload: {} },
  ]);
  assert.deepEqual(
    signals.map((s) => s.id),
    [2, 5],
  );
  assert.equal(
    parseIncomingCalls([{ call_id: CALL, caller_id: OTHER, kind: "video", caller_name: "Mia" }])[0]
      .kind,
    "video",
  );
  assert.equal(parseIncomingCalls([{ call_id: "x" }]).length, 0);
});

test("final statuses end a call", () => {
  for (const s of ["declined", "cancelled", "missed", "ended", "failed"])
    assert.ok(isFinalStatus(s));
  assert.ok(!isFinalStatus("ringing"));
  assert.ok(!isFinalStatus("accepted"));
  assert.match(describeEndReason("declined", "caller"), /abgelehnt/);
});

// ---- Session with fakes -------------------------------------------------

class FakePeer implements PeerLike {
  localDescription: { type: string; sdp?: string } | null = null;
  remoteDescription: unknown = null;
  onicecandidate: PeerLike["onicecandidate"] = null;
  ontrack: PeerLike["ontrack"] = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = "new";
  tracks: unknown[] = [];
  candidates: unknown[] = [];
  closed = false;
  addTrack(track: unknown) {
    this.tracks.push(track);
  }
  async createOffer() {
    return { type: "offer", sdp: "offer-sdp" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "answer-sdp" };
  }
  async setLocalDescription(d: { type: string; sdp?: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: unknown) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: unknown) {
    assert.ok(this.remoteDescription, "candidates must wait for the remote description");
    this.candidates.push(c);
  }
  close() {
    this.closed = true;
  }
  setState(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

class FakeMedia implements MediaLike {
  stopped = 0;
  audio = { kind: "audio", enabled: true, stop: () => this.stopped++ };
  video = { kind: "video", enabled: true, stop: () => this.stopped++ };
  getTracks() {
    return [this.audio, this.video];
  }
}

function setup(role: "caller" | "callee", overrides: Partial<CallSessionOptions> = {}) {
  const sent: { type: string; payload: unknown }[] = [];
  const ended: boolean[] = [];
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  const state = { status: "ringing" as string, signals: [] as CallSignal[] };
  const transport: CallTransport = {
    sendSignal: async (_id, type, payload) => {
      sent.push({ type, payload });
      return true;
    },
    fetchSignals: async (_id, after) => state.signals.filter((s) => s.id > after),
    fetchStatus: async () => state.status,
    end: async (_id, failed) => {
      ended.push(failed);
      return failed
        ? "failed"
        : role === "caller" && state.status === "ringing"
          ? "cancelled"
          : "ended";
    },
    subscribe: () => () => undefined,
  };
  const peer = new FakePeer();
  const media = new FakeMedia();
  const session = new CallSession({
    callId: CALL,
    role,
    kind: "video",
    myUserId: ME,
    transport,
    createPeer: () => peer,
    getMedia: async () => media,
    setTimer: (fn, ms) => {
      const handle = { fn, ms, cleared: false };
      timers.push(handle);
      return handle;
    },
    clearTimer: (h) => {
      (h as { cleared: boolean }).cleared = true;
    },
    ...overrides,
  });
  return { session, peer, media, sent, ended, timers, state };
}

const sig = (
  id: number,
  type: CallSignal["type"],
  payload: unknown,
  sender = OTHER,
): CallSignal => ({
  id,
  callId: CALL,
  senderId: sender,
  type,
  payload,
});

test("caller waits for acceptance, then offers once and applies the answer", async () => {
  const t = setup("caller");
  await t.session.start();
  assert.equal(t.session.getState().phase, "ringing");
  assert.equal(t.sent.length, 0);

  t.state.status = "accepted";
  await t.session.pull();
  await t.session.pull();
  assert.deepEqual(
    t.sent.map((s) => s.type),
    ["offer"],
  );
  assert.equal(t.session.getState().phase, "connecting");

  // The answer arrives together with an early candidate.
  t.state.signals = [sig(1, "candidate", { c: 1 }), sig(2, "answer", { type: "answer", sdp: "x" })];
  await t.session.pull();
  assert.deepEqual(t.peer.remoteDescription, { type: "answer", sdp: "x" });
  assert.equal(t.peer.candidates.length, 1);

  t.peer.setState("connected");
  assert.equal(t.session.getState().phase, "connected");
  assert.ok(t.session.getState().startedAt);
});

test("callee answers an offer and queues candidates that arrive first", async () => {
  const t = setup("callee");
  t.state.status = "accepted";
  t.state.signals = [sig(1, "candidate", { c: 1 }), sig(2, "offer", { type: "offer", sdp: "o" })];
  await t.session.start();
  assert.deepEqual(
    t.sent.map((s) => s.type),
    ["answer"],
  );
  assert.equal(t.peer.candidates.length, 1);
  // Replays are ignored.
  await t.session.pull();
  assert.equal(t.sent.length, 1);
});

test("own signals are ignored", async () => {
  const t = setup("callee");
  t.state.status = "accepted";
  t.state.signals = [sig(1, "offer", { type: "offer" }, ME)];
  await t.session.start();
  assert.equal(t.sent.length, 0);
});

test("a final status from the other side closes tracks and the peer", async () => {
  const t = setup("callee");
  t.state.status = "accepted";
  await t.session.start();
  t.state.status = "ended";
  await t.session.pull();
  assert.equal(t.session.getState().phase, "ended");
  assert.equal(t.media.stopped, 2);
  assert.ok(t.peer.closed);
  assert.deepEqual(t.ended, []);
});

test("hangup ends the call on the server once", async () => {
  const t = setup("caller");
  await t.session.start();
  await t.session.hangup();
  await t.session.hangup();
  assert.deepEqual(t.ended, [false]);
  assert.equal(t.session.getState().phase, "ended");
  assert.match(t.session.getState().message ?? "", /abgebrochen/);
});

test("the caller gives up after the ring timeout", async () => {
  const t = setup("caller");
  await t.session.start();
  const ring = t.timers.find((x) => x.ms === 60_000);
  assert.ok(ring);
  ring.fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(t.session.getState().phase, "ended");
  assert.deepEqual(t.ended, [false]);
});

test("missing media permissions fail the call and report it", async () => {
  const t = setup("caller", {
    getMedia: async () => {
      throw new Error("denied");
    },
  });
  await t.session.start();
  assert.equal(t.session.getState().phase, "failed");
  assert.match(t.session.getState().message ?? "", /Kamera oder Mikrofon/);
  assert.deepEqual(t.ended, [true]);
});

test("a failed connection is reported as failed", async () => {
  const t = setup("callee");
  await t.session.start();
  t.peer.setState("failed");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(t.session.getState().phase, "failed");
  assert.deepEqual(t.ended, [true]);
});

test("mute and camera toggles change the local tracks", async () => {
  const t = setup("callee");
  await t.session.start();
  t.session.setMuted(true);
  t.session.setCameraOff(true);
  assert.equal(t.media.audio.enabled, false);
  assert.equal(t.media.video.enabled, false);
  t.session.setMuted(false);
  assert.equal(t.media.audio.enabled, true);
});

test("local ICE candidates are forwarded to the other side", async () => {
  const t = setup("caller");
  await t.session.start();
  t.peer.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: "abc" }) } });
  t.peer.onicecandidate?.({ candidate: null });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(t.sent, [{ type: "candidate", payload: { candidate: "abc" } }]);
});
