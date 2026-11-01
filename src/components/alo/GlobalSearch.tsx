import { searchArea, type SearchArea } from "@/lib/alo-ui";
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { detectChatMode, loadChatStore, loadRoomsForUser } from "@/lib/chat-backend";
import { listAlo, searchAlo } from "@/lib/alo-store";
import { loadSessions } from "@/lib/super-ai-tools";
import { ContentActions } from "./ContentActions";
type Hit = {
  id: string;
  title: string;
  text: string;
  source: string;
  path: "/" | "/ai" | "/chat" | "/programs" | "/profile";
  aloTab?: "today" | "collections";
  sessionId?: string;
  roomId?: string;
  messageId?: string;
};
const SETTINGS: Hit[] = [
  {
    id: "settings-design",
    title: "Design & Navigation",
    text: "Einstellungen Farbwelt Theme Stil vier Navigationslayouts sechs Stile dreizehn Farben Widgets Swipe",
    source: "Einstellungen",
    path: "/profile",
  },
  {
    id: "settings-ai",
    title: "Mira-Anbieter und Zugangsdaten",
    text: "KI Einstellungen API Schlüssel Modell",
    source: "Einstellungen",
    path: "/ai",
  },
  {
    id: "settings-privacy",
    title: "Daten & Datenschutz",
    text: "Mira-Datenfreigabe Speicherort Synchronisierung Löschen",
    source: "Einstellungen",
    path: "/profile",
  },
  {
    id: "settings-notifications",
    title: "Benachrichtigungen",
    text: "Erinnerungen Mitteilungen Training Einstellungen",
    source: "Einstellungen",
    path: "/profile",
  },
];
export function GlobalSearch({
  userId,
  onNavigate,
  onPrivacy,
  onOpenAlo,
}: {
  userId: string;
  onNavigate: () => void;
  onPrivacy: () => void;
  onOpenAlo: (tab: "today" | "collections") => void;
}) {
  const [area, setArea] = useState<SearchArea>("all");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState(
    "Suche lokal in Mira und Alo; Nexus und Trainingspläne werden bei einer Suche über ihre bestehende Datenanbindung geladen. Kein KI-Anbieter erhält die Suche.",
  );
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const run = async () => {
    const q = query.trim();
    const token = ++request.current;
    if (!q) {
      setHits([]);
      return;
    }
    setBusy(true);
    const all: Hit[] = [...SETTINGS];
    const warnings: string[] = [];
    for (const session of loadSessions()) {
      for (const [i, m] of session.messages.entries())
        all.push({
          id: `${session.id}:${i}`,
          title: session.title,
          text: `${m.content}${m.plan ? `\nPlan: ${m.plan.title} · ${m.plan.sets} × ${m.plan.reps}` : ""}`,
          source: m.plan ? "Mira · Trainingsvorschlag" : "Mira",
          path: "/ai",
          sessionId: session.id,
        });
    }
    for (const row of listAlo(undefined, userId).filter((r) =>
      ["capture", "note", "task", "collection"].includes(r.kind),
    ))
      all.push({
        id: row.id,
        title: String(
          (row.body.title ?? row.kind === "note") ? (row.body.title ?? "Trainingsnotiz") : "Alo",
        ),
        text: String(row.body.text ?? row.body.title ?? ""),
        source:
          row.kind === "note"
            ? "Training · Notiz"
            : `Alo · ${String(row.body.source ?? ({ capture: "Ablage", task: "Aufgabe", collection: "Sammlung" } as Record<string, string>)[row.kind] ?? "Alo")}`,
        path: row.kind === "note" ? "/" : "/ai",
        aloTab: row.kind === "note" ? undefined : row.kind === "task" ? "today" : "collections",
      });
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id,title,description")
        .limit(200);
      if (error) warnings.push("Trainingsprogramme nicht erreichbar");
      for (const p of data ?? [])
        all.push({
          id: p.id,
          title: p.title,
          text: p.description,
          source: "Training · Programm",
          path: "/programs",
        });
      const plans = await supabase
        .from("training_plans")
        .select("id,summary,week_start")
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(100);
      if (plans.error) warnings.push("Gespeicherte Wochenpläne nicht erreichbar");
      for (const p of plans.data ?? [])
        all.push({
          id: p.id,
          title: `Wochenplan ${p.week_start}`,
          text: p.summary,
          source: "Training · Wochenplan",
          path: "/ai",
        });
      const mode = await detectChatMode();
      const rooms = await loadRoomsForUser(userId);
      if (mode === "local") {
        const store = loadChatStore(userId);
        for (const m of store.messages)
          all.push({
            id: m.id,
            title:
              rooms.find((r) => r.id === m.room_id)?.name ??
              store.dms.find((d) => d.id === m.conversation_id)?.other_name ??
              "Nexus",
            text: m.content,
            source: "Nexus · nur auf diesem Gerät",
            path: "/chat",
            roomId: m.room_id ?? undefined,
            messageId: m.id,
          });
      } else {
        // Query via ordinary authenticated REST and existing RLS, never a definer search bypass.
        const term = q.split(/\s+/)[0].replace(/[\\%_]/g, "\\$&");
        const msgs = await supabase
          .from("messages" as never)
          .select("id,content,room_id,conversation_id")
          .ilike("content", `%${term}%`)
          .order("created_at", { ascending: false })
          .limit(100);
        if (msgs.error) warnings.push("Nexus Cloud-Suche fehlgeschlagen");
        for (const m of (msgs.data ?? []) as unknown as Array<{
          id: string;
          content: string;
          room_id: string | null;
        }>)
          all.push({
            id: m.id,
            title: rooms.find((r) => r.id === m.room_id)?.name ?? "Zugängliche Unterhaltung",
            text: m.content,
            source: "Nexus · Cloud",
            path: "/chat",
            roomId: m.room_id ?? undefined,
            messageId: m.id,
          });
      }
    } catch {
      warnings.push("Netzwerkdaten nicht vollständig geladen");
    }
    if (token !== request.current) return;
    const results = searchAlo(all, q);
    setHits(results.slice(0, 100));
    setBusy(false);
    setStatus(
      `${results.length} Treffer. ${warnings.length ? warnings.join("; ") + ". Lokale Suche bleibt verfügbar." : "Quellen geladen."} Cloud-Suche: bis zu 100 Nexus-Treffer, 100 Wochenpläne und 200 Programme; kein vollständiges Archiv oder Anhang-OCR.`,
    );
  };
  return (
    <div className="space-y-3">
      <h2 className="sr-only">Überall suchen</h2>
      <form
        className="alo-search-form flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          aria-label="Überall suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Training, Mira, Nexus, Einstellungen …"
        />
        <button type="submit" className="alo-btn-primary" disabled={busy || !query.trim()}>
          {busy ? "Sucht …" : "Suchen"}
        </button>
      </form>
      <label>
        Bereich
        <select
          aria-label="Suche nach Bereich filtern"
          value={area}
          onChange={(e) => setArea(e.target.value as SearchArea)}
        >
          <option value="all">Alle Bereiche</option>
          <option value="training">Training</option>
          <option value="mira">Mira</option>
          <option value="nexus">Nexus</option>
          <option value="alo">Alo & Einstellungen</option>
        </select>
      </label>
      {query.trim() &&
        !busy &&
        hits.filter((h) => area === "all" || searchArea(h.source) === area).length === 0 && (
          <p className="alo-empty-state">
            Noch kein passender Treffer. Nutze einen kürzeren Suchbegriff oder wähle „Alle
            Bereiche“.
          </p>
        )}
      <p role="status" className="text-xs text-muted-foreground">
        {status}
      </p>
      {hits
        .filter((h) => area === "all" || searchArea(h.source) === area)
        .map((h) => (
          <article className="alo-card" key={`${h.source}:${h.id}`}>
            <p className="text-xs font-semibold text-primary">{h.source}</p>
            <h3 className="font-semibold">{h.title}</h3>
            <p className="line-clamp-4 whitespace-pre-wrap text-sm">{h.text}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {h.aloTab ? (
                <button className="alo-btn" onClick={() => onOpenAlo(h.aloTab!)}>
                  Quelle öffnen
                </button>
              ) : h.id === "settings-privacy" ? (
                <button className="alo-btn" onClick={onPrivacy}>
                  Öffnen
                </button>
              ) : (
                <Link
                  to={h.path}
                  className="text-sm font-semibold text-primary"
                  onClick={() => {
                    if (h.sessionId) window.sessionStorage.setItem("alo-open-mira", h.sessionId);
                    if (h.roomId)
                      window.sessionStorage.setItem(
                        "alo-open-nexus",
                        JSON.stringify({ kind: "room", id: h.roomId, messageId: h.messageId }),
                      );
                    onNavigate();
                  }}
                >
                  Quelle öffnen
                </Link>
              )}
              <ContentActions
                userId={userId}
                title={h.title}
                text={h.text}
                source={h.source}
                onMiraNavigate={onNavigate}
              />
            </div>
          </article>
        ))}
    </div>
  );
}
