import type { ReactNode } from "react";
import { parseMiraAnswer } from "@/lib/mira-answer-markdown";

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\n]+)\*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const whole = match[0];
    const start = match.index ?? 0;
    if (start > cursor) parts.push(text.slice(cursor, start));

    if (match[1] !== undefined && match[2] !== undefined) {
      if (/^https?:\/\//i.test(match[2])) {
        parts.push(
          <a
            key={`link-${start}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2"
          >
            {match[1]}
          </a>,
        );
      } else {
        parts.push(whole);
      }
    } else if (match[3] !== undefined || match[4] !== undefined) {
      parts.push(<strong key={`strong-${start}`}>{match[3] ?? match[4]}</strong>);
    } else if (match[5] !== undefined) {
      parts.push(
        <code
          key={`inline-code-${start}`}
          className="rounded bg-secondary px-1 py-0.5 text-[0.92em]"
        >
          {match[5]}
        </code>,
      );
    } else if (match[6] !== undefined) {
      parts.push(<em key={`em-${start}`}>{match[6]}</em>);
    }
    cursor = start + whole.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function MiraAnswerText({ text }: { text: string }) {
  const blocks = parseMiraAnswer(text);
  return (
    <div className="mira-answer-content min-w-0 max-w-full space-y-2 break-words">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          return (
            <Heading
              key={index}
              className={`mt-2 font-semibold tracking-tight ${block.level === 1 ? "text-base" : "text-sm"}`}
            >
              {renderInline(block.text)}
            </Heading>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={index} className="whitespace-pre-wrap leading-relaxed">
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={`space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-0.5">
                  {renderInline(item)}
                </li>
              ))}
            </List>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="rounded-r-xl border-l-2 border-primary/60 bg-primary/5 px-3 py-2 text-muted-foreground"
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="max-w-full overflow-x-auto rounded-xl bg-secondary/70 p-3 text-xs"
            >
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "table") {
          return (
            <div
              key={index}
              role="region"
              aria-label="Tabelle, horizontal verschiebbar"
              tabIndex={0}
              className="max-w-full overflow-x-auto rounded-xl border border-border"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-secondary/70">
                  <tr>
                    {block.headers.map((header, cellIndex) => (
                      <th
                        key={cellIndex}
                        scope="col"
                        className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold"
                      >
                        {renderInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="even:bg-secondary/30">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border-b border-border/70 px-3 py-2 align-top"
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <hr key={index} className="border-border" />;
      })}
    </div>
  );
}
