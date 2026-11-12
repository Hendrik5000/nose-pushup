import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMiraWorkbenchPrompt,
  getMiraWorkbenchTool,
  MIRA_WORKBENCH_MAX_SOURCE_CHARS,
  MIRA_WORKBENCH_TOOLS,
  type MiraWorkbenchToolId,
} from "../src/lib/mira-workbench";

const source = "Nur dieser ausgewählte Text.";

function promptFor(id: MiraWorkbenchToolId, text = source) {
  return buildMiraWorkbenchPrompt(id, text, { targetLanguage: "Französisch" });
}

test("Entscheidungsvorlage vergleicht Optionen und kennzeichnet Unbekanntes", () => {
  const prompt = promptFor("decision_brief");
  assert.match(prompt ?? "", /Entscheidungsvorlage/);
  assert.match(prompt ?? "", /Vergleichskriterien/);
  assert.match(prompt ?? "", /Nur dieser ausgewählte Text/);
});

test("Risiko-Check verlangt Warnsignale und konkrete Gegenmaßnahmen", () => {
  const prompt = promptFor("risk_review");
  assert.match(prompt ?? "", /Risiko-Check/);
  assert.match(prompt ?? "", /frühes Warnsignal/);
  assert.match(prompt ?? "", /Gegenmaßnahme/);
});

test("Anforderungs-Check trennt Muss, Kann und überprüfbare Abnahme", () => {
  const prompt = promptFor("requirements");
  assert.match(prompt ?? "", /Anforderungen & Abnahme/);
  assert.match(prompt ?? "", /Abnahmekriterien/);
  assert.match(prompt ?? "", /Muss- von Kann-Anforderungen/);
});

test("Projektplan benennt Abhängigkeiten und erfindet keine Termine", () => {
  const prompt = promptFor("project_plan");
  assert.match(prompt ?? "", /Projektplan/);
  assert.match(prompt ?? "", /Abhängigkeiten/);
  assert.match(prompt ?? "", /Erfinde keine Termine/);
});

test("Meeting-Vorbereitung erstellt Agenda und markiert fehlende Angaben", () => {
  const prompt = promptFor("meeting_brief");
  assert.match(prompt ?? "", /Meeting-Vorbereitung/);
  assert.match(prompt ?? "", /Agenda/);
  assert.match(prompt ?? "", /Erfinde keine Teilnehmenden/);
});

test("E-Mail-Modus erzeugt einen Entwurf mit Platzhaltern, aber versendet nichts", () => {
  const prompt = promptFor("email_draft");
  assert.match(prompt ?? "", /E-Mail-Entwurf/);
  assert.match(prompt ?? "", /Platzhalter/);
  assert.match(prompt ?? "", /Sende die Nachricht nicht/);
});

test("Gesprächsprobe stellt genau eine Einstiegsfrage und wartet", () => {
  const prompt = promptFor("conversation_rehearsal");
  assert.match(prompt ?? "", /Gesprächsprobe/);
  assert.match(prompt ?? "", /genau eine kurze/);
  assert.match(prompt ?? "", /warte anschließend/);
});

test("Wissensquiz bleibt auf fünf Fragen aus dem ausgewählten Quelltext begrenzt", () => {
  const prompt = promptFor("study_quiz");
  assert.match(prompt ?? "", /Wissensquiz/);
  assert.match(prompt ?? "", /genau fünf/);
  assert.match(prompt ?? "", /ausschließlich anhand des Quelltexts/);
});

test("Karteikarten begrenzen Anzahl und Fakten auf die Quelle", () => {
  const prompt = promptFor("flashcards");
  assert.match(prompt ?? "", /Karteikarten/);
  assert.match(prompt ?? "", /bis zu zwölf/);
  assert.match(prompt ?? "", /aus dem Quelltext ableitbar/);
});

test("Übersetzung braucht eine Zielsprache und verändert den Inhalt nicht", () => {
  assert.equal(buildMiraWorkbenchPrompt("translation", source), null);
  const prompt = buildMiraWorkbenchPrompt("translation", source, {
    targetLanguage: "Französisch",
  });
  assert.match(prompt ?? "", /in Französisch/);
  assert.match(prompt ?? "", /Füge keine Erläuterungen/);
});

test("jeder Werkbankmodus ist eindeutig benannt und auf 6000 Quellzeichen begrenzt", () => {
  assert.equal(MIRA_WORKBENCH_TOOLS.length, 10);
  assert.equal(new Set(MIRA_WORKBENCH_TOOLS.map((tool) => tool.id)).size, 10);
  assert.equal(getMiraWorkbenchTool("not-a-tool"), null);
  const oversized = "x".repeat(MIRA_WORKBENCH_MAX_SOURCE_CHARS + 100);
  const prompt = buildMiraWorkbenchPrompt("risk_review", oversized);
  const echoedSource = prompt
    ?.split("--- Ausgewählter Quelltext ---\n\n")[1]
    ?.split("\n\n--- Ende des Quelltexts ---")[0];
  assert.equal(echoedSource?.length, MIRA_WORKBENCH_MAX_SOURCE_CHARS);
});

test("Werkbank-Prompt enthält nur explizit übergebenen Text und keine zweite Kontextquelle", () => {
  const prompt = buildMiraWorkbenchPrompt("meeting_brief", source);
  assert.match(prompt ?? "", /Nur dieser ausgewählte Text/);
  assert.doesNotMatch(prompt ?? "", /private-health-record-sentinel/);
  assert.doesNotMatch(prompt ?? "", /frühere Chats:.*private-health-record-sentinel/s);
});
