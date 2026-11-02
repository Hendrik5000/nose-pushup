import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gamePath = resolve(repoRoot, "private-game-preview/grid-defense.html");
const host = "127.0.0.1";
const port = Number(process.env.ALO_PRIVATE_GAME_PORT ?? "8787");

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("ALO_PRIVATE_GAME_PORT must be an integer from 0 through 65535");
}

const gameHtml = await readFile(gamePath);
const contentSecurityPolicy = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
].join("; ");

const server = createServer((request, response) => {
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", "Cache-Control": "no-store" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    response.writeHead(400, { "Cache-Control": "no-store" });
    response.end();
    return;
  }

  if (pathname === "/health") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(method === "HEAD" ? undefined : '{"ok":true,"scope":"loopback-private-preview"}');
    return;
  }

  if (pathname !== "/" && pathname !== "/index.html") {
    response.writeHead(404, { "Cache-Control": "no-store" });
    response.end();
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": contentSecurityPolicy,
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : gameHtml);
});

server.listen(port, host, () => {
  const address = server.address();
  if (address && typeof address === "object") {
    console.log(
      `Private game preview listening at http://${host}:${address.port}/ (loopback only)`,
    );
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
