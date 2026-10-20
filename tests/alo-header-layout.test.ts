import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const css = read("alo-header-layout.css");
const parsed = postcss.parse(css);
function declaration(selectorPart: string, property: string) {
  const values: string[] = [];
  parsed.walkRules((rule) => {
    if (rule.selector.includes(selectorPart))
      rule.walkDecls(property, (decl) => {
        values.push(decl.value);
      });
  });
  return values;
}

test("the shared brand header is first in every authenticated app area", () => {
  const layout = read("routes/_authenticated/route.tsx");
  assert.match(
    layout,
    /className="authenticated-shell alo-header-first[^"]*">\s*<SportAppHeader \/>\s*<TopNav \/>/,
  );
  assert.ok(
    layout.indexOf('import "@/alo-header-layout.css"') >
      layout.indexOf('import "@/alo-mobile.css"'),
  );
  assert.equal((layout.match(/<SportAppHeader \/>/g) ?? []).length, 1);
});

test("header sticks immediately below the safe area, independent of optional nav height", () => {
  assert.deepEqual(declaration("> .alo-app-header", "top"), ["env(safe-area-inset-top, 0px)"]);
  assert.match(css, /html:root \.authenticated-shell\.alo-header-first\s*\{\s*padding-top: 0;/);
  // The body supplies the inset once; shell must not add it a second time.
  assert.match(read("styles.css"), /body\s*\{[\s\S]*?padding-top: env\(safe-area-inset-top\)/);
  assert.doesNotMatch(
    declaration("> .alo-app-header", "top").join(""),
    /homebar-top-space|alo-header-space/,
  );
});

test("navigation reserve belongs below the header and excludes the already-used safe area", () => {
  assert.match(
    declaration("> .alo-module-surface", "padding-top")[0],
    /var\(--homebar-top-space, 0px\) - env\(safe-area-inset-top, 0px\)/,
  );
  assert.match(declaration("> .alo-module-surface", "padding-top")[0], /^max\(/);
  assert.match(
    declaration("> .alo-module-switcher", "top")[0],
    /env\(safe-area-inset-top, 0px\) \+ var\(--alo-header-space, 60px\)/,
  );
  assert.match(declaration("> .app-homebar", "top")[0], /var\(--alo-header-space, 60px\)/);
  assert.match(css, /data-navigation-layout="top"/);
  assert.match(css, /data-navigation-layout="top-tabs"/);
  assert.doesNotMatch(css, /data-navigation-layout="bottom"|data-navigation-layout="floating"/);
});

test("hidden compact menus do not leave a gap between header and expanded navigation", () => {
  assert.match(css, /data-module-menu-visible="false"[^}]*--alo-top-module-offset: 0px/);
  assert.match(css, /@media \(max-width: 767px\)[^}]*--alo-top-module-offset: 0px/);
  assert.match(
    read("alo-mobile.css"),
    /data-navigation-visible="true"\]\[data-navigation-expanded="true"\]:is\(/,
  );
});

test("moving the reserved area retains reduced-motion and swipe protections", () => {
  assert.match(css, /html\[data-module-swipe\][^}]*\.alo-module-surface\s*\{\s*transition: none/);
  assert.match(
    css,
    /prefers-reduced-motion: reduce[^}]*\.alo-module-surface\s*\{\s*transition: none/,
  );
});
