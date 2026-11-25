import { HomeAppMenuSidebar } from "@/components/HomeAppMenuLayout";
import { getPrivateGameDocument } from "@/lib/private-game.functions";
import { isCurrentPrivateGameDocument } from "@/lib/private-game-access-policy";
import { usePrivateGameAccess } from "@/lib/use-private-game-access";
import { PRIVATE_GAME_IDS, type PrivateGameId } from "@/lib/private-game-policy";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Menu, X } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ game: z.enum(PRIVATE_GAME_IDS).optional() });
type GameLoadState =
  | {
      game: PrivateGameId;
      userId: string;
      revision: number;
      status: "loading" | "failed";
    }
  | {
      game: PrivateGameId;
      userId: string;
      revision: number;
      document: string;
      status: "loaded";
    };
const GAMES = [
  { game: "grid-defense", title: "Grid Defense", description: "Tower Defense" },
  { game: "kupferkern", title: "Kupferkern", description: "Energiepfad-Puzzle" },
  { game: "neon-starfighter", title: "Neon Starfighter", description: "Arcade-Shooter" },
  { game: "chess", title: "Alo Schach", description: "Schach" },
] as const;
export const Route = createFileRoute("/_authenticated/games")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Alo-Spiele" },
      { name: "description", content: "Alo-Spiele für alle angemeldeten Alo-Nutzer." },
    ],
  }),
  component: GamesHub,
});
function GamesHub() {
  const { game: selectedGame } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const { state: accessState, status: accessStatus, hasAccess } = usePrivateGameAccess(user.id);
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<GameLoadState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentLoad =
    loadState?.userId === user.id && loadState.game === selectedGame ? loadState : null;
  const currentDocument =
    currentLoad?.status === "loaded" &&
    isCurrentPrivateGameDocument(currentLoad, user.id, selectedGame, accessState)
      ? currentLoad.document
      : null;
  const loadFailed = currentLoad?.status === "failed";
  useEffect(() => {
    if (!selectedGame) {
      void navigate({ to: "/", replace: true });
    }
  }, [navigate, selectedGame]);
  useEffect(() => {
    let active = true;
    if (!selectedGame || !hasAccess) {
      setLoadState(null);
      return () => {
        active = false;
      };
    }
    const requestGame = selectedGame;
    const requestUserId = user.id;
    const requestRevision = accessState.revision;
    setLoadState({
      game: requestGame,
      userId: requestUserId,
      revision: requestRevision,
      status: "loading",
    });
    void getPrivateGameDocument({ data: { game: requestGame } })
      .then((document) => {
        if (active) {
          setLoadState({
            game: requestGame,
            userId: requestUserId,
            revision: requestRevision,
            document,
            status: "loaded",
          });
        }
      })
      .catch(() => {
        if (active) {
          setLoadState({
            game: requestGame,
            userId: requestUserId,
            revision: requestRevision,
            status: "failed",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [accessState.revision, hasAccess, selectedGame, user.id]);
  const title = GAMES.find((entry) => entry.game === selectedGame)?.title ?? "Alo-Spiel";
  return (
    <main className="alo-games-page fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-slate-950 text-white">
      {accessStatus === "checking" ? (
        <p className="mx-auto mt-24 max-w-xl rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          Anmeldung wird geprüft …
        </p>
      ) : accessStatus === "denied" ? (
        <section
          className="mx-auto mt-24 max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6"
          role="alert"
        >
          <h1 className="text-xl font-bold">Anmeldung erforderlich</h1>
          <p className="mt-3 text-sm text-slate-300">
            Melde dich bei Alo an, um die Spiele zu öffnen.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold"
          >
            Zur Alo-Startseite
          </Link>
        </section>
      ) : loadFailed ? (
        <section
          className="mx-auto mt-24 max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6"
          role="alert"
        >
          <h1 className="text-xl font-bold">Spiel konnte nicht geladen werden</h1>
          <p className="mt-3 text-sm text-slate-300">
            Der Inhalt ist momentan nicht verfügbar. Probiere es später noch einmal.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold"
          >
            Zur Alo-Startseite
          </Link>
        </section>
      ) : currentDocument ? (
        <iframe
          title={title}
          srcDoc={currentDocument}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="block h-full min-h-0 w-full border-0"
        />
      ) : (
        <p
          className="mx-auto mt-24 max-w-3xl rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300"
          aria-live="polite"
        >
          Spielinhalt wird geladen …
        </p>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex items-start justify-between p-3">
        <button
          type="button"
          aria-label="Seitenmenü öffnen"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/85 text-white shadow-lg backdrop-blur hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link
          to="/"
          aria-label="Zur Alo-Startseite"
          className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/85 px-4 text-sm font-semibold text-white shadow-lg backdrop-blur hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
      </div>
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 z-[70] bg-black/60"
          />
          <HomeAppMenuSidebar
            ariaLabel="Alo-Spiele"
            className="absolute bottom-0 left-0 top-0 z-[80] flex w-[min(86vw,320px)] flex-col border-r border-white/10 bg-[#0b1320] p-5 pt-20 shadow-2xl"
          >
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                Alo Arcade
              </p>
              <h2 className="mt-1 text-xl font-bold">Spiele</h2>
              <p className="mt-1 text-xs text-slate-400">Wechsle direkt zu einem anderen Spiel.</p>
            </div>
            <nav className="flex flex-col gap-2">
              {GAMES.map((entry) => (
                <Link
                  key={entry.game}
                  to="/games"
                  search={{ game: entry.game }}
                  onClick={() => setMenuOpen(false)}
                  aria-current={selectedGame === entry.game ? "page" : undefined}
                  className={
                    "rounded-xl border px-4 py-3 transition " +
                    (selectedGame === entry.game
                      ? "border-cyan-300/50 bg-cyan-300/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]")
                  }
                >
                  <span className="block text-sm font-semibold">{entry.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{entry.description}</span>
                </Link>
              ))}
            </nav>
            <Link
              to="/"
              className="mt-auto inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
            >
              <Home className="h-4 w-4" />
              Zur Alo-Startseite
            </Link>
          </HomeAppMenuSidebar>
        </>
      )}
    </main>
  );
}
