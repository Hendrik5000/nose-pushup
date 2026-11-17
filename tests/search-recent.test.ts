import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  forgetRecentSearches,
  loadRecentSearches,
  rememberSearch,
  SEARCH_RECENT_MAX,
  searchRecentStorageKey,
} from "../src/lib/search-recent";

class MemoryStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
  removeItem(key: string) {
    this.entries.delete(key);
  }
}

test("recent searches persist per account, dedupe, cap and stay honest", () => {
  const storage = new MemoryStorage();
  assert.deepEqual(loadRecentSearches(storage, "user-a"), []);

  rememberSearch(storage, "user-a", "Bundesliga");
  rememberSearch(storage, "user-a", "  Pushups  ");
  rememberSearch(storage, "user-a", "Bundesliga");
  assert.deepEqual(loadRecentSearches(storage, "user-a"), ["Bundesliga", "Pushups"]);
  assert.deepEqual(loadRecentSearches(storage, "user-b"), []);
  assert.notEqual(searchRecentStorageKey("user-a"), searchRecentStorageKey("user-b"));

  for (let index = 0; index < SEARCH_RECENT_MAX + 4; index += 1) {
    rememberSearch(storage, "user-a", `Anfrage ${index}`);
  }
  const capped = loadRecentSearches(storage, "user-a");
  assert.equal(capped.length, SEARCH_RECENT_MAX);
  assert.equal(capped[0], `Anfrage ${SEARCH_RECENT_MAX + 3}`);

  assert.deepEqual(rememberSearch(storage, "user-a", "   "), capped);
  assert.throws(() => searchRecentStorageKey("  "));

  forgetRecentSearches(storage, "user-a");
  assert.deepEqual(loadRecentSearches(storage, "user-a"), []);
});

test("the global search offers and records recent queries; the postfach gains read-all and settings links", () => {
  const search = readFileSync(
    new URL("../src/components/alo/GlobalSearch.tsx", import.meta.url),
    "utf8",
  );
  assert.match(search, /from "@\/lib\/search-recent"/);
  assert.match(search, /Zuletzt gesucht/);
  assert.match(search, /rememberSearch\(window\.localStorage, userId, q\)/);
  assert.match(search, /Vergessen/);
  assert.match(search, /void run\(entry\)/);

  const postfach = readFileSync(
    new URL("../src/components/postfach/PostfachPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(postfach, /Alle als gelesen markieren/);
  assert.match(postfach, /params=\{\{ category: "notifications" \}\}/);
  assert.match(postfach, /Benachrichtigungseinstellungen/);
});
