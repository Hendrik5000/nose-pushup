import assert from "node:assert/strict";
import { test } from "node:test";

import { loadFavoriteTeams, toggleFavoriteTeam } from "../src/lib/favorite-teams";

test("favorite teams toggle locally and stay honest without storage", () => {
  assert.deepEqual(loadFavoriteTeams(), []);
  let teams = toggleFavoriteTeam([], "FC Bayern München");
  assert.deepEqual(teams, ["FC Bayern München"]);
  teams = toggleFavoriteTeam(teams, "Borussia Dortmund");
  assert.deepEqual(teams, ["FC Bayern München", "Borussia Dortmund"]);
  teams = toggleFavoriteTeam(teams, "Borussia Dortmund");
  assert.deepEqual(teams, ["FC Bayern München"]);
});

test("favorite team names are trimmed and deduplicated", () => {
  let teams = toggleFavoriteTeam([], "  Arsenal  ");
  assert.deepEqual(teams, ["Arsenal"]);
  teams = toggleFavoriteTeam(teams, "Arsenal");
  assert.deepEqual(teams, []);
  assert.deepEqual(toggleFavoriteTeam([], "   "), []);
});

test("favorite teams stay capped at 20 entries", () => {
  let teams: string[] = [];
  for (let index = 1; index <= 25; index += 1) {
    teams = toggleFavoriteTeam(teams, `Team ${index}`);
  }
  assert.equal(teams.length, 20);
  assert.equal(teams[0], "Team 1");
  assert.equal(teams[19], "Team 20");
});
