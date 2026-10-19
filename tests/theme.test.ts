import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { DEFAULT_THEME, THEMES, applyTheme, getStoredTheme, isThemeId } from "../src/lib/theme";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

function mockGlobals(
  options: { stored?: string | null; blockedRead?: boolean; blockedWrite?: boolean } = {},
) {
  const storage = new Map<string, string>();
  if (options.stored !== undefined && options.stored !== null)
    storage.set("np-theme", options.stored);
  const localStorage = {
    getItem(key: string) {
      if (options.blockedRead) throw new Error("blocked storage");
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.blockedWrite) throw new Error("blocked storage");
      storage.set(key, value);
    },
  };
  const metas: Array<{ attributes: Record<string, string>; removed: boolean }> = [];
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
    head: { appendChild: (element: (typeof metas)[number]) => metas.push(element) },
    querySelectorAll(selector: string) {
      assert.equal(selector, 'meta[name="theme-color"]');
      return metas.filter((meta) => !meta.removed);
    },
    createElement(tag: string) {
      assert.equal(tag, "meta");
      const element: (typeof metas)[number] = {
        attributes: {},
        removed: false,
      };
      Object.assign(element, {
        setAttribute(name: string, value: string) {
          element.attributes[name] = value;
        },
        remove() {
          element.removed = true;
        },
      });
      return element;
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  return { storage, metas, document };
}

function restoreGlobal(name: "window" | "document", descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}

afterEach(() => {
  restoreGlobal("window", originalWindow);
  restoreGlobal("document", originalDocument);
});

test("catalog contains each existing and new theme ID exactly once", () => {
  const expected = [
    "solar",
    "ember",
    "aqua",
    "neon",
    "violet",
    "mono",
    "daylight",
    "sand",
    "forest",
    "midnight",
    "rose",
    "contrast",
  ];
  assert.deepEqual(
    THEMES.map((theme) => theme.id),
    expected,
  );
  for (const id of expected) assert.equal(isThemeId(id), true);
  assert.equal(isThemeId("not-a-theme"), false);
  assert.equal(isThemeId(null), false);
  assert.equal(DEFAULT_THEME, "solar");
  for (const theme of THEMES) {
    assert.ok(["light", "dark"].includes(theme.mode));
    assert.match(theme.background, /^#[\da-f]{6}$/i);
    assert.match(theme.card, /^#[\da-f]{6}$/i);
    assert.match(theme.foreground, /^#[\da-f]{6}$/i);
    assert.equal(theme.swatch.length, 2);
  }
});

test("stored theme falls back for SSR, missing and invalid values, and blocked storage", () => {
  restoreGlobal("window", undefined);
  assert.equal(getStoredTheme(), DEFAULT_THEME);
  assert.doesNotThrow(() => applyTheme("solar"));
  mockGlobals({ stored: "forest" });
  assert.equal(getStoredTheme(), "forest");
  mockGlobals({ stored: "invalid" });
  assert.equal(getStoredTheme(), DEFAULT_THEME);
  mockGlobals({ blockedRead: true });
  assert.equal(getStoredTheme(), DEFAULT_THEME);
});

test("applyTheme updates data-theme, persists, and sets the matching theme-color meta", () => {
  const { storage, metas, document } = mockGlobals();
  for (const theme of THEMES) {
    applyTheme(theme.id);
    assert.equal(document.documentElement.dataset.theme, theme.id);
    assert.equal(storage.get("np-theme"), theme.id);
    const activeMetas = metas.filter((meta) => !meta.removed);
    assert.equal(activeMetas.length, 1);
    assert.equal(activeMetas[0]?.attributes.name, "theme-color");
    assert.equal(activeMetas[0]?.attributes.content, theme.background);
  }
});

test("applyTheme still updates document when storage writes are blocked", () => {
  const { document, metas } = mockGlobals({ blockedWrite: true });
  assert.doesNotThrow(() => applyTheme("daylight"));
  assert.equal(document.documentElement.dataset.theme, "daylight");
  assert.equal(metas.filter((meta) => !meta.removed)[0]?.attributes.content, "#f4f8ff");
});

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(a: string, b: string) {
  const [bright, dark] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (bright! + 0.05) / (dark! + 0.05);
}

test("new themes define all semantic CSS tokens and readable foreground pairs", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const newIds = ["daylight", "sand", "forest", "midnight", "rose", "contrast"] as const;
  const requiredTokens = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "border",
    "input",
    "ring",
    "seg-track",
    "seg-active",
    "shadow",
    "glow-1",
    "glow-2",
  ];
  for (const id of newIds) {
    const theme = THEMES.find((item) => item.id === id)!;
    const block = css.match(new RegExp(`\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(block, `missing CSS block for ${id}`);
    for (const token of requiredTokens)
      assert.match(block!, new RegExp(`--${token}\\s*:`), `${id} missing --${token}`);
    assert.match(block!, new RegExp(`color-scheme:\\s*${theme.mode}`));
    assert.ok(
      contrast(theme.foreground, theme.background) >= 4.5,
      `${id}: foreground/background contrast`,
    );
    assert.ok(contrast(theme.foreground, theme.card) >= 4.5, `${id}: card foreground contrast`);

    const primary = block!.match(/--primary:\s*(#[\da-f]{6})/i)?.[1];
    const primaryForeground = block!.match(/--primary-foreground:\s*(#[\da-f]{6})/i)?.[1];
    assert.ok(primary && primaryForeground, `${id}: primary colors are explicit`);
    assert.ok(contrast(primary, primaryForeground) >= 4.5, `${id}: primary foreground contrast`);
  }
});
