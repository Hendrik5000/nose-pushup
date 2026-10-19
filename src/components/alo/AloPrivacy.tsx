import { useState } from "react";
import {
  aloKey,
  cloudEnabled,
  listAlo,
  putAlo,
  readRecords,
  removeAlo,
  resolveConflict,
  saveMiraGrants,
  setCloudEnabled,
  signalAlo,
} from "@/lib/alo-store";
import { eraseCloudWorkspace, getSyncState, resetSyncState, syncAlo } from "@/lib/alo-sync";
import { MiraContextControls } from "./MiraContextControls";
export function AloPrivacy({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const records = readRecords(userId);
  const enabled = cloudEnabled(userId);
  const sync = getSyncState();
  const legacy = ["super-ai-sessions-v2", "np-workout-notes"].some((k) =>
    window.localStorage.getItem(k),
  );
  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  const toggleSync = () => {
    if (
      !enabled &&
      !window.confirm(
        "Auf allen Geräten aktivieren? Deine Alo-Ablage einschließlich kleiner Anhänge, Aufgaben, Sammlungen, Schnellaktionen, Trainingsnotizen, Mira-Verläufe und Entwürfe werden im angemeldeten Konto in Supabase gespeichert. Keine KI-API-Schlüssel und keine Mira-Freigaben. RLS schützt das Konto; dies ist keine Ende-zu-Ende-Verschlüsselung. Für andere Geräte benötigst du dasselbe reguläre Konto. Fortfahren?",
      )
    )
      return;
    setCloudEnabled(!enabled, userId);
    if (!enabled) void run(() => syncAlo(userId));
    else {
      resetSyncState();
      setMessage("Synchronisierung aus. Bereits gespeicherte Cloudkopien bleiben dort bestehen.");
    }
  };
  const exportData = () => {
    const data = {
      format: "alo-workspace-v1",
      exportedAt: new Date().toISOString(),
      userId,
      records: readRecords(userId),
      localNexus: window.localStorage.getItem(`nose-pushup-local-chat:${userId}`),
      localChatPreferences: window.localStorage.getItem(`np-chat-prefs:${userId}`),
      localChatDrafts: window.localStorage.getItem(`np-chat-drafts:${userId}`),
    };
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = href;
    link.download = "alo-meine-daten.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
    setMessage(
      "Export gestartet. Enthält lokale Alo-Daten und lokale Nexus-Kopie, nicht das vollständige Cloud-Chatarchiv, Gesundheitsdaten oder Backups.",
    );
  };
  const eraseLocal = () => {
    if (
      !window.confirm(
        "Nur lokale Alo-Kopie dieses Kontos auf diesem Gerät löschen? Ablage, Mira-Verläufe, Aufgaben, Sammlungen, Notizen und Entwürfe werden entfernt. Synchronisierung und Mira-Freigaben werden ausgeschaltet. Cloudkopien, echte Trainingswerte und Nexus-Nachrichten bleiben erhalten. Cloud-Daten können beim späteren Einschalten wieder heruntergeladen werden.",
      )
    )
      return;
    setCloudEnabled(false, userId);
    saveMiraGrants({ training: false, rooms: [] }, userId);
    window.localStorage.removeItem(aloKey(userId));
    window.localStorage.removeItem(`np-chat-drafts:${userId}`);
    signalAlo(true);
    resetSyncState();
    setMessage(
      "Lokale Alo-Kopie gelöscht; Cloudkopien bleiben unverändert. Andere offene Tabs bitte neu laden.",
    );
  };
  const eraseBoth = async () => {
    if (
      !window.confirm(
        "Alo-Arbeitsbereich lokal UND in der Cloud löschen? Dies betrifft Ablage samt Anhängen, Mira-Verläufe, Aufgaben, Sammlungen, Schnellaktionen, Notizen und Entwürfe dieses Kontos. Nicht betroffen: ursprüngliche Trainings-/Gesundheitsdaten, Nexus-Nachrichten, Raumdateien, KI-Anbieter-Daten und Backups des Datenbankbetreibers. Aktive Geräte müssen danach erneut abgleichen. Fortfahren?",
      )
    )
      return;
    setCloudEnabled(false, userId);
    await eraseCloudWorkspace(userId);
    saveMiraGrants({ training: false, rooms: [] }, userId);
    window.localStorage.removeItem(`np-chat-drafts:${userId}`);
    signalAlo(true);
    resetSyncState();
    setMessage(
      "Alo-Cloudinhalte gelöscht, lokale Kopie geleert. Inhaltsfreie Löschmarkierungen verhindern stilles Wiederherstellen durch alte Geräte. Offline-Konflikte müssen dort als Cloud-Version verworfen werden. Andere Daten und Backups nicht gelöscht.",
    );
  };
  const importLegacy = () => {
    if (
      !window.confirm(
        "Alte, nicht kontogebundene Mira-Chats und Trainingsnotizen auf diesem Browser diesem Konto zuordnen? Bitte nur bestätigen, wenn diese Inhalte dir gehören. Die Originalschlüssel bleiben als Sicherung erhalten und werden nicht automatisch synchronisiert, solange Cloud aus ist.",
      )
    )
      return;
    const sessions = JSON.parse(window.localStorage.getItem("super-ai-sessions-v2") ?? "[]");
    const notes = JSON.parse(window.localStorage.getItem("np-workout-notes") ?? "[]");
    if (!Array.isArray(sessions) || !Array.isArray(notes))
      throw new Error("Alte Sicherung ist nicht lesbar; unverändert erhalten.");
    for (const s of sessions)
      if (
        typeof s?.id === "string" &&
        Array.isArray(s.messages) &&
        typeof s.updatedAt === "string" &&
        !listAlo("mira", userId).some((r) => r.id === `mira:${s.id}`)
      )
        putAlo("mira", s, `mira:${s.id}`, userId);
    for (const n of notes)
      if (
        typeof n?.id === "string" &&
        typeof n.text === "string" &&
        !listAlo("note", userId).some((r) => r.id === `note:${n.id}`)
      )
        putAlo("note", n, `note:${n.id}`, userId);
    signalAlo(true);
    setMessage(
      "Alte Inhalte diesem Konto zugeordnet; Ursprungsdateien im Browserspeicher bleiben erhalten.",
    );
  };
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Daten & Datenschutz</h2>
      <section className="alo-card space-y-3">
        <h3 className="font-semibold">Mira-Datenfreigabe</h3>
        <MiraContextControls userId={userId} />
      </section>
      <section className="alo-card space-y-3">
        <h3 className="font-semibold">Auf allen Geräten</h3>
        <p className="text-xs">
          {enabled ? sync.message : "Nur auf diesem Gerät · Synchronisierung aus"}
        </p>
        <p className="text-xs text-muted-foreground">
          {records.filter((r) => !r.deleted).length} lokale Inhalte ·{" "}
          {records.filter((r) => r.dirty).length} Änderungen vorgemerkt. Cloud-Abgleich nur mit
          eingerichteter Alo-Datenbankmigration. Nexus-Cloudnachrichten verwenden unabhängig hiervon
          das bestehende Chat-Backend; lokale Nexus-Testchats werden nicht automatisch hochgeladen.
        </p>
        <button className="alo-btn-primary" disabled={busy} onClick={toggleSync}>
          {enabled ? "Synchronisierung ausschalten" : "Auf allen Geräten aktivieren"}
        </button>
        <button
          className="alo-btn"
          disabled={!enabled || busy}
          onClick={() => void run(() => syncAlo(userId))}
        >
          Jetzt abgleichen
        </button>
        <p className="text-xs text-muted-foreground">
          Ablage: lokaler Browserspeicher (nicht verschlüsselt) und optional Supabase mit
          Kontozugriffsregeln. Kein Ende-zu-Ende-Schutz; Gerätezugang schützen. Anonyme Gastkonten
          lassen sich nicht verlässlich geräteübergreifend wiederherstellen. Sichere Anmeldung
          verwenden.
        </p>
      </section>
      {records
        .filter((r) => r.conflict)
        .map((r) => (
          <section key={r.id} className="alo-card space-y-2">
            <h3 className="font-semibold">Konflikt: {String(r.body.title ?? r.kind)}</h3>
            <p className="text-xs">
              Beide Versionen bleiben bis zu deiner Wahl erhalten. Cloud-Löschung bedeutet, dass ein
              anderes Gerät gelöscht hat.
            </p>
            <details>
              <summary>Lokale Version ansehen</summary>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                {r.deleted ? "Gelöscht" : JSON.stringify(r.body, null, 2)}
              </pre>
            </details>
            <details>
              <summary>Cloud-Version ansehen</summary>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                {r.conflict?.deleted ? "Gelöscht" : JSON.stringify(r.conflict?.body, null, 2)}
              </pre>
            </details>
            <button
              className="alo-btn"
              onClick={() => {
                if (
                  window.confirm(
                    "Lokale Version behalten und Cloud-Version beim nächsten Abgleich ersetzen?",
                  )
                )
                  resolveConflict(r.id, "local", userId);
              }}
            >
              Lokale Version behalten
            </button>
            <button
              className="alo-btn"
              onClick={() => {
                if (
                  window.confirm(
                    "Cloud-Version übernehmen? Lokale abweichende Bearbeitung wird verworfen.",
                  )
                ) {
                  resolveConflict(r.id, "remote", userId);
                  signalAlo(true);
                }
              }}
            >
              Cloud-Version übernehmen
            </button>
          </section>
        ))}
      <section className="alo-card space-y-3">
        <h3 className="font-semibold">Export & kontrolliertes Löschen</h3>
        <p className="text-xs text-muted-foreground">
          Der Alo-Arbeitsbereich ist getrennt von Original-Trainingsdaten, Nexus-Cloudnachrichten
          und Raumwerkzeugen. Kopien in Sammlungen bleiben erhalten, wenn ihr Original gelöscht
          wird; jede Kopie lässt sich separat löschen. Entfernte Sammlungen löschen enthaltene
          Ablagekopien nicht.
        </p>
        <button className="alo-btn" disabled={busy} onClick={() => void run(exportData)}>
          Meine lokalen Alo-Daten exportieren
        </button>
        <button
          className="alo-btn text-destructive"
          disabled={busy}
          onClick={() => void run(eraseLocal)}
        >
          Nur lokale Alo-Kopie löschen
        </button>
        <button
          className="alo-btn text-destructive"
          disabled={busy}
          onClick={() => void run(eraseBoth)}
        >
          Alo lokal und in der Cloud löschen
        </button>
        <button
          className="alo-btn"
          disabled={busy}
          onClick={() =>
            void run(() => {
              if (
                window.confirm(
                  "Alle Mira-Verläufe und Mira-Entwürfe dieses Kontos im Alo-Arbeitsbereich löschen? Bei aktivierter Synchronisierung wird die Löschung in die Cloud übertragen. Bereits gesendete Inhalte beim KI-Anbieter bleiben unberührt.",
                )
              ) {
                for (const r of listAlo(undefined, userId).filter(
                  (r) => r.kind === "mira" || (r.kind === "draft" && r.body.target === "mira"),
                ))
                  removeAlo(r.id, userId);
                signalAlo(true);
                setMessage(
                  "Mira-Verläufe lokal gelöscht; Cloud-Löschung ist bei aktiver Synchronisierung vorgemerkt.",
                );
              }
            })
          }
        >
          Mira-Verläufe gezielt löschen
        </button>
      </section>
      {legacy && (
        <section className="alo-card space-y-2">
          <h3 className="font-semibold">Alte lokale Inhalte</h3>
          <p className="text-xs text-muted-foreground">
            Es gibt alte Mira-/Notizschlüssel ohne Kontozuordnung. Aus Datenschutzgründen werden sie
            nicht automatisch angezeigt oder übernommen. Sie sind nicht Teil der Alo-Löschung.
          </p>
          <button className="alo-btn" onClick={() => void run(importLegacy)}>
            Alte Inhalte diesem Konto zuordnen
          </button>
          <button
            className="alo-btn text-destructive"
            onClick={() => {
              if (
                window.confirm(
                  "Alte, nicht kontogebundene Mira-Chats und Trainingsnotizen auf diesem Browser endgültig löschen? Diese Sicherung könnte Daten anderer Nutzer dieses Geräts enthalten.",
                )
              ) {
                window.localStorage.removeItem("super-ai-sessions-v2");
                window.localStorage.removeItem("np-workout-notes");
                signalAlo();
                setMessage("Alte lokale Sicherung gelöscht.");
              }
            }}
          >
            Alte lokale Sicherung löschen
          </button>
        </section>
      )}
      {message && (
        <p role="status" className="alo-card text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
