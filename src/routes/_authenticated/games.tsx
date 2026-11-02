import { AloHomeLink } from "@/components/AloHomeLink";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import { getPrivateGameDocument } from "@/lib/private-game.functions";
import { PRIVATE_GAME_IDS, type PrivateGameId } from "@/lib/private-game-policy";
import {
  isCurrentPrivateGameDocument,
  type PrivateGameDocumentLease,
} from "@/lib/private-game-access-policy";
import { usePrivateGameAccess } from "@/lib/use-private-game-access";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({ game: z.enum(PRIVATE_GAME_IDS).optional() });

type GameLoadState =
  | { userId: string; game: PrivateGameId; revision: number; status: "loading" | "failed" }
  | (PrivateGameDocumentLease & { status: "loaded" });

export const Route = createFileRoute("/_authenticated/games")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async () => {
    if (!(await getAdminAreaAccess())) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Admin-Spiele · Alo" },
      {
        name: "description",
        content: "Geschützte Spiele, ausschließlich für Alo-Administratoren.",
      },
    ],
  }),
  component: GamesHub,
});

function GamesHub() {
  const { user } = Route.useRouteContext();
  const userId = user.id;
  const search = Route.useSearch();
  const selectedGame = search.game;
  const access = usePrivateGameAccess(userId, 5_000);
  const [loadState, setLoadState] = useState<GameLoadState | null>(null);
  const requestContextRef = useRef({
    userId,
    game: selectedGame,
    revision: access.state.revision,
    hasAccess: access.hasAccess,
  });
  requestContextRef.current = {
    userId,
    game: selectedGame,
    revision: access.state.revision,
    hasAccess: access.hasAccess,
  };

  const currentLoad =
    loadState?.userId === userId &&
    loadState.game === selectedGame &&
    loadState.revision === access.state.revision
      ? loadState
      : null;
  const currentDocument =
    currentLoad?.status === "loaded" &&
    isCurrentPrivateGameDocument(currentLoad, userId, selectedGame, access.state)
      ? currentLoad.document
      : null;
  const loadFailed = access.hasAccess && currentLoad?.status === "failed";

  useEffect(() => {
    let active = true;
    setLoadState(null);
    if (!selectedGame || !access.hasAccess)
      return () => {
        active = false;
      };

    const requestUserId = userId;
    const requestGame = selectedGame;
    const requestRevision = access.state.revision;
    setLoadState({
      userId: requestUserId,
      game: requestGame,
      revision: requestRevision,
      status: "loading",
    });
    const isCurrentRequest = () => {
      const current = requestContextRef.current;
      return (
        active &&
        current.hasAccess &&
        current.userId === requestUserId &&
        current.game === requestGame &&
        current.revision === requestRevision
      );
    };

    void getPrivateGameDocument({ data: { game: selectedGame } })
      .then((document) => {
        if (isCurrentRequest()) {
          setLoadState({
            userId: requestUserId,
            game: requestGame,
            revision: requestRevision,
            document,
            status: "loaded",
          });
        }
      })
      .catch(() => {
        if (isCurrentRequest()) {
          setLoadState({
            userId: requestUserId,
            game: requestGame,
            revision: requestRevision,
            status: "failed",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [access.hasAccess, access.state.revision, selectedGame, userId]);

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
        {access.status === "checking" ? (
          <p
            className="mx-auto max-w-3xl rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            Adminberechtigung wird geprüft …
          </p>
        ) : !access.hasAccess ? (
          <section className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/50 p-5 sm:p-8">
            <h1 className="text-2xl font-bold">Spielzugriff nicht verfügbar</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Die aktuelle Identität besitzt keine bestätigte Adminberechtigung. Spielinhalt und
              Frame bleiben gesperrt.
            </p>
          </section>
        ) : !selectedGame ? (
          <GameSelection />
        ) : loadFailed ? (
          <section className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/50 p-5 sm:p-8">
            <h1 className="text-2xl font-bold">Spielzugriff nicht verfügbar</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Der Spielinhalt konnte nicht geschützt geladen werden. Prüfe die Admin-Rolle und die
              Verbindung; ohne erfolgreiche Rollenprüfung bleibt das Spiel gesperrt.
            </p>
          </section>
        ) : currentDocument ? (
          <GameFrame game={selectedGame} document={currentDocument} />
        ) : (
          <p
            className="mx-auto max-w-3xl rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            Geschützten Spielinhalt wird geladen …
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Nur für Admins
      </p>
      <h1 id="games-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
        Spielauswahl
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Beide Spiele werden erst nach einer serverseitigen Prüfung deiner Alo-Adminrolle geladen.
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
  game: PrivateGameId;
  title: string;
  description: string;
  icon: "grid" | "circuit";
}) {
  return (
    <Link
      to="/games"
      search={{ game }}
      aria-label={`${title}, Admin-Spiel öffnen`}
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
        Admin-Spiel
      </span>
    </Link>
  );
}

function GameFrame({ game, document }: { game: PrivateGameId; document: string }) {
  const title = game === "grid-defense" ? "Grid Defense — Admin-Spiel" : "Kupferkern — Admin-Spiel";
  return (
    <section className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-xl">
      <iframe
        title={title}
        srcDoc={document}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="h-[82dvh] min-h-[650px] w-full border-0"
      />
    </section>
  );
}
