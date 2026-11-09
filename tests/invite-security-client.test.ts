import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Source contracts supplement (and do not replace) the real PostgreSQL role/concurrency tests.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const battles = read("src/lib/battle.functions.ts");
const clubs = read("src/lib/club.functions.ts");
const lobby = read("src/routes/_authenticated/battle.index.tsx");
const clubPage = read("src/routes/_authenticated/clubs.tsx");

function serverFunction(source: string, name: string): string {
  const tail = source.slice(source.indexOf(`export const ${name} =`));
  assert.ok(tail.startsWith(`export const ${name} =`), `${name} exists`);
  const next = tail.indexOf("\nexport const ", 1);
  return next < 0 ? tail : tail.slice(0, next);
}

test("code joins use authenticated user RPCs and never a privileged service client or direct claim", () => {
  for (const [source, name, rpc] of [
    [battles, "joinBattle", "join_battle_by_code"],
    [clubs, "joinClubByCode", "join_club_by_invite_code"],
  ]) {
    const handler = serverFunction(source, name);
    assert.match(handler, /middleware\(\[requireSupabaseAuth\]\)/);
    assert.match(handler, /normalizeInviteCode/);
    assert.match(handler, /isValidInviteCode/);
    assert.ok(handler.includes(`"${rpc}"`));
    assert.match(handler, /if \(error\) throw inviteRpcUnavailable\(\)/);
    assert.doesNotMatch(handler, /supabaseAdmin|\.from\(|\.update\(|user_id:|p_user_id:|actor_id:/);
  }
  assert.doesNotMatch(battles + clubs, /Math\.random|joinRateBuckets|checkJoinRateLimit/);
});

test("public matchmaking and cancellation use dedicated RPCs, not direct private-table claims", () => {
  for (const [name, rpc] of [
    ["findMatch", "find_public_battle_match"],
    ["leaveQueue", "leave_public_battle_queue"],
  ]) {
    const handler = serverFunction(battles, name);
    assert.ok(handler.includes(`"${rpc}"`));
    assert.match(handler, /middleware\(\[requireSupabaseAuth\]\)/);
    assert.doesNotMatch(handler, /supabaseAdmin|\.from\(|\.delete\(|\.update\(/);
  }
  assert.match(serverFunction(battles, "createBattle"), /is_private: true/);
  assert.doesNotMatch(lobby, /from\("battle_queue"|dequeue\(\{\}\)/);
  assert.match(lobby, /matchRequest\.current/);
  assert.match(lobby, /dequeue\(\{ data: \{ id \} \}\)/);
  assert.match(lobby, /if \(result\.matched\) navigate/);
});

test("both invitation inputs accept pasted secure codes and reject legacy-short submission", () => {
  for (const page of [lobby, clubPage]) {
    assert.match(page, /maxLength=\{64\}/);
    assert.match(page, /!isValidInviteCode\(normalizeInviteCode\(code\)\)/);
    assert.match(page, /aria-label="(?:Battle|Club)-Einladungscode"/);
    assert.doesNotMatch(page, /code\.length < 4|maxLength=\{8\}/);
  }
});

test("new long-code UI copies only on explicit action and never persists bearer invitations", () => {
  const component = read("src/components/InviteCode.tsx");
  assert.match(component, /navigator\.clipboard\.writeText\(code\)/);
  assert.match(component, /onClick=\{\(\) => void copyCode\(\)\}/);
  assert.match(component, /role="status"/);
  assert.doesNotMatch(
    component,
    /localStorage|sessionStorage|fetch\(|console\.|sendBeacon|setInterval/,
  );
  assert.match(
    read("src/routes/_authenticated/battle.$id.tsx"),
    /<InviteCode code=\{battle.code\}/,
  );
  assert.match(clubPage, /<InviteCode code=\{club.code\}/);
});
