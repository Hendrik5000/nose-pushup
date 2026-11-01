export type MiraAnswerBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "divider" };

function tableCells(line: string): string[] {
  const source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\" && source[index + 1] === "|") {
      cell += "|";
      index += 1;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines: string[], index: number): boolean {
  return Boolean(
    lines[index]?.includes("|") && lines[index + 1] && isTableSeparator(lines[index + 1]!),
  );
}

function listItem(line: string): { ordered: boolean; text: string } | null {
  const match = /^\s*(?:([-*+])\s+|(\d+)[.)]\s+)(.+)$/.exec(line);
  if (!match) return null;
  return { ordered: Boolean(match[2]), text: match[3]!.trim() };
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  return (
    /^\s{0,3}#{1,6}\s+/.test(line) ||
    /^\s*```/.test(line) ||
    /^\s*>/.test(line) ||
    Boolean(listItem(line)) ||
    /^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/.test(line) ||
    isTableStart(lines, index)
  );
}

/** Parse a deliberately small, display-only Markdown subset. Raw HTML is always plain text. */
export function parseMiraAnswer(text: string): MiraAnswerBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MiraAnswerBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]!.trim() });
      index += 1;
      continue;
    }

    const fence = /^\s*```([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language: fence[1] ?? "", text: code.join("\n") });
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (
        index < lines.length &&
        (lines[index] ?? "").trim() &&
        (lines[index] ?? "").includes("|")
      ) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index] ?? "")) {
        quote.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join("\n") });
      continue;
    }

    const item = listItem(line);
    if (item) {
      const items: string[] = [];
      const ordered = item.ordered;
      while (index < lines.length) {
        const next = listItem(lines[index] ?? "");
        if (!next || next.ordered !== ordered) break;
        items.push(next.text);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (/^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() && !startsBlock(lines, index)) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}
