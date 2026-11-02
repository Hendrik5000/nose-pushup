import { useState } from "react";
import { RotateCw, Zap } from "lucide-react";
import {
  CORE,
  GRID_SIZE,
  SOURCE,
  createInitialBoard,
  getPiecePorts,
  isPowerConnected,
  rotatePiece,
  type Direction,
} from "@/lib/kupferkern";

const PORT_COORDINATES: Record<Direction, { x: number; y: number }> = {
  N: { x: 24, y: 4 },
  E: { x: 44, y: 24 },
  S: { x: 24, y: 44 },
  W: { x: 4, y: 24 },
};

export function KupferkernGame() {
  const [pieces, setPieces] = useState(createInitialBoard);
  const [moves, setMoves] = useState(0);
  const powered = isPowerConnected(pieces);

  function turn(pieceId: string) {
    setPieces((current) => rotatePiece(current, pieceId));
    setMoves((current) => current + 1);
  }

  function reset() {
    setPieces(createInitialBoard());
    setMoves(0);
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-border bg-card/60 p-4 shadow-xl sm:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/75">
            Lokales Energiepfad-Puzzle
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Kupferkern</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Drehe die Leitungsstücke und verbinde den Generator mit dem Kern. Jedes Stück rastet bei
            einer Vierteldrehung ein.
          </p>
        </div>
        <div className="flex min-w-20 items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-sm">
          <RotateCw className="h-4 w-4 text-cyan-200" aria-hidden="true" />
          <span>{moves} Züge</span>
        </div>
      </div>

      <div
        className="mx-auto grid w-full max-w-[26rem] grid-cols-5 gap-1.5 rounded-2xl border border-border/70 bg-slate-950/70 p-2 sm:gap-2 sm:p-3"
        role="group"
        aria-label="Kupferkern-Energiepfad, fünf mal fünf Felder"
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
          const x = index % GRID_SIZE;
          const y = Math.floor(index / GRID_SIZE);
          const piece = pieces.find((candidate) => candidate.x === x && candidate.y === y);
          const isSource = x === SOURCE.x && y === SOURCE.y;
          const isCore = x === CORE.x && y === CORE.y;

          if (isSource || isCore) {
            const label = isSource
              ? "Generator, Ausgang nach Osten"
              : "Kupferkern, Eingang nach Westen";
            const ports: Direction[] = isSource ? ["E"] : ["W"];
            return (
              <div
                key={`${x},${y}`}
                className={`grid aspect-square place-items-center rounded-xl border ${
                  isSource
                    ? "border-amber-300/50 bg-amber-500/15 text-amber-100"
                    : powered
                      ? "border-cyan-200/80 bg-cyan-300/20 text-cyan-50 shadow-[0_0_18px_#67e8f955]"
                      : "border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
                }`}
                role="img"
                aria-label={label}
                title={label}
              >
                <ConduitMark ports={ports} endpoint />
              </div>
            );
          }

          if (!piece) {
            return (
              <div
                key={`${x},${y}`}
                className="grid aspect-square place-items-center rounded-xl border border-white/[0.035] bg-white/[0.015]"
                aria-hidden="true"
              >
                <span className="h-1 w-1 rounded-full bg-slate-700/50" />
              </div>
            );
          }

          return (
            <button
              key={piece.id}
              type="button"
              onClick={() => turn(piece.id)}
              className="grid aspect-square place-items-center rounded-xl border border-orange-200/25 bg-orange-500/10 text-orange-100 transition hover:border-orange-100/65 hover:bg-orange-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 active:scale-95"
              aria-label={`${piece.kind === "elbow" ? "Eckleitung" : "Gerade Leitung"} in Zeile ${y + 1}, Spalte ${x + 1} drehen; Ausgänge ${getPiecePorts(piece).join(" und ")}`}
              title="Zum Drehen antippen"
            >
              <ConduitMark ports={getPiecePorts(piece)} />
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-4 flex max-w-[26rem] items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Tippe ein Leitungsteil an, um es zu drehen.</p>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Neu starten
        </button>
      </div>

      <div
        className={`mx-auto mt-5 flex max-w-[26rem] items-center gap-3 rounded-xl border px-4 py-3 ${
          powered
            ? "border-cyan-200/40 bg-cyan-300/10 text-cyan-50"
            : "border-border bg-background/40 text-muted-foreground"
        }`}
        role="status"
        aria-live="polite"
      >
        <Zap
          className={`h-5 w-5 shrink-0 ${powered ? "text-cyan-200" : "text-slate-500"}`}
          aria-hidden="true"
        />
        <p className="text-sm">
          {powered
            ? `Energiepfad geschlossen — der Kupferkern ist versorgt. ${moves} Züge.`
            : "Noch keine Verbindung. Richte die Leitungsstücke auf dem Weg zum Kern aus."}
        </p>
      </div>
    </section>
  );
}

function ConduitMark({ ports, endpoint = false }: { ports: Direction[]; endpoint?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full max-h-12 max-w-12" aria-hidden="true">
      {ports.map((port) => {
        const end = PORT_COORDINATES[port];
        return (
          <line
            key={port}
            x1="24"
            y1="24"
            x2={end.x}
            y2={end.y}
            stroke="currentColor"
            strokeWidth={endpoint ? 7 : 8}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="24" cy="24" r={endpoint ? 7 : 6} fill="currentColor" />
      {endpoint && <circle cx="24" cy="24" r="2.25" fill="#0f172a" />}
    </svg>
  );
}
