export const GRID_SIZE = 5;

export type PieceKind = "elbow" | "straight";
export type Direction = "N" | "E" | "S" | "W";

export type ConduitPiece = {
  id: string;
  x: number;
  y: number;
  kind: PieceKind;
  rotation: number;
};

type GridPoint = { x: number; y: number };

export const SOURCE: GridPoint = { x: 0, y: 2 };
export const CORE: GridPoint = { x: 4, y: 2 };

const INITIAL_PIECES: ConduitPiece[] = [
  { id: "western-elbow", x: 1, y: 2, kind: "elbow", rotation: 0 },
  { id: "northwest-elbow", x: 1, y: 1, kind: "elbow", rotation: 3 },
  { id: "north-straight", x: 2, y: 1, kind: "straight", rotation: 0 },
  { id: "northeast-elbow", x: 3, y: 1, kind: "elbow", rotation: 0 },
  { id: "eastern-elbow", x: 3, y: 2, kind: "elbow", rotation: 2 },
];

const DELTAS: Record<Direction, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  N: "S",
  E: "W",
  S: "N",
  W: "E",
};

export function createInitialBoard(): ConduitPiece[] {
  return INITIAL_PIECES.map((piece) => ({ ...piece }));
}

export function getPiecePorts(piece: Pick<ConduitPiece, "kind" | "rotation">): Direction[] {
  const rotation = ((piece.rotation % 4) + 4) % 4;
  if (piece.kind === "straight") {
    return rotation % 2 === 0 ? ["N", "S"] : ["E", "W"];
  }
  const elbowPorts: Direction[][] = [
    ["N", "E"],
    ["E", "S"],
    ["S", "W"],
    ["W", "N"],
  ];
  return elbowPorts[rotation] ?? [];
}

export function rotatePiece(pieces: ConduitPiece[], pieceId: string): ConduitPiece[] {
  if (!pieces.some((piece) => piece.id === pieceId)) return pieces;
  return pieces.map((piece) =>
    piece.id === pieceId ? { ...piece, rotation: (piece.rotation + 1) % 4 } : piece,
  );
}

export function isPowerConnected(pieces: ConduitPiece[]): boolean {
  const piecesByPosition = new Map(pieces.map((piece) => [`${piece.x},${piece.y}`, piece]));
  const queue = [{ ...SOURCE }];
  const visited = new Set([`${SOURCE.x},${SOURCE.y}`]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentKey = `${current.x},${current.y}`;
    if (current.x === CORE.x && current.y === CORE.y) return true;
    const currentPorts: Direction[] =
      currentKey === `${SOURCE.x},${SOURCE.y}`
        ? ["E"]
        : getPiecePorts(piecesByPosition.get(currentKey) ?? { kind: "straight", rotation: -1 });

    for (const direction of currentPorts) {
      const delta = DELTAS[direction];
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      const nextKey = `${next.x},${next.y}`;
      if (next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE) continue;

      if (next.x === CORE.x && next.y === CORE.y) {
        if (direction === "E") return true;
        continue;
      }

      const neighbor = piecesByPosition.get(nextKey);
      if (
        !neighbor ||
        !getPiecePorts(neighbor).includes(OPPOSITE[direction]) ||
        visited.has(nextKey)
      ) {
        continue;
      }
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}
