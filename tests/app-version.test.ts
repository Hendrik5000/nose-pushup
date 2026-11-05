import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { AloAppVersion } from "../src/components/AloAppVersion";
import { ALO_APP_VERSION } from "../src/lib/app-version";

test("Alo's package version is shown at the end of both settings layouts", () => {
  const packageVersion = JSON.parse(readFileSync("package.json", "utf8")) as {
    version: string;
  };
  assert.equal(packageVersion.version, "1.1.0");
  assert.equal(ALO_APP_VERSION, packageVersion.version.replace(/\.0$/, ""));
  assert.equal(ALO_APP_VERSION, "1.1");

  const markup = renderToStaticMarkup(createElement(AloAppVersion));
  assert.match(markup, /Alo-Version <span[^>]*>1\.1<\/span>/);

  const settingsPage = readFileSync("src/routes/_authenticated/profile-page-impl.tsx", "utf8");
  assert.equal((settingsPage.match(/<AloAppVersion\s*\/>/g) ?? []).length, 2);
});
