import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const readRepoFile = (relativePath: string) =>
  readFileSync(resolve(repoRoot, relativePath), "utf8");

test("AloErrorBoundary isolates failures with an honest fallback and retry", () => {
  const source = readRepoFile("src/components/AloErrorBoundary.tsx");
  assert.match(source, /getDerivedStateFromError/);
  assert.match(source, /componentDidCatch/);
  assert.match(source, /role="alert"/);
  assert.match(source, /konnte nicht geladen werden\./);
  assert.match(source, /Der Rest bleibt nutzbar\./);
  assert.match(source, /Erneut versuchen/);
  assert.doesNotMatch(source, /Demo|Beispiel|Platzhalter/);
});

test("home page wraps its sections in isolated error boundaries", () => {
  const home = readRepoFile("src/routes/_authenticated/index.tsx");
  assert.match(home, /import \{ AloErrorBoundary \} from "@\/components\/AloErrorBoundary"/);
  assert.match(home, /<AloErrorBoundary section="Dein Tag">/);
  assert.match(home, /<AloErrorBoundary section="Widgets">/);
  assert.match(home, /<AloErrorBoundary section="Apps">/);
  assert.equal(
    (home.match(/<\/AloErrorBoundary>/g) ?? []).length,
    4,
    "Jeder geöffnete Bereich braucht ein schließendes Boundary.",
  );
});
