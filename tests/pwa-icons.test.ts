import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const root = new URL("../", import.meta.url);

function readProjectFile(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

test("all Alo launcher and notification icons are valid square PNGs at their intended sizes", () => {
  for (const [path, size] of [
    ["public/alo-icon-512.png", 512],
    ["public/alo-icon-192.png", 192],
    ["public/alo-apple-touch-icon.png", 180],
    ["public/favicon.png", 128],
  ] as const) {
    const png = readFileSync(new URL(path, root));
    assert.ok(png.subarray(0, 8).equals(pngSignature), `${path} is a PNG`);
    assert.equal(png.readUInt32BE(16), size, `${path} width`);
    assert.equal(png.readUInt32BE(20), size, `${path} height`);
  }
});

test("the manifest, document head, service worker and notifications still point at existing icon paths", () => {
  const manifest = JSON.parse(readProjectFile("public/manifest.webmanifest")) as {
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
  };
  assert.ok(
    manifest.icons.some((icon) => icon.src === "/alo-icon-192.png" && icon.sizes === "192x192"),
  );
  assert.ok(
    manifest.icons.some(
      (icon) =>
        icon.src === "/alo-icon-512.png" &&
        icon.sizes === "512x512" &&
        icon.purpose?.includes("maskable"),
    ),
  );
  assert.match(readProjectFile("src/routes/__root.tsx"), /href: "\/alo-icon-192\.png"/);
  assert.match(readProjectFile("src/routes/__root.tsx"), /href: "\/alo-apple-touch-icon\.png"/);
  assert.match(readProjectFile("public/sw.js"), /icon: "\/alo-icon-192\.png"/);
  assert.match(readProjectFile("src/lib/notifications.ts"), /icon: "\/favicon\.png"/);
});
