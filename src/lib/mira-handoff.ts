import { getAloOwner, listAlo, putAlo, signalAlo } from "./alo-store";
import { loadSessions, newSessionId } from "./super-ai-tools";

export type MiraDraftChoice = "keep" | "append" | "new";
export function miraDraftId(sessionId: string): string {
  const scoped = `draft:mira:${sessionId}`;
  return listAlo("draft").some((row) => row.id === scoped) ? scoped : "draft:mira";
}
export function readMiraDraft(sessionId: string): string {
  return String(listAlo("draft").find((row) => row.id === miraDraftId(sessionId))?.body.text ?? "");
}
const activeSessionKey = () => `alo-active-mira:${getAloOwner() ?? "guest"}`;
export function rememberMiraSession(sessionId: string) {
  window.sessionStorage.setItem(activeSessionKey(), sessionId);
}
export function currentMiraSession(): string {
  const current = window.sessionStorage.getItem(activeSessionKey());
  return current || loadSessions()[0]?.id || "";
}
export function previewMiraDraft(existing: string, incoming: string, choice: MiraDraftChoice) {
  return choice === "keep"
    ? existing
    : choice === "append" && existing.trim()
      ? `${existing}\n\n${incoming}`
      : incoming;
}
/** No provider calls, grants or source loading. A changed draft requires another review. */
export function handoffToMira(options: {
  userId: string;
  sessionId: string;
  expectedDraft: string;
  text: string;
  choice: MiraDraftChoice;
}) {
  const { userId, sessionId, expectedDraft, text, choice } = options;
  if (getAloOwner() !== userId) throw new Error("Konto geändert. Bitte die Aktion erneut öffnen.");
  const draftId = miraDraftId(sessionId);
  const actual = String(
    listAlo("draft", userId).find((row) => row.id === draftId)?.body.text ?? "",
  );
  if (actual !== expectedDraft)
    throw new Error("Der Mira-Entwurf wurde inzwischen geändert. Bitte erneut öffnen und prüfen.");
  let target = sessionId;
  if (choice === "new") {
    target = newSessionId();
    // Keep the existing draft intact; each explicitly created chat gets its own draft.
    putAlo("draft", { target: "mira", text, sessionId: target }, `draft:mira:${target}`, userId);
    putAlo(
      "mira",
      {
        id: target,
        title: "Neuer Chat · Entwurf",
        updatedAt: new Date().toISOString(),
        messages: [],
      },
      `mira:${target}`,
      userId,
    );
  } else if (choice !== "keep") {
    putAlo(
      "draft",
      { target: "mira", text: previewMiraDraft(actual, text, choice) },
      draftId,
      userId,
    );
  }
  if (target) window.sessionStorage.setItem("alo-open-mira", target);
  else window.sessionStorage.removeItem("alo-open-mira");
  signalAlo(true);
  return target;
}
