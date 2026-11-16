import { getPublicGameDocument } from "@/lib/public-game.functions";
import { PUBLIC_GAME_IDS, type PublicGameId } from "@/lib/public-game-policy";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toggleGameFullscreen } from "@/lib/game-fullscreen";
import { z } from "zod";

const searchSchema = z.object({ game: z.enum(PUBLIC_GAME_IDS).optional() });

type GameLoadState =
  | { game: PublicGameId; status: "loading" | "failed" }
  | { game: PublicGameId; document: string; status: "loaded" };

export const Route = createFileRoute("/games")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Alo-Spiele" },
      {
        name: "description",
        content:
          "Grid Defense und Kupferkern – zwei eigenständige Alo-Spiele, auch ohne Anmeldung.",
      },
    ],
  }),
  component: GamesHub,
});

function GamesHub() {
  const { game: selectedGame } = Route.useSearch();
  const [loadState, setLoadState] = useState<GameLoadState | null>(null);
  const currentLoad = loadState?.game === selectedGame ? loadState : null;
  const currentDocument = currentLoad?.status === "loaded" ? currentLoad.document : null;
  const loadFailed = currentLoad?.status === "failed";

  useEffect(() => {
    let active = true;
    if (!selectedGame) {
      setLoadState(null);
      return () => {
        active = false;
      };
    }

    const requestGame = selectedGame;
    setLoadState({ game: requestGame, status: "loading" });
    void getPublicGameDocument({ data: { game: requestGame } })
      .then((document) => {
        if (active) setLoadState({ game: requestGame, document, status: "loaded" });
      })
      .catch(() => {
        if (active) setLoadState({ game: requestGame, status: "failed" });
      });

    return () => {
      active = false;
    };
  }, [selectedGame]);

  return (
    <main className="min-h-screen bg-background px-3 pb-12 pt-4 text-foreground sm:px-6">
      <header className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4">
        <Link
          to="/games"
          search={{}}
          className="rounded-lg text-sm font-semibold uppercase tracking-[0.16em] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Zur Alo-Spielauswahl"
        >
          Alo · Spiele
        </Link>
        {selectedGame && (
          <Link
            to="/games"
            search={{}}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Spielauswahl
          </Link>
        )}
      </header>

      <div className="mx-auto max-w-5xl">
        {!selectedGame ? (
          <GameSelection />
        ) : loadFailed ? (
          <section
            className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/50 p-5 sm:p-8"
            role="alert"
          >
            <h1 className="text-2xl font-bold">Spiel konnte nicht geladen werden</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Der Inhalt ist momentan nicht verfügbar. Probiere es später noch einmal.
            </p>
          </section>
        ) : currentDocument ? (
          <GameFrame game={selectedGame} gameDocument={currentDocument} />
        ) : (
          <p
            className="mx-auto max-w-3xl rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            Spielinhalt wird geladen …
          </p>
        )}

        <p className="mx-auto mt-6 max-w-3xl rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Diese Neufassungen sind keine rechtliche Freigabe. Vor einer Weitergabe oder
          Veröffentlichung sind eigenständige Rechte-, Marken-, Text- und Gestaltungsprüfungen
          erforderlich.
        </p>
      </div>
    </main>
  );
}

function GameSelection() {
  return (
    <section aria-labelledby="games-title" className="mx-auto max-w-3xl pt-5 sm:pt-10">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Ohne Anmeldung spielbar
      </p>
      <h1 id="games-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
        Alo-Spiele
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Zwei eigenständige Spiele, direkt im Browser und ohne Alo-Konto erreichbar.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <GameChoice
          game="grid-defense"
          title="Grid Defense"
          description="Tower Defense: Türme platzieren, Wellen abwehren und den Kern schützen."
          icon="grid"
        />
        <GameChoice
          game="kupferkern"
          title="Kupferkern"
          description="Energiepfad-Puzzle: Leitungen drehen und den Kern versorgen."
          icon="circuit"
        />
      </div>
    </section>
  );
}

function GameChoice({
  game,
  title,
  description,
  icon,
}: {
  game: PublicGameId;
  title: string;
  description: string;
  icon: "grid" | "circuit";
}) {
  return (
    <Link
      to="/games"
      search={{ game }}
      aria-label={`${title}, Spiel öffnen`}
      className="group rounded-2xl border border-border bg-card/50 p-5 transition hover:border-primary/50 hover:bg-card/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span
        className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/5 text-cyan-100"
        aria-hidden="true"
      >
        {icon === "grid" ? (
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none">
            <path
              d="M5 5h9v9H5zM18 5h9v9h-9zM5 18h9v9H5zM18 18h9v9h-9z"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none">
            <path
              d="M5 9h7l4 7 5-9 6 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 23h7l4-7 5 9 6-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="5" cy="9" r="2" fill="currentColor" />
            <circle cx="27" cy="11" r="2" fill="currentColor" />
            <circle cx="27" cy="21" r="2" fill="currentColor" />
          </svg>
        )}
      </span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <span className="mt-4 inline-flex items-center rounded-lg border border-border bg-background/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        Ohne Anmeldung
      </span>
    </Link>
  );
}

function GameFrame({ game, gameDocument }: { game: PublicGameId; gameDocument: string }) {
  const title = game === "grid-defense" ? "Grid Defense" : "Kupferkern";
  const frameRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const handleFullscreen = async () => {
    setFullscreenFailed(false);
    const success = await toggleGameFullscreen(frameRef.current, document);
    setFullscreenFailed(!success);
  };

  return (
    <section
      ref={frameRef}
      className={`mx-auto w-full max-w-[1500px] overflow-hidden border border-border bg-slate-950 shadow-xl ${
        isFullscreen ? "h-[100dvh] max-w-none rounded-none" : "rounded-2xl"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 text-white">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => void handleFullscreen()}
          aria-pressed={isFullscreen}
          className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          {isFullscreen ? "Vollbild verlassen" : "Vollbild"}
        </button>
      </div>
      <iframe
        title={title}
        srcDoc={gameDocument}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className={`w-full border-0 ${
          isFullscreen ? "h-[calc(100dvh-53px)] min-h-0" : "h-[82dvh] min-h-[650px]"
        }`}
      />
      {fullscreenFailed && (
        <p role="alert" className="border-t border-white/10 px-4 py-2 text-xs text-amber-200">
          Vollbild ist in diesem Browser oder auf diesem Gerät nicht verfügbar.
        </p>
      )}
    </section>
  );
}
