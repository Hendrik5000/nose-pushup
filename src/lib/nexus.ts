// ─── Nexus Chat integration ─────────────────────────────────────────────────
// Phase 1: hub + deep link. Phase 2: port ChatShell after Lovable migrations.

/** Deployed Nexus-Chat frontend (separate Lovable/Vercel project). */
export const NEXUS_CHAT_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_NEXUS_CHAT_URL) ||
  "https://nexus-chat-ten-lilac.vercel.app";

export function openNexusChat(path = "/") {
  if (typeof window === "undefined") return;
  const url = path.startsWith("http") ? path : `${NEXUS_CHAT_URL.replace(/\/$/, "")}${path}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
