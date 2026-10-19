import { useEffect, useState } from "react";
import {
  ALO_EVENT,
  ALO_REMOTE_EVENT,
  getMiraGrants,
  saveMiraGrants,
  type MiraGrants,
} from "@/lib/alo-store";
import { loadRoomsForUser, type LocalRoom } from "@/lib/chat-backend";
export function MiraContextControls({ userId }: { userId: string }) {
  const [grants, setGrants] = useState(getMiraGrants);
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setGrants(getMiraGrants(userId));
    refresh();
    window.addEventListener(ALO_EVENT, refresh);
    window.addEventListener(ALO_REMOTE_EVENT, refresh);
    void loadRoomsForUser(userId)
      .then(setRooms)
      .catch(() => setError("Raumliste nicht verfügbar."));
    return () => {
      window.removeEventListener(ALO_EVENT, refresh);
      window.removeEventListener(ALO_REMOTE_EVENT, refresh);
    };
  }, [userId]);
  const update = (next: MiraGrants, source: string, enabling: boolean) => {
    if (
      enabling &&
      !window.confirm(
        `${source} für Mira freigeben? Beim nächsten Senden gehen diese Daten an deinen gewählten KI-Anbieter. Freigabe gilt auf diesem Gerät bis zum Widerruf. Bereits gesendete Daten beim Anbieter werden dadurch nicht gelöscht.`,
      )
    )
      return;
    try {
      saveMiraGrants(next, userId);
      setError("");
    } catch {
      setError("Freigabe konnte nicht gespeichert werden.");
    }
  };
  return (
    <section className="alo-context space-y-3 text-sm" aria-label="Mira Datenfreigaben">
      <p className="text-xs text-muted-foreground">
        Standardmäßig alles aus. Freigaben gelten nur für dieses Konto und dieses Gerät. Bereits an
        KI-Anbieter gesendete Daten lassen sich hier nicht zurückholen.
      </p>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={grants.training}
          onChange={(e) =>
            update(
              { ...getMiraGrants(userId), training: e.target.checked },
              "Trainingsprofil, letzte Trainings und Gesundheitswerte",
              e.target.checked,
            )
          }
        />
        <span>Nose-Pushup: Trainingsprofil, Trainings und Gesundheitswerte</span>
      </label>
      <p className="text-xs font-semibold">
        Nexus: nur ausdrücklich ausgewählte Räume (bis zu 20 letzte Nachrichten je Raum, insgesamt
        höchstens 40)
      </p>
      {rooms.map((room) => (
        <label className="flex items-center gap-2" key={room.id}>
          <input
            type="checkbox"
            checked={grants.rooms.includes(room.id)}
            onChange={(e) =>
              update(
                {
                  ...getMiraGrants(userId),
                  rooms: e.target.checked
                    ? [...getMiraGrants(userId).rooms.filter((id) => id !== room.id), room.id]
                    : getMiraGrants(userId).rooms.filter((id) => id !== room.id),
                },
                `Nachrichten aus „${room.name}“`,
                e.target.checked,
              )
            }
          />
          <span>{room.name}</span>
        </label>
      ))}
      {!rooms.length && (
        <p className="text-xs text-muted-foreground">
          Keine zugänglichen Räume geladen. Direktnachrichten werden nicht freigegeben.
        </p>
      )}
      <p className="rounded-xl bg-secondary/50 p-3 text-xs" role="status">
        Beim Senden zusätzlich:{" "}
        {grants.training ? "Trainingsprofil + Trainings + Gesundheit" : "keine Trainingsdaten"};
        Nexus:{" "}
        {rooms
          .filter((r) => grants.rooms.includes(r.id))
          .map((r) => r.name)
          .join(", ") || "keine Räume"}
        . Dazu gehen deine Frage und der aktuelle Mira-Chatverlauf an den KI-Anbieter.
      </p>
      {(grants.training || grants.rooms.length > 0) && (
        <button
          className="alo-btn"
          onClick={() => update({ training: false, rooms: [] }, "", false)}
        >
          Alle Freigaben widerrufen
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
