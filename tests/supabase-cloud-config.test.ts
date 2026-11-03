import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const env = read(".env");
const config = read("supabase/config.toml");
const serverClient = read("src/integrations/supabase/client.server.ts");

function envValue(name: string): string {
  const line = env.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  assert.ok(line, `Missing ${name} in tracked .env`);
  return line.slice(name.length + 1).replace(/^['"]|['"]$/g, "");
}

function jwtRef(key: string): string {
  const payload = key.split(".")[1];
  assert.ok(payload, "The historical public anon key must be a JWT");
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(decoded).ref;
}

test("browser and server public settings resolve to the verified old Lovable Cloud", () => {
  const projectId = "dbnlybjlswuvxrccgqah";
  const expectedUrl = `https://${projectId}.supabase.co`;
  assert.equal(envValue("SUPABASE_URL"), expectedUrl);
  assert.equal(envValue("VITE_SUPABASE_URL"), expectedUrl);
  assert.equal(envValue("SUPABASE_PROJECT_ID"), projectId);
  assert.equal(envValue("VITE_SUPABASE_PROJECT_ID"), projectId);
  for (const name of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    const key = envValue(name);
    assert.ok(key.length > 0, `${name} must be configured`);
    assert.doesNotMatch(key, /^(?:sb_secret_|service_role)/i);
    assert.equal(jwtRef(key), projectId);
  }
});

test("Supabase CLI is bound to the old project and migrations/seeds stay disabled", () => {
  assert.match(config, /^project_id\s*=\s*"dbnlybjlswuvxrccgqah"/m);
  assert.match(config, /\[db\.migrations\][\s\S]*?enabled\s*=\s*false/);
  assert.match(config, /\[db\.seed\][\s\S]*?enabled\s*=\s*false/);
});

test("server admin client uses only the platform-managed service-role key", () => {
  assert.match(serverClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(serverClient, /ALO_(?:REBUILD|SUPABASE)_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(serverClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*\|\|/);
});
