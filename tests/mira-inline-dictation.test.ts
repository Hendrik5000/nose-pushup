import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MiraComposerPressAndHold,
  MiraInlineDictationController,
} from "../src/lib/mira-inline-dictation";
import type { MiraSpeechRecognitionLike } from "../src/lib/mira-voice-conversation";

class FakeRecognition implements MiraSpeechRecognitionLike {
  lang = "";
  continuous = false;
  interimResults = false;
  startCount = 0;
  stopCount = 0;
  abortCount = 0;
  onresult: MiraSpeechRecognitionLike["onresult"] = null;
  onerror: MiraSpeechRecognitionLike["onerror"] = null;
  onend: MiraSpeechRecognitionLike["onend"] = null;
  shouldThrowOnStart = false;

  start() {
    this.startCount += 1;
    if (this.shouldThrowOnStart) throw new Error("start failed");
  }
  stop() {
    this.stopCount += 1;
  }
  abort() {
    this.abortCount += 1;
  }
  emitResult(transcripts: Array<{ transcript: string; isFinal: boolean }>) {
    const results = transcripts.map((item) => ({
      isFinal: item.isFinal,
      0: { transcript: item.transcript },
    }));
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign(results, { length: results.length }),
    });
  }
  emitEnd() {
    this.onend?.();
  }
  emitError(error: string) {
    this.onerror?.({ error });
  }
}

function createController(recognition: FakeRecognition | null) {
  const transcripts: string[] = [];
  const interimTranscripts: string[] = [];
  const listening: boolean[] = [];
  const errors: string[] = [];
  const controller = new MiraInlineDictationController({
    createRecognition: () => recognition,
    onTranscript: (transcript) => transcripts.push(transcript),
    onInterimTranscript: (transcript) => interimTranscripts.push(transcript),
    onListeningChange: (value) => listening.push(value),
    onError: (message) => errors.push(message),
  });
  return { controller, transcripts, interimTranscripts, listening, errors };
}

type ScheduledTask = { callback: () => void; dueAt: number };
class FakeScheduler {
  now = 0;
  nextId = 0;
  tasks = new Map<number, ScheduledTask>();
  setTimeout = (callback: () => void, delay: number) => {
    const id = ++this.nextId;
    this.tasks.set(id, { callback, dueAt: this.now + delay });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  clearTimeout = (timer: ReturnType<typeof setTimeout>) => {
    this.tasks.delete(timer as unknown as number);
  };
  advance(milliseconds: number) {
    const target = this.now + milliseconds;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.dueAt <= target)
        .sort((a, b) => a[1].dueAt - b[1].dueAt)[0];
      if (!next) break;
      this.now = next[1].dueAt;
      this.tasks.delete(next[0]);
      next[1].callback();
    }
    this.now = target;
  }
}

test("inline dictation streams interim text, commits final text, and never sends", () => {
  const recognition = new FakeRecognition();
  const harness = createController(recognition);
  assert.equal(harness.controller.start(), true);
  assert.equal(recognition.lang, "de-DE");
  assert.equal(recognition.continuous, false);
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.startCount, 1);
  recognition.emitResult([
    { transcript: "Zwischenergebnis", isFinal: false },
    { transcript: "Erster Satz", isFinal: true },
  ]);
  assert.deepEqual(harness.transcripts, ["Erster Satz"]);
  assert.deepEqual(harness.interimTranscripts, ["Zwischenergebnis"]);
  recognition.emitResult([
    { transcript: "Zwischenergebnis", isFinal: false },
    { transcript: "Erster Satz", isFinal: true },
  ]);
  assert.deepEqual(harness.transcripts, ["Erster Satz"], "duplicate results are ignored");
  assert.deepEqual(harness.interimTranscripts, ["Zwischenergebnis", "Zwischenergebnis"]);
  assert.deepEqual(harness.listening, [true]);
});

test("final recognition clears the interim preview while preserving committed speech", () => {
  const recognition = new FakeRecognition();
  const harness = createController(recognition);
  harness.controller.start();
  recognition.emitResult([{ transcript: "Guten Morgen", isFinal: false }]);
  assert.deepEqual(harness.interimTranscripts, ["Guten Morgen"]);
  assert.deepEqual(harness.transcripts, []);

  recognition.emitResult([{ transcript: "Guten Morgen, Mira.", isFinal: true }]);
  assert.deepEqual(harness.transcripts, ["Guten Morgen, Mira."]);
  assert.deepEqual(harness.interimTranscripts, ["Guten Morgen", ""]);
});

test("normal stop ends listening immediately but allows a final result before onend", () => {
  const recognition = new FakeRecognition();
  const harness = createController(recognition);
  harness.controller.start();
  harness.controller.stop();
  assert.equal(recognition.stopCount, 1);
  assert.deepEqual(harness.listening, [true, false]);
  recognition.emitResult([{ transcript: "Noch ein Satz", isFinal: true }]);
  assert.deepEqual(harness.transcripts, ["Noch ein Satz"]);
  recognition.emitEnd();
  assert.deepEqual(harness.listening, [true, false]);
});

test("cancel aborts recognition and ignores late result, error and end events", () => {
  const recognition = new FakeRecognition();
  const harness = createController(recognition);
  harness.controller.start();
  const lateResult = recognition.onresult;
  const lateEnd = recognition.onend;
  harness.controller.cancel();
  assert.equal(recognition.abortCount, 1);
  assert.deepEqual(harness.listening, [true, false]);
  lateResult?.({
    resultIndex: 0,
    results: Object.assign([{ isFinal: true, 0: { transcript: "Alt" } }], { length: 1 }),
  });
  lateEnd?.();
  assert.deepEqual(harness.transcripts, []);
  assert.deepEqual(harness.listening, [true, false]);
});

test("unsupported, rejected and synchronously failing recognition return to idle", () => {
  const unsupported = createController(null);
  assert.equal(unsupported.controller.start(), false);
  assert.match(unsupported.errors[0] ?? "", /nicht unterstützt/);
  assert.deepEqual(unsupported.listening, []);

  const recognition = new FakeRecognition();
  const denied = createController(recognition);
  denied.controller.start();
  recognition.emitError("not-allowed");
  assert.match(denied.errors[0] ?? "", /nicht erlaubt/);
  assert.deepEqual(denied.listening, [true, false]);

  const failingRecognition = new FakeRecognition();
  failingRecognition.shouldThrowOnStart = true;
  const failing = createController(failingRecognition);
  assert.equal(failing.controller.start(), false);
  assert.match(failing.errors[0] ?? "", /nicht gestartet/);
  assert.deepEqual(failing.listening, [true, false]);
});

test("short composer taps remain normal edits", () => {
  const scheduler = new FakeScheduler();
  let starts = 0;
  let stops = 0;
  let cancels = 0;
  const press = new MiraComposerPressAndHold(
    () => starts++,
    () => stops++,
    () => cancels++,
    300,
    12,
    scheduler,
  );
  press.pointerDown(1, 20, 30);
  scheduler.advance(299);
  press.pointerUp(1);
  scheduler.advance(100);
  assert.equal(starts, 0);
  assert.equal(stops, 0);
  assert.equal(cancels, 0);
});

test("holding starts push-to-talk and releasing stops it", () => {
  const scheduler = new FakeScheduler();
  let starts = 0;
  let stops = 0;
  let cancels = 0;
  const press = new MiraComposerPressAndHold(
    () => starts++,
    () => stops++,
    () => cancels++,
    300,
    12,
    scheduler,
  );
  press.pointerDown(3, 4, 5);
  scheduler.advance(300);
  assert.equal(starts, 1);
  press.pointerUp(3);
  assert.equal(starts, 1);
  assert.equal(stops, 1);
  assert.equal(cancels, 0);
});

test("pointer movement or cancellation clears a pending press and cancels active push-to-talk", () => {
  const scheduler = new FakeScheduler();
  let starts = 0;
  let stops = 0;
  let cancels = 0;
  const press = new MiraComposerPressAndHold(
    () => starts++,
    () => stops++,
    () => cancels++,
    300,
    12,
    scheduler,
  );
  press.pointerDown(1, 0, 0);
  press.pointerMove(1, 20, 0);
  scheduler.advance(400);
  assert.equal(starts, 0);
  assert.equal(cancels, 0);

  press.pointerDown(2, 0, 0);
  scheduler.advance(300);
  press.pointerMove(2, 20, 0);
  assert.equal(starts, 1);
  assert.equal(cancels, 1);

  press.pointerDown(4, 0, 0);
  scheduler.advance(300);
  press.pointerCancel(4);
  assert.equal(starts, 2);
  assert.equal(cancels, 2);
  assert.equal(stops, 0);
});

test("dispose clears a pending timer and cancels push-to-talk that already started", () => {
  const scheduler = new FakeScheduler();
  let starts = 0;
  let stops = 0;
  let cancels = 0;
  const press = new MiraComposerPressAndHold(
    () => starts++,
    () => stops++,
    () => cancels++,
    300,
    12,
    scheduler,
  );
  press.pointerDown(1, 0, 0);
  press.dispose();
  scheduler.advance(400);
  assert.equal(starts, 0);
  assert.equal(cancels, 0);

  press.pointerDown(2, 0, 0);
  scheduler.advance(300);
  press.dispose();
  assert.equal(starts, 1);
  assert.equal(cancels, 1);
  assert.equal(stops, 0);
});
