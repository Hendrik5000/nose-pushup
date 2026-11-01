import test from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import {
  assertOwner,
  assertWritablePath,
  canonicalPath,
  createPullRequest,
  githubConfig,
  signProposal,
  setGithubFetchForTests,
  type ProposalFile,
} from "../src/lib/mira-github.server";

const owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const env = {
  MIRA_GITHUB_ALLOWED_USER_ID: owner,
  MIRA_GITHUB_APP_ID: "123",
  MIRA_GITHUB_INSTALLATION_ID: "456",
  MIRA_GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const BASE = "a".repeat(40),
  ROOT_TREE = "b".repeat(40),
  BLOB = "c".repeat(40),
  BRANCH_COMMIT = "d".repeat(40),
  PROPOSED_TREE = "e".repeat(40);
const envKeys = Object.keys(env) as Array<keyof typeof env>;

async function withTestConfig<T>(fn: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  setGithubFetchForTests(undefined);
  try {
    return await fn();
  } finally {
    setGithubFetchForTests(undefined);
    for (const key of envKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function createGithubMock(options: { refStatus?: number; tokenExpiryMs?: number } = {}) {
  const calls: Array<{
    method: string;
    path: string;
    search: string;
    body?: Record<string, unknown>;
  }> = [];
  const tokenPermissions: Array<Record<string, unknown>> = [];
  const commits = new Map<string, Record<string, unknown>>();
  let branchCommit: string | null = null;
  let commitMessage = "";
  let pullUrl: string | null = null;
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init.method ?? "GET";
    const path = url.pathname.replace("/repos/Hendrik5000/nose-pushup", "");
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path, search: url.search, ...(body ? { body } : {}) });

    if (url.pathname === "/app/installations/456/access_tokens") {
      const permissions = (body?.permissions ?? {}) as Record<string, unknown>;
      tokenPermissions.push(permissions);
      return Response.json({
        token: `mock-${permissions.contents}-${permissions.pull_requests ?? "none"}`,
        expires_at: new Date(Date.now() + (options.tokenExpiryMs ?? 30 * 60_000)).toISOString(),
      });
    }
    if (method === "GET" && path === "/git/ref/heads/main")
      return Response.json({ object: { sha: BASE } });
    if (method === "GET" && path === `/git/commits/${BASE}`)
      return Response.json({ tree: { sha: ROOT_TREE } });
    if (method === "GET" && path === `/git/trees/${ROOT_TREE}`)
      return Response.json({
        truncated: false,
        tree: [
          { path: "src", type: "tree", mode: "040000", sha: "9".repeat(40) },
          { path: "src/a.ts", type: "blob", mode: "100644", sha: BLOB, size: 4 },
          { path: "src/link", type: "blob", mode: "120000", sha: "f".repeat(40), size: 9 },
          { path: "vendor/submodule", type: "commit", mode: "160000", sha: "8".repeat(40) },
          { path: ".env/key.ts", type: "blob", mode: "100644", sha: "1".repeat(40), size: 10 },
          {
            path: "docs/AI-HANDOFF.md",
            type: "blob",
            mode: "100644",
            sha: "2".repeat(40),
            size: 10,
          },
        ],
      });
    if (method === "GET" && path === `/git/blobs/${BLOB}`)
      return Response.json({
        content: Buffer.from("old\n").toString("base64"),
        encoding: "base64",
      });
    if (method === "GET" && path === `/git/blobs/${"7".repeat(40)}`)
      return Response.json({ content: "", encoding: "base64" });
    if (method === "GET" && path.startsWith("/git/ref/heads/mira/")) {
      if (options.refStatus && options.refStatus !== 404)
        return Response.json({ message: "mock failure" }, { status: options.refStatus });
      if (!branchCommit) return Response.json({ message: "Not Found" }, { status: 404 });
      return Response.json({ object: { sha: branchCommit } });
    }
    if (method === "POST" && path === "/git/trees") return Response.json({ sha: PROPOSED_TREE });
    if (method === "POST" && path === "/git/commits") {
      commitMessage = String(body?.message ?? "");
      commits.set(BRANCH_COMMIT, {
        tree: { sha: PROPOSED_TREE },
        parents: [{ sha: BASE }],
        message: commitMessage,
      });
      return Response.json({ sha: BRANCH_COMMIT });
    }
    if (method === "GET" && path === `/git/commits/${BRANCH_COMMIT}`) {
      const commit = commits.get(BRANCH_COMMIT);
      return commit
        ? Response.json(commit)
        : Response.json({ message: "Not Found" }, { status: 404 });
    }
    if (method === "POST" && path === "/git/refs") {
      branchCommit = String(body?.sha ?? "");
      return Response.json({ ref: body?.ref, object: { sha: branchCommit } }, { status: 201 });
    }
    if (method === "GET" && path === "/pulls")
      return Response.json(pullUrl ? [{ html_url: pullUrl }] : []);
    if (method === "POST" && path === "/pulls") {
      pullUrl = "https://github.com/Hendrik5000/nose-pushup/pull/321";
      return Response.json({ html_url: pullUrl }, { status: 201 });
    }
    return Response.json({ message: "Unexpected mock request" }, { status: 500 });
  };
  return {
    fetcher,
    calls,
    tokenPermissions,
    get commitMessage() {
      return commitMessage;
    },
  };
}

function proposal(files: ProposalFile[], baseSha = BASE) {
  return signProposal({
    userId: owner,
    baseSha,
    title: "Update selected files",
    body: "A user-reviewed proposal",
    files,
    expires: Date.now() + 60_000,
  });
}

test("path policy rejects traversal, encoding, Unicode, case collisions and protected documents/secrets", () => {
  for (const path of [
    "../x",
    "/etc/passwd",
    "a\\b",
    "%2e%2e/x",
    "README.md",
    "readme.MD",
    "docs/AI-ROADMAP.md",
    ".ENV",
    ".env/production.ts",
    "secrets/key.pem",
    "secrets/config.ts",
    ".ssh/id_rsa",
    "credentials.json",
    "service-account.json",
    "foo/.git/config",
    "keys/client.CRT",
    "a/./b",
    "a//b",
    "nonascii/é.ts",
    "foo.",
  ])
    assert.throws(() => canonicalPath(path), path);
  assert.equal(canonicalPath("src/hello.ts"), "src/hello.ts");
});
test("write policy rejects package, lock, SQL, generated, supabase, GitHub and secret paths", () => {
  for (const path of [
    "supabase/migrations/a.sql",
    "Supabase/x",
    ".github/workflows/ci.yml",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "src/routeTree.gen.ts",
    "docs/ok.sql",
    "src/.env.local",
    "src/id_rsa",
  ])
    assert.throws(() => assertWritablePath(path), path);
  assert.equal(assertWritablePath("src/new-feature.ts"), "src/new-feature.ts");
});
test("owner gate requires exactly one strict UUID and exact identity", () => {
  assertOwner(owner, env);
  assert.throws(() => assertOwner(other, env));
  assert.throws(() => assertOwner("not-a-uuid", env));
  assert.throws(() => assertOwner(owner, { ...env, MIRA_GITHUB_ALLOWED_USER_ID: "*" }));
  assert.throws(() => assertOwner(owner, {}));
});
test("GitHub app configuration fails closed when secrets are absent/malformed", () => {
  assert.throws(() => githubConfig({}));
  assert.throws(() => githubConfig({ ...env, MIRA_GITHUB_APP_ID: "x" }));
  assert.throws(() => githubConfig({ ...env, MIRA_GITHUB_APP_PRIVATE_KEY: "" }));
});
test("proposal token is signed, bound to user, expiry and immutable before/after preview", () =>
  withTestConfig(async () => {
    const token = proposal([{ path: "src/a.ts", before: "old", after: "new" }]);
    assert.equal(typeof token, "string");
    assert.notEqual(token, proposal([{ path: "src/a.ts", before: "old", after: "new" }]));
    const [payload, signature] = token.split("."),
      altered = Buffer.from(
        JSON.stringify({
          ...JSON.parse(
            Buffer.from(payload, "base64url").toString().slice("mira-github-proposal-v1\n".length),
          ),
          files: [{ path: "src/a.ts", before: "tampered", after: "new" }],
        }),
      ).toString("base64url"),
      verifier = createVerify("RSA-SHA256");
    verifier.update(`mira-github-proposal-v1\n${altered}`);
    assert.equal(
      verifier.verify(createPublicKey(privateKey), Buffer.from(signature, "base64url")),
      false,
    );
    assert.throws(() =>
      signProposal({
        userId: owner,
        baseSha: "main",
        title: "x",
        body: "",
        files: [{ path: "src/a.ts", before: "", after: "x" }],
        expires: Date.now() + 60_000,
      }),
    );
  }));
test("mocked GitHub flow mints least-permission tokens and creates only a mira/* branch and main PR", () =>
  withTestConfig(async () => {
    const mock = createGithubMock();
    setGithubFetchForTests(mock.fetcher);
    const result = await createPullRequest(
      proposal([{ path: "src/a.ts", before: "old\n", after: "new\n" }]),
      owner,
    );
    assert.equal(result.url, "https://github.com/Hendrik5000/nose-pushup/pull/321");
    assert.equal(result.replay, false);
    assert.deepEqual(mock.tokenPermissions, [
      { contents: "read", metadata: "read" },
      { contents: "write", pull_requests: "write", metadata: "read" },
    ]);
    const repoWrites = mock.calls.filter(
      (call) =>
        (call.method !== "GET" && call.path.startsWith("/git/")) ||
        (call.path === "/pulls" && call.method === "POST"),
    );
    assert.deepEqual(
      repoWrites.map((call) => call.path),
      ["/git/trees", "/git/commits", "/git/refs", "/pulls"],
    );
    const refWrite = repoWrites.find((call) => call.path === "/git/refs");
    assert.match(String(refWrite?.body?.ref), /^refs\/heads\/mira\/[0-9a-f-]{36}$/);
    const prWrite = repoWrites.find((call) => call.path === "/pulls");
    assert.equal(prWrite?.body?.base, "main");
    assert.match(String(prWrite?.body?.head), /^mira\/[0-9a-f-]{36}$/);
    assert.equal(
      repoWrites.some((call) => /main/.test(String(call.body?.ref ?? ""))),
      false,
    );
    assert.equal(
      mock.calls.some((call) => ["PATCH", "PUT", "DELETE"].includes(call.method)),
      false,
    );
    assert.equal(JSON.stringify(result).includes("mock-write-write"), false);
  }));
test("new file with empty before creates a mira UUID branch and pull request", () =>
  withTestConfig(async () => {
    const mock = createGithubMock();
    setGithubFetchForTests(mock.fetcher);
    const result = await createPullRequest(
      proposal([{ path: "src/new-file.ts", before: "", after: "export const added = true;\n" }]),
      owner,
    );
    assert.equal(result.url, "https://github.com/Hendrik5000/nose-pushup/pull/321");
    assert.equal(result.replay, false);
    const branch = mock.calls.find((call) => call.path === "/git/refs" && call.method === "POST");
    assert.match(String(branch?.body?.ref), /^refs\/heads\/mira\/[0-9a-f-]{36}$/);
    const pr = mock.calls.find((call) => call.path === "/pulls" && call.method === "POST");
    assert.match(String(pr?.body?.head), /^mira\/[0-9a-f-]{36}$/);
    assert.equal(pr?.body?.base, "main");
  }));
test("a genuinely empty existing file can be read and replaced", () =>
  withTestConfig(async () => {
    const mock = createGithubMock();
    const original = mock.fetcher;
    setGithubFetchForTests(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.endsWith(`/git/trees/${ROOT_TREE}`)) {
        const response = await original(input, init);
        const data = (await response.json()) as { tree: Array<Record<string, unknown>> };
        data.tree.push({
          path: "src/empty.ts",
          type: "blob",
          mode: "100644",
          sha: "7".repeat(40),
          size: 0,
        });
        return Response.json(data);
      }
      return original(input, init);
    });
    const result = await createPullRequest(
      proposal([{ path: "src/empty.ts", before: "", after: "export {};\n" }]),
      owner,
    );
    assert.equal(result.replay, false);
    assert.ok(mock.calls.some((call) => call.path === "/git/refs" && call.method === "POST"));
  }));
test("exact directory casing supports new and changed files while wrong casing fails before writes", () =>
  withTestConfig(async () => {
    for (const [path, before, accepted] of [
      ["src/MixedCase/new.ts", "", true],
      ["src/MixedCase/existing.ts", "old\n", true],
      ["src/mixedcase/new.ts", "", false],
    ] as const) {
      const mock = createGithubMock();
      const original = mock.fetcher;
      setGithubFetchForTests(async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.pathname.endsWith(`/git/trees/${ROOT_TREE}`)) {
          const response = await original(input, init);
          const data = (await response.json()) as { tree: Array<Record<string, unknown>> };
          data.tree.push(
            { path: "src/MixedCase", type: "tree", mode: "040000", sha: "6".repeat(40) },
            { path: "src/MixedCase/existing.ts", type: "blob", mode: "100644", sha: BLOB, size: 4 },
          );
          return Response.json(data);
        }
        return original(input, init);
      });
      const run = createPullRequest(proposal([{ path, before, after: "new\n" }]), owner);
      if (accepted) {
        assert.equal((await run).replay, false);
        assert.ok(mock.calls.some((call) => call.path === "/git/refs" && call.method === "POST"));
      } else {
        await assert.rejects(run, /conflicts with an existing file/);
        assert.equal(
          mock.calls.some(
            (call) =>
              ["/git/trees", "/git/commits", "/git/refs", "/pulls"].includes(call.path) &&
              call.method === "POST",
          ),
          false,
        );
      }
    }
  }));
test("new file with nonempty before is rejected before any repository write", () =>
  withTestConfig(async () => {
    const mock = createGithubMock();
    setGithubFetchForTests(mock.fetcher);
    await assert.rejects(
      createPullRequest(
        proposal([{ path: "src/new.ts", before: "unexpected", after: "new" }]),
        owner,
      ),
      /Preview no longer matches base/,
    );
    assert.equal(
      mock.calls.some(
        (call) =>
          ["/git/trees", "/git/commits", "/git/refs", "/pulls"].includes(call.path) &&
          call.method === "POST",
      ),
      false,
    );
  }));
test("mocked PR replay is idempotent and does not create a second branch or PR", () =>
  withTestConfig(async () => {
    const mock = createGithubMock();
    setGithubFetchForTests(mock.fetcher);
    const token = proposal([{ path: "src/a.ts", before: "old\n", after: "new\n" }]);
    const first = await createPullRequest(token, owner);
    const second = await createPullRequest(token, owner);
    assert.equal(first.replay, false);
    assert.equal(second.replay, true);
    assert.equal(second.url, first.url);
    assert.equal(
      mock.calls.filter((call) => call.path === "/git/refs" && call.method === "POST").length,
      1,
    );
    assert.equal(
      mock.calls.filter((call) => call.path === "/pulls" && call.method === "POST").length,
      1,
    );
  }));
test("a GitHub 500 while checking a mira ref is not mistaken for a missing branch", () =>
  withTestConfig(async () => {
    const mock = createGithubMock({ refStatus: 500 });
    setGithubFetchForTests(mock.fetcher);
    await assert.rejects(
      createPullRequest(proposal([{ path: "src/a.ts", before: "old\n", after: "new\n" }]), owner),
      /Unavailable/,
    );
    assert.equal(
      mock.calls.some((call) => ["/git/trees", "/git/refs", "/pulls"].includes(call.path)),
      false,
    );
  }));
test("a proposal cannot create a child beneath an existing symlink", () =>
  withTestConfig(async () => {
    const mock = createGithubMock();
    setGithubFetchForTests(mock.fetcher);
    await assert.rejects(
      createPullRequest(
        proposal([{ path: "src/link/child.ts", before: "", after: "new\n" }]),
        owner,
      ),
      /conflicts with an existing file/,
    );
    assert.equal(
      mock.calls.some((call) => ["/git/trees", "/git/refs", "/pulls"].includes(call.path)),
      false,
    );
  }));
test("unsafe exact targets, file ancestors, case collisions and submodule paths are rejected before writes", () =>
  withTestConfig(async () => {
    for (const path of [
      "src/link",
      "src/a.ts/child.ts",
      "SRC/a.ts",
      "vendor/submodule",
      "vendor/submodule/child.ts",
      "src",
    ]) {
      const mock = createGithubMock();
      setGithubFetchForTests(mock.fetcher);
      await assert.rejects(
        createPullRequest(proposal([{ path, before: "", after: "new" }]), owner),
        /conflicts with an existing file/,
        path,
      );
      assert.equal(
        mock.calls.some(
          (call) =>
            ["/git/trees", "/git/commits", "/git/refs", "/pulls"].includes(call.path) &&
            call.method === "POST",
        ),
        false,
        path,
      );
    }
  }));
test("invalid, expired or cross-owner signed proposals make no GitHub request", () =>
  withTestConfig(async () => {
    const mock = createGithubMock();
    setGithubFetchForTests(mock.fetcher);
    const token = proposal([{ path: "src/a.ts", before: "old\n", after: "new\n" }]);
    await assert.rejects(createPullRequest(token, other), /Invalid proposal/);
    await assert.rejects(createPullRequest(`${token}x`, owner), /Invalid proposal/);
    assert.equal(mock.calls.length, 0);
  }));
test("installation tokens that outlive the short-lived bound are rejected", () =>
  withTestConfig(async () => {
    const mock = createGithubMock({ tokenExpiryMs: 2 * 60 * 60_000 });
    setGithubFetchForTests(mock.fetcher);
    await assert.rejects(
      createPullRequest(proposal([{ path: "src/a.ts", before: "old\n", after: "new\n" }]), owner),
      /Unavailable/,
    );
    assert.equal(
      mock.calls.some((call) => call.path.startsWith("/repos/")),
      false,
    );
  }));
