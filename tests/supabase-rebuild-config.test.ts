import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const env = read(".env");
const config = read("supabase/config.toml");
const serverClient = read("src/integrations/supabase/client.server.ts");
const serverPublicConfigFiles = [
  "src/integrations/supabase/auth-middleware.ts",
  "src/lib/mcp/tools/get-leaderboard.ts",
  "src/lib/mcp/tools/get-my-profile.ts",
  "src/lib/mcp/tools/list-my-workouts.ts",
  "src/lib/mcp/tools/log-workout.ts",
].map(read);

function envValue(name: string): string {
  const line = env.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  assert.ok(line, `Missing ${name} in tracked .env`);
  return line.slice(name.length + 1).replace(/^['"]|['"]$/g, "");
}

test("tracked browser and SSR Supabase settings target the Alo Rebuild project", () => {
  for (const name of ["VITE_SUPABASE_URL", "SUPABASE_URL"]) {
    assert.match(envValue(name), /nyxojeadroaxixdxczsa/);
  }
  for (const name of ["VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID"]) {
    assert.equal(envValue(name), "nyxojeadroaxixdxczsa");
  }
});

test("tracked public keys are not secret keys", () => {
  for (const name of ["VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY"]) {
    const value = envValue(name);
    assert.ok(value.length > 0, `${name} must be configured`);
    assert.doesNotMatch(value, /^(?:sb_secret_|service_role)/i);
    assert.doesNotMatch(value, /service_role/i);
  }
});

test("automatic database migrations and seeding remain disabled", () => {
  assert.match(config, /\[db\.migrations\][\s\S]*?enabled\s*=\s*false/);
  assert.match(config, /\[db\.seed\][\s\S]*?enabled\s*=\s*false/);
});

test("server client uses only the explicitly approved service-role variable", () => {
  assert.match(serverClient, /process\.env\.ALO_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(serverClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test("server public config gives VITE values precedence over runtime values", () => {
  for (const source of serverPublicConfigFiles) {
    assert.match(
      source,
      /import\.meta\.env\.VITE_SUPABASE_URL\s*\|\|\s*process\.env\.SUPABASE_URL/,
    );
    assert.match(
      source,
      /import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY\s*\|\|\s*process\.env\.SUPABASE_PUBLISHABLE_KEY/,
    );
  }
});
