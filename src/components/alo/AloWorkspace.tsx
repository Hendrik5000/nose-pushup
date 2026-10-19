import { readAttachment } from "@/lib/alo-attachments";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Layers, Plus, CalendarDays, ShieldCheck, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ALO_EVENT,
  ALO_REMOTE_EVENT,
  cloudEnabled,
  listAlo,
  localDay,
  putAlo,
  readRecords,
  removeAlo,
  safeLink,
  type AloRecord,
} from "@/lib/alo-store";
import { getSyncState, SYNC_EVENT, syncAlo } from "@/lib/alo-sync";
import { loadRoomsForUser, loadMessages, type LocalRoom } from "@/lib/chat-backend";
import { loadChatPrefs, countUnread } from "@/lib/chat-extras";
import { GlobalSearch } from "./GlobalSearch";
import { QuickCapture } from "./QuickCapture";
import { AloPrivacy } from "./AloPrivacy";
import { ContentActions } from "./ContentActions";
import "@/alo-workspace.css";
const AREA_LABELS: Record<string, string> = {
  all: "Alo",
  nose: "Nose-Pushup",
  mira: "Mira",
  nexus: "Nexus",
};
type Tab = "today" | "search" | "capture" | "collections" | "shortcuts" | "privacy";
const TABS = [
  { id: "today", label: "Tagesübersicht", icon: CalendarDays },
  { id: "search", label: "Überall suchen", icon: Search },
  { id: "capture", label: "Schnell speichern", icon: Plus },
  { id: "collections", label: "Sammlungen", icon: Layers },
  { id: "shortcuts", label: "Schnellaktionen", icon: Zap },
  { id: "privacy", label: "Daten & Datenschutz", icon: ShieldCheck },
] as const;
export function AloWorkspace({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [, refresh] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    const launch = (e: Event) => {
      const next = (e as CustomEvent<Tab>).detail;
      if (TABS.some((t) => t.id === next)) setTab(next);
      setOpen(true);
    };
    const storage = (e: StorageEvent) => {
      if (e.key?.startsWith("alo-") || e.key?.startsWith("np-chat-drafts")) {
        update();
        window.dispatchEvent(new Event(ALO_REMOTE_EVENT));
      }
    };
    const keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("search");
        setOpen(true);
      }
    };
    window.addEventListener(ALO_EVENT, update);
    window.addEventListener(ALO_REMOTE_EVENT, update);
    window.addEventListener(SYNC_EVENT, update);
    window.addEventListener("alo-open", launch);
    window.addEventListener("storage", storage);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener(ALO_EVENT, update);
      window.removeEventListener(ALO_REMOTE_EVENT, update);
      window.removeEventListener(SYNC_EVENT, update);
      window.removeEventListener("alo-open", launch);
      window.removeEventListener("storage", storage);
      window.removeEventListener("keydown", keydown);
    };
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      void syncAlo(userId);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, 900);
    };
    window.addEventListener(ALO_EVENT, schedule);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    const interval = setInterval(sync, 30000);
    sync();
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener(ALO_EVENT, schedule);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, [userId]);
  let rows: AloRecord[] = [];
  try {
    rows = readRecords(userId).filter((r) => !r.deleted);
  } catch (e) {
    if (!error)
      queueMicrotask(() => setError(e instanceof Error ? e.message : "Alo-Speicher nicht lesbar."));
  }
  const sync = getSyncState();
  return (
    <>
      <button
        type="button"
        aria-label="Alo Zentrale öffnen"
        className="alo-launcher"
        onClick={() => setOpen(true)}
      >
        <Layers size={17} />
        <span>Alo</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="alo-dialog alo-workspace">
          <header>
            <DialogTitle>Alo · Alles verbunden</DialogTitle>
            <DialogDescription>
              {cloudEnabled(userId)
                ? sync.message
                : "Nur auf diesem Gerät · Cloud-Synchronisierung aus"}
            </DialogDescription>
          </header>
          <nav aria-label="Alo Werkzeuge" className="alo-tabs">
            {TABS.map((t) => (
              <button
                type="button"
                aria-current={tab === t.id ? "page" : undefined}
                className={tab === t.id ? "is-active" : ""}
                key={t.id}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={16} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="alo-workspace-content">
            {error ? (
              <p role="alert">{error}</p>
            ) : (
              <>
                {tab === "today" && (
                  <Today
                    userId={userId}
                    rows={rows}
                    onCapture={() => setTab("capture")}
                    onNavigate={() => setOpen(false)}
                  />
                )}
                {tab === "search" && (
                  <GlobalSearch
                    userId={userId}
                    onNavigate={() => setOpen(false)}
                    onPrivacy={() => setTab("privacy")}
                    onOpenAlo={setTab}
                  />
                )}
                {tab === "capture" && <QuickCapture userId={userId} />}
                {tab === "collections" && <Collections userId={userId} rows={rows} />}
                {tab === "shortcuts" && (
                  <Shortcuts
                    userId={userId}
                    rows={rows}
                    onTab={setTab}
                    onNavigate={() => setOpen(false)}
                  />
                )}
                {tab === "privacy" && <AloPrivacy userId={userId} />}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Today({
  userId,
  rows,
  onCapture,
  onNavigate,
}: {
  userId: string;
  rows: AloRecord[];
  onCapture: () => void;
  onNavigate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState("");
  const [important, setImportant] = useState<
    Array<{ room: LocalRoom; unread: number; text: string }>
  >([]);
  const [now, setNow] = useState(Date.now());
  const tasks = rows.filter((r) => r.kind === "task");
  const upcoming = tasks
    .filter((r) => !r.body.done && typeof r.body.due === "string")
    .sort((a, b) => String(a.body.due).localeCompare(String(b.body.due)));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const prefs = loadChatPrefs(userId);
      const rooms = (await loadRoomsForUser(userId)).filter((r) =>
        prefs.favoriteRoomIds.includes(r.id),
      );
      const results = await Promise.all(
        rooms.map(async (room) => {
          const { messages } = await loadMessages(userId, { kind: "room", id: room.id });
          return {
            room,
            unread: countUnread(prefs, "room", room.id, messages, userId),
            text: messages.at(-1)?.content ?? "Noch keine Nachrichten",
          };
        }),
      );
      if (active) {
        setImportant(results);
        setStatus(
          rooms.length
            ? "Favorisierte Räume geladen; ungelesene Angaben beziehen sich auf die letzten bis zu 200 Nachrichten."
            : "Markiere Nexus-Räume als Favoriten, um sie hier zu sehen.",
        );
      }
    })().catch(() => {
      if (active) setStatus("Wichtige Chats derzeit nicht erreichbar.");
    });
    return () => {
      active = false;
    };
  }, [userId]);
  const add = () => {
    if (!title.trim()) return;
    const parsed = due ? new Date(due) : null;
    if (parsed && !Number.isFinite(parsed.getTime())) {
      setStatus("Datum ungültig.");
      return;
    }
    try {
      putAlo(
        "task",
        {
          title: title.trim(),
          done: false,
          due: parsed?.toISOString() ?? "",
          source: "Tagesübersicht",
        },
        undefined,
        userId,
      );
      setTitle("");
      setDue("");
      setStatus(
        "Aufgabe gespeichert. Erinnerungen erscheinen in Alo, solange die App geöffnet ist.",
      );
    } catch {
      setStatus("Nicht gespeichert. Gerätespeicher prüfen.");
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-primary">
          {new Date(now).toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h2 className="text-2xl font-semibold">Dein Tag in Alo</h2>
        <p className="text-sm text-muted-foreground">
          Aufgaben, Erinnerungen und wichtige Chats – nicht nur Training.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="alo-card">
          <strong className="text-2xl">{tasks.filter((t) => !t.body.done).length}</strong>
          <p className="text-xs">offen</p>
        </div>
        <div className="alo-card">
          <strong className="text-2xl">
            {upcoming.filter((t) => new Date(String(t.body.due)).getTime() <= now).length}
          </strong>
          <p className="text-xs">fällig</p>
        </div>
        <div className="alo-card">
          <strong className="text-2xl">{important.reduce((sum, r) => sum + r.unread, 0)}</strong>
          <p className="text-xs">Chat ungelesen</p>
        </div>
      </div>
      <section className="alo-card space-y-3">
        <h3 className="font-semibold">Aufgabe oder Erinnerung</h3>
        <input
          aria-label="Neue Aufgabe"
          placeholder="Was steht an?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <label>
          Optional fällig am
          <input
            aria-label="Aufgabe fällig am"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <button type="button" className="alo-btn-primary" disabled={!title.trim()} onClick={add}>
          Aufgabe speichern
        </button>
        <p className="text-xs text-muted-foreground">
          Zeitangaben in deiner Gerätezeitzone. Hinweise in der App, keine zugesicherte
          Push-Benachrichtigung bei geschlossener App.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">Heute & offen</h3>
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Aufgaben. Du kannst oben eine hinzufügen.
          </p>
        )}
        {tasks
          .sort((a, b) => Number(!!a.body.done) - Number(!!b.body.done))
          .map((t) => (
            <div className="alo-card flex items-start gap-3" key={t.id}>
              <input
                type="checkbox"
                aria-label={`${String(t.body.title)} erledigt`}
                checked={!!t.body.done}
                onChange={(e) => {
                  try {
                    putAlo("task", { ...t.body, done: e.target.checked }, t.id, userId);
                  } catch {
                    setStatus("Änderung nicht gespeichert.");
                  }
                }}
              />
              <div className="min-w-0 flex-1">
                <p className={t.body.done ? "line-through" : "font-medium"}>
                  {String(t.body.title)}
                </p>
                {!!t.body.due && (
                  <p
                    role={
                      new Date(String(t.body.due)).getTime() <= now && !t.body.done
                        ? "status"
                        : undefined
                    }
                    className="text-xs text-muted-foreground"
                  >
                    {new Date(String(t.body.due)).toLocaleString("de-DE")}{" "}
                    {new Date(String(t.body.due)).getTime() <= now && !t.body.done
                      ? "· Jetzt fällig"
                      : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground"
                onClick={() => {
                  if (
                    window.confirm(
                      "Diese Aufgabe löschen? Cloudkopie wird bei aktivem Abgleich ebenfalls gelöscht.",
                    )
                  )
                    removeAlo(t.id, userId);
                }}
              >
                Löschen
              </button>
            </div>
          ))}
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">Wichtige Chats · deine Favoriten</h3>
        {important.map((i) => (
          <Link
            key={i.room.id}
            className="alo-card block"
            to="/chat"
            onClick={() => {
              window.sessionStorage.setItem(
                "alo-open-nexus",
                JSON.stringify({ kind: "room", id: i.room.id }),
              );
              onNavigate();
            }}
          >
            <p className="font-medium">
              {i.room.name} · {i.unread} ungelesen
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{i.text}</p>
          </Link>
        ))}
      </section>
      <div className="flex flex-wrap gap-2">
        <button className="alo-btn" onClick={onCapture}>
          Schnell speichern
        </button>
        <Link className="alo-btn" to="/programs" onClick={onNavigate}>
          Trainingsplan öffnen
        </Link>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {status}
      </p>
    </div>
  );
}
function Collections({ userId, rows }: { userId: string; rows: AloRecord[] }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const collections = rows.filter((r) => r.kind === "collection");
  const captures = rows.filter((r) => r.kind === "capture");
  const items = selected ? captures.filter((r) => r.body.collectionId === selected) : captures;
  const remove = (r: AloRecord) => {
    if (
      !window.confirm(
        r.kind === "collection"
          ? "Sammlung entfernen? Enthaltene Kopien bleiben in Alle Ablagen und können dort zugeordnet oder gelöscht werden."
          : "Diese Ablagekopie samt Anhang löschen? Originalquelle bleibt erhalten; Cloudkopie wird bei aktiver Synchronisierung gelöscht.",
      )
    )
      return;
    try {
      removeAlo(r.id, userId);
      if (r.id === selected) setSelected("");
    } catch {
      setStatus("Löschen fehlgeschlagen.");
    }
  };
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Sammlungen</h2>
      <p className="text-xs text-muted-foreground">
        Eine persönliche Sammlung für Inhalte aus allen drei Bereichen: Trainingspläne,
        Mira-Antworten, Nexus-Nachrichten und Dateien. Keine automatische Freigabe an andere
        Personen.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          try {
            const r = putAlo("collection", { title: name.trim() }, undefined, userId);
            setSelected(r.id);
            setName("");
          } catch {
            setStatus("Sammlung konnte nicht gespeichert werden.");
          }
        }}
      >
        <input
          aria-label="Neue Sammlung"
          placeholder="Name der Sammlung"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <button className="alo-btn-primary" disabled={!name.trim()}>
          Anlegen
        </button>
      </form>
      <label>
        Sammlung auswählen
        <select
          aria-label="Sammlung auswählen"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Alle Ablagen</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {String(c.body.title)}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <button
          className="alo-btn text-destructive"
          onClick={() => {
            const c = collections.find((c) => c.id === selected);
            if (c) remove(c);
          }}
        >
          Sammlung entfernen
        </button>
      )}
      {!items.length && (
        <p className="alo-card text-sm text-muted-foreground">
          Noch keine Inhalte. Nutze „Schnell speichern“ oder „Alo-Aktionen“ an einer Nachricht,
          Antwort oder einem Trainingsplan.
        </p>
      )}
      {items.map((r) => {
        const a = readAttachment(r.body.attachment);
        const url = safeLink(r.body.url);
        return (
          <article className="alo-card space-y-2" key={r.id}>
            <p className="text-xs text-primary">
              {String(r.body.source ?? "Schnellablage")} ·{" "}
              {AREA_LABELS[String(r.body.area)] ?? "Alo"} ·{" "}
              {r.dirty ? "lokal / Abgleich offen" : "Cloud + lokal"}
            </p>
            <h3 className="font-semibold">{String(r.body.title)}</h3>
            <p className="whitespace-pre-wrap break-words text-sm">{String(r.body.text ?? "")}</p>
            {url && (
              <a
                className="text-sm text-primary underline"
                target="_blank"
                rel="noopener noreferrer"
                href={url}
              >
                Link öffnen
              </a>
            )}
            {a && (
              <>
                <p className="text-xs">Datei: {a.name}</p>
                {a.type.startsWith("image/") && (
                  <img src={a.data} alt={a.name} className="max-h-60 rounded-xl" />
                )}
                {a.type.startsWith("audio/") && <audio controls src={a.data} className="w-full" />}
                <a className="alo-btn inline-block" href={a.data} download={a.name}>
                  Datei herunterladen
                </a>
              </>
            )}
            <label>
              Zuordnung
              <select
                aria-label={`Sammlung für ${String(r.body.title)}`}
                value={String(r.body.collectionId ?? "")}
                onChange={(e) => {
                  try {
                    putAlo("capture", { ...r.body, collectionId: e.target.value }, r.id, userId);
                  } catch {
                    setStatus("Zuordnung nicht gespeichert.");
                  }
                }}
              >
                <option value="">Ohne Sammlung</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {String(c.body.title)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <ContentActions
                userId={userId}
                text={String(r.body.text ?? "")}
                title={String(r.body.title)}
                source={String(r.body.source ?? "Alo")}
                extra={a ? { attachment: a } : {}}
              />
              <button className="text-xs text-destructive" onClick={() => remove(r)}>
                Ablage löschen
              </button>
            </div>
          </article>
        );
      })}
      <p role="status" className="text-xs">
        {status}
      </p>
    </div>
  );
}
function Shortcuts({
  userId,
  rows,
  onTab,
  onNavigate,
}: {
  userId: string;
  rows: AloRecord[];
  onTab: (tab: Tab) => void;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("today");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const shortcuts = rows.filter((r) => r.kind === "shortcut");
  const execute = (r: AloRecord) => {
    if (r.body.target === "mira") {
      try {
        putAlo(
          "draft",
          { target: "mira", text: String(r.body.prompt ?? "") },
          "draft:mira",
          userId,
        );
        onNavigate();
        void navigate({ to: "/ai" });
        window.dispatchEvent(new Event(ALO_REMOTE_EVENT));
      } catch {
        setStatus("Entwurf nicht gespeichert.");
      }
    } else if (r.body.target === "training") {
      onNavigate();
      void navigate({ to: "/programs" });
    } else if (TABS.some((t) => t.id === r.body.target)) onTab(r.body.target as Tab);
  };
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Schnellaktionen</h2>
      <p className="text-xs text-muted-foreground">
        Deine häufigen Abläufe mit einem Tipp. Mira-Prompts werden als Entwurf geöffnet und nie
        automatisch gesendet.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {shortcuts.map((r) => (
          <div className="alo-card" key={r.id}>
            <button className="w-full text-left font-semibold" onClick={() => execute(r)}>
              {String(r.body.title)} →
            </button>
            <button
              className="mt-3 text-xs text-muted-foreground"
              onClick={() => {
                if (window.confirm("Diese Schnellaktion löschen?")) removeAlo(r.id, userId);
              }}
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
      {!shortcuts.length && (
        <p className="text-sm text-muted-foreground">Noch keine persönlichen Schnellaktionen.</p>
      )}
      <form
        className="alo-card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || (target === "mira" && !prompt.trim())) return;
          try {
            putAlo("shortcut", { title: title.trim(), target, prompt }, undefined, userId);
            setTitle("");
            setPrompt("");
            setStatus("Schnellaktion gespeichert.");
          } catch {
            setStatus("Nicht gespeichert.");
          }
        }}
      >
        <label>
          Name
          <input
            aria-label="Schnellaktion Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </label>
        <label>
          Ablauf
          <select
            aria-label="Schnellaktion Ablauf"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="today">Tagesübersicht öffnen</option>
            <option value="capture">Schnell speichern</option>
            <option value="search">Überall suchen</option>
            <option value="collections">Sammlungen öffnen</option>
            <option value="training">Trainingsplan öffnen</option>
            <option value="mira">Mira-Frage vorbereiten</option>
          </select>
        </label>
        {target === "mira" && (
          <label>
            Deine Frage
            <textarea
              aria-label="Schnellaktion Mira-Frage"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={10000}
            />
          </label>
        )}
        <button
          className="alo-btn-primary"
          disabled={!title.trim() || (target === "mira" && !prompt.trim())}
        >
          Schnellaktion anlegen
        </button>
      </form>
      <p role="status" className="text-xs">
        {status}
      </p>
    </div>
  );
}
