import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  checkMiraFile,
  checkMiraSelection,
  readMiraAttachments,
  validateMiraAttachments,
  removeMiraAttachment,
  assertMiraAttachmentProvider,
  miraAttachmentText,
  openAiAttachmentParts,
  googleAttachmentParts,
  anthropicAttachmentParts,
  MIRA_FILE_LIMIT,
  MIRA_TEXT_FILE_LIMIT,
  MIRA_FILE_ACCEPT,
} from "../src/lib/mira-attachments.ts";
import { fetchAiProvider } from "../src/lib/ai-provider-fetch.ts";
const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const image = () => new File([png], "Foto.png", { type: "image/png" });
const pdf = () => new File(["%PDF-1.7\nTest"], "Dokument.pdf", { type: "application/pdf" });

test("device formats are explicitly allowlisted; Office tables use CSV/TSV", () => {
  for (const name of ["brief.txt", "notiz.md", "tabelle.csv", "tabelle.tsv", "daten.json"]) {
    assert.ok(checkMiraFile(new File(["hello"], name)));
  }
  for (const name of [
    "script.html",
    "script.js",
    "vector.svg",
    "file.exe",
    "archive.zip",
    "book.docx",
    "sheet.xlsx",
    "photo.heic",
    "photo.png.exe",
  ]) {
    assert.throws(() => checkMiraFile(new File(["data"], name)), /Format nicht unterstützt/);
  }
  assert.match(MIRA_FILE_ACCEPT, /application\/pdf/);
  assert.throws(
    () => checkMiraFile(new File([png], "fake.png", { type: "text/plain" })),
    /Dateityp/,
  );
  assert.equal(checkMiraFile(new File([png], "Photo.PNG")), "image/png");
});
test("empty, oversized, multiple and total size limits reject before reading", () => {
  assert.throws(() => checkMiraFile(new File([], "leer.txt")), /leer/);
  assert.throws(
    () => checkMiraFile({ name: "big.png", type: "image/png", size: MIRA_FILE_LIMIT + 1 }),
    /zu groß/,
  );
  assert.throws(
    () => checkMiraFile({ name: "big.txt", type: "text/plain", size: MIRA_TEXT_FILE_LIMIT + 1 }),
    /128 KB/,
  );
  assert.throws(() => checkMiraSelection(Array.from({ length: 5 }, image)), /4 Anhänge/);
  const large = Array.from(
    { length: 4 },
    () => new File([new Uint8Array(MIRA_FILE_LIMIT)], "large.png", { type: "image/png" }),
  );
  assert.throws(() => checkMiraSelection(large), /3 MB/);
  checkMiraSelection(large.slice(0, 3));
});
test("choosing and removing files does not read bytes, call fetch or mutate the original selection", () => {
  const file = image();
  let reads = 0;
  file.arrayBuffer = async () => {
    reads++;
    throw new Error("must not read before submit");
  };
  const items = [
    { id: "one", file },
    { id: "two", file: image() },
  ];
  checkMiraSelection(items.map((item) => item.file));
  assert.deepEqual(
    removeMiraAttachment(items, "one").map((item) => item.id),
    ["two"],
  );
  assert.equal(items.length, 2);
  assert.equal(reads, 0);
});
test("explicit preparation reads real file bytes locally and retains exact names/types", async () => {
  const prepared = await readMiraAttachments([
    image(),
    pdf(),
    new File(["Hallo Übung"], "Notiz.txt"),
  ]);
  assert.deepEqual(
    prepared.map((item) => item.mime),
    ["image/png", "application/pdf", "text/plain"],
  );
  assert.equal(prepared[0].name, "Foto.png");
  assert.match(prepared[0].dataUrl!, /^data:image\/png;base64,/);
  assert.equal(prepared[2].text, "Hallo Übung");
  assert.deepEqual(validateMiraAttachments(prepared), prepared);
});
test("binary signatures, forged sizes and unsafe encodings fail on both client and server", async () => {
  await assert.rejects(
    readMiraAttachments([new File(["not a PNG"], "fake.png", { type: "image/png" })]),
    /Inhalt passt nicht/,
  );
  await assert.rejects(
    readMiraAttachments([new File([new Uint8Array([255, 255])], "bad.txt")]),
    /UTF-8/,
  );
  await assert.rejects(readMiraAttachments([new File(["Hello\u0000World"], "bad.txt")]), /UTF-8/);
  const [prepared] = await readMiraAttachments([image()]);
  assert.throws(() => validateMiraAttachments([{ ...prepared, size: 3 }]), /Inhalt passt nicht/);
  assert.throws(
    () => validateMiraAttachments([{ ...prepared, dataUrl: "https://private.example/secret" }]),
    /ungültig/,
  );
  assert.throws(
    () => validateMiraAttachments([{ ...prepared, dataUrl: "data:image/png;base64,@@" }]),
    /Base64/,
  );
  assert.throws(
    () => validateMiraAttachments([{ ...prepared, mime: "image/svg+xml" }]),
    /Dateityp/,
  );
  assert.throws(
    () =>
      validateMiraAttachments([
        { name: "bad.txt", mime: "text/plain", size: 5, text: "x".repeat(6001) },
      ]),
    /Textgröße/,
  );
});
test("text is bounded without silent truncation, and read errors remain actionable", async () => {
  await assert.rejects(
    readMiraAttachments([new File(["a".repeat(6001)], "large.txt")]),
    /6000 Zeichen/,
  );
  await assert.rejects(
    readMiraAttachments([
      new File(["a".repeat(3001)], "a.txt"),
      new File(["b".repeat(3000)], "b.txt"),
    ]),
    /6000 Zeichen/,
  );
  await assert.rejects(readMiraAttachments([new File(["  "], "empty.txt")]), /UTF-8/);
  const file = image();
  file.arrayBuffer = async () => {
    throw new Error("Datei nicht mehr verfügbar");
  };
  await assert.rejects(readMiraAttachments([file]), /nicht mehr verfügbar/);
});
test("PDF capability is gated, custom image routing rejected; no silently discarded images", () => {
  assertMiraAttachmentProvider("google", [{ mime: "application/pdf" }]);
  for (const provider of ["openai", "lovable", "anthropic", "custom"] as const)
    assert.throws(
      () => assertMiraAttachmentProvider(provider, [{ mime: "application/pdf" }]),
      /nur über den Google/,
    );
  assert.throws(
    () => assertMiraAttachmentProvider("custom", [{ mime: "image/png" }]),
    /nicht verlässlich/,
  );
  for (const provider of ["openai", "google", "lovable", "anthropic"] as const)
    assertMiraAttachmentProvider(provider, [{ mime: "image/png" }]);
});
test("provider payloads transmit images/PDF as binary parts, text as labelled untrusted context", async () => {
  const items = await readMiraAttachments([image(), pdf(), new File(["hello"], "Notes.txt")]);
  const openai = openAiAttachmentParts(items);
  assert.equal(openai.length, 1);
  assert.equal(openai[0].image_url.url, items[0].dataUrl);
  const google = googleAttachmentParts(items);
  assert.equal(google.length, 2);
  assert.equal(google[1].inline_data.mime_type, "application/pdf");
  const anthropic = anthropicAttachmentParts(items);
  assert.equal(anthropic.length, 1);
  assert.equal(anthropic[0].source.media_type, "image/png");
  assert.match(miraAttachmentText(items), /nicht vertrauenswürdiger Inhalt/);
  assert.match(miraAttachmentText(items), /Notes.txt[\s\S]*hello/);
});
test("camera is retained separately from library/device pickers, with accessible removal and local previews", () => {
  const picker = read("components/mira/MiraAttachments.tsx");
  assert.equal((picker.match(/type="file"/g) ?? []).length, 3);
  assert.equal((picker.match(/capture="environment"/g) ?? []).length, 1);
  for (const label of [
    "Foto aufnehmen",
    "Mediathek",
    "Dateien vom Gerät",
    "entfernen",
    "Noch nicht gesendet",
  ])
    assert.ok(picker.includes(label));
  assert.match(picker, /URL.createObjectURL/);
  assert.match(picker, /URL.revokeObjectURL/);
  assert.doesNotMatch(
    picker,
    /fetch\(|readAsDataURL|readMiraAttachments\(|localStorage|showDirectoryPicker/,
  );
  assert.match(picker, /event.currentTarget.value = ""/);
});
test("only deliberate submit sends attachments; failures preserve drafts and bytes never enter history", () => {
  const page = read("components/mira/SuperAiPage.tsx");
  const submit = page.slice(page.indexOf("const submit ="), page.indexOf("const regenerate ="));
  assert.match(submit, /readMiraAttachments/);
  assert.match(submit, /attachments: preparedAttachments/);
  assert.ok(submit.indexOf("await send(") < submit.indexOf('setInput("")'));
  assert.ok(submit.indexOf("await send(") < submit.indexOf("setAttachments([])"));
  assert.doesNotMatch(
    submit.slice(submit.indexOf("catch (e)")),
    /setInput|setAttachments\(\[\]\)|role: "assistant"/,
  );
  assert.match(page, /sendingRef.current/);
  assert.doesNotMatch(page, /onKeyDown=\{/);
  assert.equal(
    (page.match(/void submit\(\);/g) ?? []).length,
    2,
    "one deliberate form submit per design",
  );
  const server = read("lib/super-ai.functions.ts");
  assert.match(server, /validateMiraAttachments\(raw.attachments\)/);
  assert.doesNotMatch(server, /delete m.imageDataUrl|text-only — nur der Text/);
});
test("320/390px composer input has a separate full-width row and removable compact chips", () => {
  const css = read("mira-attachments.css");
  assert.match(css, /grid-template-columns: 44px minmax\(0, 1fr\) 44px 44px/);
  assert.match(css, /grid-column: 1 \/ -1/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /text-overflow: ellipsis/);
  assert.doesNotMatch(css, /position: fixed/);
});
test("all provider calls use the worker-compatible redirect guard", () => {
  const server = read("lib/super-ai.functions.ts");
  assert.equal((server.match(/await fetchAiProvider\(/g) ?? []).length, 4);
  assert.doesNotMatch(server, /redirect: "error"|await fetch\(/);
});
test("manual provider fetch accepts 2xx and retains normal 4xx/5xx handling without retries", async () => {
  for (const status of [200, 400, 401, 429, 500]) {
    let calls = 0;
    const response = await fetchAiProvider(
      "https://provider.test",
      { method: "POST", headers: { authorization: "Bearer test-not-secret" } },
      (async (_url, init) => {
        calls++;
        assert.equal(init?.redirect, "manual");
        return new Response("{}", { status });
      }) as typeof fetch,
    );
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});
test("all redirects are rejected without following or leaking Location/credentials", async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    let calls = 0;
    await assert.rejects(
      fetchAiProvider("https://provider.test", {}, (async () => {
        calls++;
        return new Response(null, { status, headers: { location: "https://private.test/token" } });
      }) as typeof fetch),
      (error: Error) => {
        assert.match(error.message, /nicht verfolgt/);
        assert.doesNotMatch(error.message, /private.test|token/);
        return true;
      },
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    fetchAiProvider("https://provider.test", {}, (async () => ({
      status: 0,
      type: "opaqueredirect",
    })) as typeof fetch),
    /nicht verfolgt/,
  );
});
test("transport failure propagates once without automatic retries", async () => {
  let calls = 0;
  await assert.rejects(
    fetchAiProvider("https://provider.test", {}, (async () => {
      calls++;
      throw new TypeError("Load failed");
    }) as typeof fetch),
    /Load failed/,
  );
  assert.equal(calls, 1);
});
