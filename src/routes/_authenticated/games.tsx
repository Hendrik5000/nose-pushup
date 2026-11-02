import { AloHomeLink } from "@/components/AloHomeLink";
import { KupferkernGame } from "@/components/games/KupferkernGame";
import { isPrivateGamePreviewOpen } from "@/lib/private-game-preview";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

const gameIdSchema = z.enum(["grid-defense", "kupferkern"]);
const searchSchema = z.object({
  game: gameIdSchema.optional(),
  preview: z.literal("local").optional(),
});

type GameId = z.infer<typeof gameIdSchema>;

export const Route = createFileRoute("/_authenticated/games")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Spiele · Private lokale Vorschau · Alo" },
      {
        name: "description",
        content: "Zwei getrennte, lokal gesperrte Spiele in der privaten Alo-Vorschau.",
      },
    ],
  }),
  component: GamesHub,
});

function GamesHub() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const previewOpen = isPrivateGamePreviewOpen(
    import.meta.env.DEV,
    search.preview === "local" ? "?preview=local" : "",
  );
  const selectedGame = search.game;

  function openLocalPreview() {
    if (!import.meta.env.DEV || !selectedGame) return;
    void navigate({
      search: (previous) => ({ ...previous, preview: "local" }),
    });
  }

  return (
    <main className="min-h-screen bg-background px-3 pb-12 pt-4 text-foreground sm:px-6">
      <nav className="mx-auto mb-5 flex max-w-5xl items-center gap-4" aria-label="Spielnavigation">
        <AloHomeLink />
        {selectedGame && (
          <Link
            to="/games"
            search={{}}
            className="rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Spielauswahl
          </Link>
        )}
      </nav>

      <div className="mx-auto max-w-5xl">
        {!selectedGame ? (
          <GameSelection />
        ) : previewOpen ? (
          selectedGame === "grid-defense" ? (
            <GridDefenseFrame />
          ) : (
            <KupferkernGame />
          )
        ) : (
          <PreviewGate game={selectedGame} onOpen={openLocalPreview} />
        )}

        <p className="mx-auto mt-6 max-w-3xl rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Diese lokale Neufassung ist keine rechtliche Freigabe. Vor einer Verteilung oder
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Private lokale Vorschau
      </p>
      <h1 id="games-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
        Spielauswahl
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Zwei eigenständige Spiele, getrennte Startpunkte. Beide bleiben standardmäßig gesperrt und
        lassen sich nur in der lokalen Entwicklung ausdrücklich öffnen.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <GameChoice
          game="grid-defense"
          title="Grid Defense"
          description="Klassisches Tower Defense: Türme bauen, Wellen abwehren und den Kern schützen."
          icon="grid"
        />
        <GameChoice
          game="kupferkern"
          title="Kupferkern"
          description="Ein kurzes Energiepfad-Puzzle: Leitungen drehen und den Kern versorgen."
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
  game: GameId;
  title: string;
  description: string;
  icon: "grid" | "circuit";
}) {
  return (
    <Link
      to="/games"
      search={{ game }}
      aria-label={`${title}, private Vorschau auswählen`}
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
      <span className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        Lokal gesperrt
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

function PreviewGate({ game, onOpen }: { game: GameId; onOpen: () => void }) {
  const title = game === "grid-defense" ? "Grid Defense" : "Kupferkern";
  const summary =
    game === "grid-defense"
      ? "Ein eigenständiges Tower-Defense-Spiel läuft aus einer separaten lokalen Spiel-Origin."
      : "Das Energiepfad-Puzzle läuft in Alo, speichert nur den laufenden Spielzustand und verwendet keine Alo-Kontodaten.";

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/50 p-5 shadow-lg sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Private Vorschau · standardmäßig gesperrt
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{summary}</p>
      <p className="mt-4 rounded-xl border border-border bg-background/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Kein öffentlicher Startpunkt und keine automatische Veröffentlichung. Auch diese Neufassung
        ist keine rechtliche Freigabe.
      </p>
      {import.meta.env.DEV ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Lokale Vorschau öffnen
        </button>
      ) : (
        <p className="mt-5 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
          Produktions-Builds bleiben immer gesperrt.
        </p>
      )}
    </section>
  );
}

function GridDefenseFrame() {
  const [frameUrl, setFrameUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setFrameUrl(getPrivateGamePreviewUrl());
  }, []);

  if (frameUrl === undefined) {
    return (
      <p
        className="mx-auto max-w-3xl rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
        aria-live="polite"
      >
        Private lokale Spiel-Origin wird geprüft …
      </p>
    );
  }

  if (!frameUrl) {
    return (
      <section className="mx-auto max-w-3xl rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5 sm:p-8">
        <h1 className="text-2xl font-bold">Grid Defense</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Die private lokale Spiel-Origin ist nicht verfügbar oder nicht getrennt von Alo. Starte
          `npm run dev:private-game` in einem zweiten Terminal und prüfe
          `VITE_PRIVATE_GAME_PREVIEW_URL`. Die Vorschau wird aus Sicherheitsgründen nicht
          gleich-originig eingebettet.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-xl">
      <iframe
        title="Grid Defense — lokale private Spielvorschau"
        src={frameUrl}
        sandbox="allow-scripts allow-same-origin"
        allow="fullscreen"
        allowFullScreen
        referrerPolicy="no-referrer"
        className="h-[82dvh] min-h-[650px] w-full border-0"
      />
    </section>
  );
}

function getPrivateGamePreviewUrl(): string | null {
  const configuredUrl = import.meta.env.VITE_PRIVATE_GAME_PREVIEW_URL || "http://127.0.0.1:8787/";
  try {
    const url = new URL(configuredUrl);
    const isLoopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (!isLoopback || url.protocol !== "http:" || url.origin === window.location.origin)
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
