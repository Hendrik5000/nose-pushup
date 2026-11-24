import { searchArea, type SearchArea } from "@/lib/alo-ui";
import { useEffect, useRef, useState } from "react";
import { forgetRecentSearches, loadRecentSearches, rememberSearch } from "@/lib/search-recent";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { detectChatMode, loadChatStore, loadRoomsForUser } from "@/lib/chat-backend";
import { listAlo, searchAlo } from "@/lib/alo-store";
import { loadSessions } from "@/lib/super-ai-tools";
import { FOOTBALL_LEAGUES } from "@/lib/football";
import { EXERCISE_CONFIG } from "@/lib/exercises";
import { listMiraMarketplaceDrafts } from "@/lib/mira-marketplace-drafts";
import type { AloWorkspaceToolId } from "@/lib/home-app-menus";
import type { PrivateGameId } from "@/lib/private-game-policy";
import {
  MARKETPLACE_CATALOG,
  type MarketplaceCategory,
  type MarketplaceRouteTarget,
} from "@/lib/marketplace";
import { ContentActions } from "./ContentActions";
type Hit = {
  id: string;
  title: string;
  text: string;
  source: string;
  path: "/" | "/ai" | "/chat" | "/games" | "/programs" | "/profile" | MarketplaceRouteTarget;
  aloTab?: "today" | "collections";
  sessionId?: string;
  roomId?: string;
  messageId?: string;
  gameId?: PrivateGameId;
  toolId?: AloWorkspaceToolId;
  exerciseId?: string;
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
const APP_CATEGORY_LABELS = {
  app: "Alo-App",
  area: "Bereich",
  tool: "Werkzeug",
} satisfies Record<MarketplaceCategory, string>;
const APP_HITS: Hit[] = MARKETPLACE_CATALOG.map((plugin) => ({
  id: plugin.id,
  title: plugin.name,
  text: `${plugin.description} (${APP_CATEGORY_LABELS[plugin.category]} · ${plugin.publisher})`,
  source: "App · Marketplace",
  path:
    plugin.action.type === "navigate"
      ? plugin.action.to
      : plugin.action.type === "open-game"
        ? "/games"
        : "/",
  gameId: plugin.action.type === "open-game" ? plugin.action.gameId : undefined,
  toolId: plugin.action.type === "open-tool" ? plugin.action.toolId : undefined,
}));
const FOOTBALL_LEAGUE_HITS: Hit[] = FOOTBALL_LEAGUES.map((league) => ({
  id: league.id,
  title: league.name,
  text:
    league.id === "deutschland"
      ? "Alo Fußball Nationalmannschaft Deutschland Länderspiele Termine Ergebnisse"
      : `Alo Fußball ${league.name} Tabelle Spieltage Ergebnisse Saison`,
  source: "Alo Fußball · Liga",
  path: "/football",
}));
const EXERCISE_HITS: Hit[] = Object.entries(EXERCISE_CONFIG)
  .filter(([id]) => !id.startsWith("cali_"))
  .map(([id, config]) => ({
    id,
    title: config.repLabel,
    text: `${config.repLabel} Übung in Alo Health · Training und Bestwert ${config.idleHint}`,
    source: "Alo Health · Übung",
    path: "/exercises",
    exerciseId: id,
  }));
export function GlobalSearch({
  userId,
  onNavigate,
  onPrivacy,
  onOpenAlo,
}: {
  userId: string;
  onNavigate: () => void;
  onPrivacy: () => void;
  onOpenAlo: (tab: AloWorkspaceToolId) => void;
}) {
  const [area, setArea] = useState<SearchArea>("all");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState(
    "Sucht lokal in Mira, Alo, Apps, Spielen und Einstellungen sowie in Fußball-Ligen und Health-Übungen; App-Entwürfe, Nexus und Trainingspläne werden bei einer Suche über ihre bestehende Datenanbindung geladen. Kein KI-Anbieter erhält die Suche.",
  );
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const request = useRef(0);
  useEffect(() => {
    setRecent(loadRecentSearches(window.localStorage, userId));
  }, [userId]);
  const run = async (searchValue?: string) => {
    const q = (searchValue ?? query).trim();
    const token = ++request.current;
    if (!q) {
      setHits([]);
      return;
    }
    setBusy(true);
    const all: Hit[] = [...SETTINGS, ...APP_HITS, ...FOOTBALL_LEAGUE_HITS, ...EXERCISE_HITS];
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
    for (const draft of listMiraMarketplaceDrafts(userId))
      all.push({
        id: draft.sessionId,
        title: draft.name,
        text: `Persönliche Marketplace-App (Entwurf von Mira) · ${draft.providerLabel}`,
        source: "Mira · App-Entwurf",
        path: "/ai",
        sessionId: draft.sessionId,
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
    if (results.length > 0) setRecent(rememberSearch(window.localStorage, userId, q));
    setHits(results.slice(0, 100));
    setBusy(false);
    setStatus(
      `${results.length} Treffer. ${warnings.length ? warnings.join("; ") + ". Lokale Suche bleibt verfügbar." : "Quellen geladen."} Apps, Spiele und Werkzeuge werden lokal im Alo-Katalog durchsucht. Cloud-Suche: bis zu 100 Nexus-Treffer, 100 Wochenpläne und 200 Programme; kein vollständiges Archiv oder Anhang-OCR.`,
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
          placeholder="Training, Mira, Nexus, Apps, Spiele …"
        />
        <button type="submit" className="alo-btn-primary" disabled={busy || !query.trim()}>
          {busy ? "Sucht …" : "Suchen"}
        </button>
      </form>
      {!query.trim() && recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Zuletzt gesucht</span>
          {recent.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-label={`Nach ${entry} suchen`}
              onClick={() => {
                setQuery(entry);
                void run(entry);
              }}
              className="alo-btn"
            >
              {entry}
            </button>
          ))}
          <button
            type="button"
            aria-label="Zuletzt gesuchte Begriffe vergessen"
            onClick={() => {
              forgetRecentSearches(window.localStorage, userId);
              setRecent([]);
            }}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Vergessen
          </button>
        </div>
      )}
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
              ) : h.toolId ? (
                <button className="alo-btn" onClick={() => onOpenAlo(h.toolId!)}>
                  Werkzeug öffnen
                </button>
              ) : h.id === "settings-privacy" ? (
                <button className="alo-btn" onClick={onPrivacy}>
                  Öffnen
                </button>
              ) : h.exerciseId ? (
                <Link
                  to="/workout/$exerciseId"
                  params={{ exerciseId: h.exerciseId }}
                  className="text-sm font-semibold text-primary"
                  onClick={onNavigate}
                >
                  Übung öffnen
                </Link>
              ) : h.gameId ? (
                <Link
                  to="/games"
                  search={{ game: h.gameId }}
                  className="text-sm font-semibold text-primary"
                  onClick={onNavigate}
                >
                  Spiel öffnen
                </Link>
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
