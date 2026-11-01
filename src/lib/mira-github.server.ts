import { createHash, createPrivateKey, createSign, createVerify, randomUUID } from "node:crypto";

export const REPO = "Hendrik5000/nose-pushup";
const INTERNAL = new Set([
  "agents.md",
  "readme.md",
  "replit.md",
  "docs/ai-handoff.md",
  "docs/ai-team.md",
  "docs/ai-roadmap.md",
  ".github/copilot-instructions.md",
]);
const SECRET =
  /(^|\/)(\.env(?:\.[^/]*)?|[^/]*(?:credential|secret|token|password|service[-_]?account|id_rsa|id_ed25519|authorized_keys|known_hosts)[^/]*|[^/]*\.(?:pem|key|crt|cer|p12|pfx|jks|keystore|asc))$/i;
const SECRET_SEGMENT =
  /^(?:\.env(?:\..*)?|.*(?:credential|secret|token|password|service[-_]?account|id_rsa|id_ed25519|authorized_keys|known_hosts).*|.*\.(?:pem|key|crt|cer|p12|pfx|jks|keystore|asc))$/i;
const LOCK =
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const enc = (s: string) => Buffer.from(s, "utf8");
const api = "https://api.github.com";
const maxFile = 40_000,
  maxProposal = 200_000;
export function canonicalPath(input: unknown): string {
  if (
    typeof input !== "string" ||
    !input ||
    input.length > 300 ||
    input.startsWith("/") ||
    input.includes("\\") ||
    input.includes("%") ||
    /[^\x20-\x7e]/.test(input)
  )
    throw new Error("Invalid path");
  const parts = input.split("/");
  if (parts.some((x) => !x || x === "." || x === ".." || x.endsWith(".") || /[<>:"|?*]/.test(x)))
    throw new Error("Invalid path");
  const path = parts.join("/");
  if (
    INTERNAL.has(path.toLowerCase()) ||
    SECRET.test(path) ||
    parts.some((part) => SECRET_SEGMENT.test(part)) ||
    /(^|\/)\.git(\/|$)/i.test(path) ||
    /(^|\/)\.ssh(\/|$)/i.test(path)
  )
    throw new Error("Path restricted");
  return path;
}
export function assertWritablePath(v: unknown): string {
  const p = canonicalPath(v),
    low = p.toLowerCase();
  if (
    low === "package.json" ||
    low.startsWith("supabase/") ||
    low.startsWith(".github/") ||
    LOCK.test(p) ||
    low === "src/routetree.gen.ts" ||
    low.endsWith(".sql") ||
    /(^|\/)(\.git|\.ssh)(\/|$)/i.test(p)
  )
    throw new Error("Path restricted");
  return p;
}
export type RepoTree = {
  baseSha: string;
  files: Array<{ path: string; size: number; sha: string }>;
  leafPaths: string[];
};
export function assertOwner(userId: string, env = process.env) {
  const allow = env.MIRA_GITHUB_ALLOWED_USER_ID;
  if (!UUID.test(userId) || !allow || !UUID.test(allow) || userId !== allow)
    throw new Error("Unavailable");
}
export function githubConfig(env = process.env) {
  const appId = env.MIRA_GITHUB_APP_ID,
    installationId = env.MIRA_GITHUB_INSTALLATION_ID,
    pem = env.MIRA_GITHUB_APP_PRIVATE_KEY;
  if (!appId || !/^\d+$/.test(appId) || !installationId || !/^\d+$/.test(installationId) || !pem)
    throw new Error("Unavailable");
  return { appId, installationId, pem: pem.replace(/\\n/g, "\n") };
}
const cache = new Map<string, { token: string; expires: number }>();
let fetchOverride: typeof fetch | undefined;
export function setGithubFetchForTests(f?: typeof fetch) {
  fetchOverride = f;
  cache.clear();
}
const getFetch = () => fetchOverride ?? fetch;
function appJwt() {
  const { appId, pem } = githubConfig(),
    now = Math.floor(Date.now() / 1000),
    part = (v: object) => enc(JSON.stringify(v)).toString("base64url");
  const data = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iat: now - 30, exp: now + 8 * 60, iss: appId })}`,
    s = createSign("RSA-SHA256");
  s.update(data);
  return `${data}.${s.sign(createPrivateKey(pem)).toString("base64url")}`;
}
async function installationToken(mode: "read" | "write") {
  const { installationId } = githubConfig(); // recheck config even when using cache
  const key = `${installationId}:${mode}`,
    old = cache.get(key);
  if (old && old.expires > Date.now() + 60_000) return old.token;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const r = await getFetch()(`${api}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${appJwt()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repositories: ["nose-pushup"],
        permissions:
          mode === "read"
            ? { contents: "read", metadata: "read" }
            : { contents: "write", pull_requests: "write", metadata: "read" },
      }),
    });
    if (r.status >= 300 && r.status < 400) throw new Error("Unavailable");
    if (!r.ok) throw new Error("Unavailable");
    const d = (await r.json()) as { token?: string; expires_at?: string };
    const expires = Date.parse(d.expires_at ?? "");
    if (
      !d.token ||
      !Number.isFinite(expires) ||
      expires <= Date.now() ||
      expires > Date.now() + 3_600_000
    )
      throw new Error("Unavailable");
    cache.set(key, { token: d.token, expires });
    return d.token;
  } catch {
    throw new Error("Unavailable");
  } finally {
    clearTimeout(timer);
  }
}
const READ =
  /^\/(git\/ref\/heads\/main|git\/commits\/[0-9a-f]{40}|git\/trees\/[0-9a-f]{40}\?recursive=1|git\/blobs\/[0-9a-f]{40}|pulls\?state=all&head=[A-Za-z0-9%:_/-]+&base=main)$/;
const MIRA_REF =
  /^\/git\/ref\/heads\/mira\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WRITE_PATHS = new Set(["/git/trees", "/git/commits", "/git/refs", "/pulls"]);
async function gh(
  path: string,
  mode: "read" | "write" = "read",
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const readRequest = method === "GET" && (READ.test(path) || MIRA_REF.test(path));
  const writeRequest = mode === "write" && method === "POST" && WRITE_PATHS.has(path);
  if (!path.startsWith("/") || (!readRequest && !writeRequest)) throw new Error("Unavailable");
  if (writeRequest) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Unavailable");
    const data = body as Record<string, unknown>;
    if (path === "/git/refs") {
      if (
        typeof data.ref !== "string" ||
        !/^refs\/heads\/mira\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          data.ref,
        ) ||
        typeof data.sha !== "string" ||
        !sha(data.sha)
      )
        throw new Error("Unavailable");
    } else if (path === "/pulls") {
      if (
        data.base !== "main" ||
        typeof data.head !== "string" ||
        !/^mira\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          data.head,
        ) ||
        typeof data.title !== "string" ||
        data.title.length > 180 ||
        typeof data.body !== "string" ||
        data.body.length > 4000
      )
        throw new Error("Unavailable");
    } else if (path === "/git/trees") {
      if (
        typeof data.base_tree !== "string" ||
        !sha(data.base_tree) ||
        !Array.isArray(data.tree) ||
        data.tree.length < 1 ||
        data.tree.length > 8
      )
        throw new Error("Unavailable");
      for (const item of data.tree) {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new Error("Unavailable");
        const entry = item as Record<string, unknown>;
        assertWritablePath(entry.path);
        if (entry.mode !== "100644" || entry.type !== "blob" || typeof entry.content !== "string")
          throw new Error("Unavailable");
      }
    } else if (path === "/git/commits") {
      if (
        typeof data.message !== "string" ||
        !data.message.includes("Mira proposal ") ||
        typeof data.tree !== "string" ||
        !sha(data.tree) ||
        !Array.isArray(data.parents) ||
        data.parents.length !== 1 ||
        typeof data.parents[0] !== "string" ||
        !sha(data.parents[0])
      )
        throw new Error("Unavailable");
    }
  }
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    const r = await getFetch()(`${api}/repos/${REPO}${path}`, {
      method,
      redirect: "manual",
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${await installationToken(mode)}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.status >= 300 && r.status < 400) throw new Error("Unavailable");
    if (!r.ok) {
      const e = new Error("Unavailable") as Error & { status: number };
      e.status = r.status;
      throw e;
    }
    if (r.status === 204) return null;
    const text = await r.text();
    if (text.length > 1_000_000) throw new Error("Unavailable");
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof Error && "status" in e) throw e;
    throw new Error("Unavailable");
  } finally {
    clearTimeout(timer);
  }
}
function sha(v: string) {
  return /^[a-f0-9]{40}$/i.test(v);
}
function safePrUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.origin === "https://github.com" &&
      /^\/Hendrik5000\/nose-pushup\/pull\/\d+$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
export async function repoTree() {
  const ref = (await gh("/git/ref/heads/main")) as { object: { sha: string } };
  if (!sha(ref.object.sha)) throw new Error("Unavailable");
  const c = (await gh(`/git/commits/${ref.object.sha}`)) as { tree: { sha: string } };
  const t = (await gh(`/git/trees/${c.tree.sha}?recursive=1`)) as {
    truncated?: boolean;
    tree: Array<{ path: string; type: string; mode: string; sha: string; size?: number }>;
  };
  if (t.truncated || !Array.isArray(t.tree)) throw new Error("Repository tree unavailable");
  const leafPaths = t.tree.flatMap((item) =>
    item.type === "blob" && typeof item.path === "string" ? [item.path] : [],
  );
  const files = t.tree
    .filter((x) => x.type === "blob" && ["100644", "100755"].includes(x.mode))
    .flatMap((x) => {
      try {
        const path = canonicalPath(x.path);
        if ((x.size ?? 0) > maxFile) return [];
        return [{ path, size: x.size ?? 0, sha: x.sha }];
      } catch {
        return [];
      }
    });
  const seen = new Set<string>();
  for (const f of files) {
    const k = f.path.toLowerCase();
    if (seen.has(k)) throw new Error("Repository paths ambiguous");
    seen.add(k);
  }
  return { baseSha: ref.object.sha, files: files.slice(0, 4000), leafPaths } as RepoTree;
}
export async function readFile(path: string, baseSha?: string) {
  const safe = canonicalPath(path),
    tree = await repoTree();
  if (baseSha && baseSha !== tree.baseSha) throw new Error("Base changed");
  const item = tree.files.find((x) => x.path === safe);
  if (!item || (item.size ?? 0) > maxFile) throw new Error("File unavailable");
  const b = (await gh(`/git/blobs/${item.sha}`)) as { content?: string; encoding?: string };
  if (b.encoding !== "base64" || !b.content) throw new Error("File unavailable");
  const bytes = Buffer.from(b.content.replace(/\n/g, ""), "base64");
  if (bytes.length > maxFile || bytes.includes(0)) throw new Error("File unavailable");
  const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { path: safe, content, baseSha: tree.baseSha, blobSha: item.sha };
}
export type ProposalFile = { path: string; before: string; after: string };
export type Proposal = {
  userId: string;
  baseSha: string;
  title: string;
  body: string;
  files: ProposalFile[];
  expires: number;
  id: string;
  hash: string;
};
function stable(p: Omit<Proposal, "id" | "hash">) {
  return JSON.stringify({
    userId: p.userId,
    baseSha: p.baseSha,
    title: p.title,
    body: p.body,
    files: p.files,
    expires: p.expires,
  });
}
export function signProposal(value: Omit<Proposal, "id" | "hash">) {
  const p = {
    ...value,
    id: randomUUID(),
    hash: createHash("sha256").update(stable(value)).digest("hex"),
  };
  validateProposal(p, value.userId, false);
  const payload = Buffer.from(`mira-github-proposal-v1\n${JSON.stringify(p)}`).toString(
      "base64url",
    ),
    s = createSign("RSA-SHA256");
  s.update(`mira-github-proposal-v1\n${payload}`);
  return `${payload}.${s.sign(createPrivateKey(githubConfig().pem)).toString("base64url")}`;
}
function validateProposal(p: Proposal, userId: string, expiry = true) {
  if (
    p.userId !== userId ||
    !UUID.test(p.id) ||
    !sha(p.baseSha) ||
    !Number.isFinite(p.expires) ||
    (expiry && (p.expires < Date.now() || p.expires > Date.now() + 20 * 60_000)) ||
    typeof p.title !== "string" ||
    !p.title.trim() ||
    p.title.length > 180 ||
    typeof p.body !== "string" ||
    p.body.length > 4000 ||
    !Array.isArray(p.files) ||
    p.files.length < 1 ||
    p.files.length > 8
  )
    throw new Error("Invalid proposal");
  let total = 0;
  const paths = new Set<string>();
  for (const f of p.files) {
    const path = assertWritablePath(f.path);
    if (
      path !== f.path ||
      paths.has(path.toLowerCase()) ||
      typeof f.before !== "string" ||
      typeof f.after !== "string" ||
      Buffer.byteLength(f.after) > maxFile ||
      Buffer.byteLength(f.before) > maxFile
    )
      throw new Error("Invalid proposal");
    paths.add(path.toLowerCase());
    total += Buffer.byteLength(f.before) + Buffer.byteLength(f.after);
  }
  if (total > maxProposal || p.hash !== createHash("sha256").update(stable(p)).digest("hex"))
    throw new Error("Invalid proposal");
}
function verifyProposal(token: string, userId: string): Proposal {
  if (typeof token !== "string" || token.length > 400_000) throw new Error("Invalid proposal");
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra) throw new Error("Invalid proposal");
  const v = createVerify("RSA-SHA256");
  v.update(`mira-github-proposal-v1\n${payload}`);
  if (!v.verify(createPrivateKey(githubConfig().pem), Buffer.from(sig, "base64url")))
    throw new Error("Invalid proposal");
  const raw = Buffer.from(payload, "base64url").toString("utf8"),
    prefix = "mira-github-proposal-v1\n";
  if (!raw.startsWith(prefix)) throw new Error("Invalid proposal");
  const p = JSON.parse(raw.slice(prefix.length)) as Proposal;
  validateProposal(p, userId);
  return p;
}
export async function createPullRequest(token: string, userId: string) {
  const p = verifyProposal(token, userId),
    tree = await repoTree();
  if (tree.baseSha !== p.baseSha) throw new Error("Base changed");
  const branch = `mira/${p.id}`;
  const leafPaths = new Set(tree.leafPaths.map((path) => path.toLowerCase()));
  for (const file of p.files) {
    const segments = file.path.toLowerCase().split("/");
    for (let i = 1; i < segments.length; i++) {
      if (leafPaths.has(segments.slice(0, i).join("/")))
        throw new Error("Proposal path conflicts with an existing file");
    }
  }
  // All reads are exact 404 only; any auth/network/server error aborts.
  let existingRef: { object: { sha: string } } | null = null;
  try {
    existingRef = (await gh(`/git/ref/heads/${branch}`)) as { object: { sha: string } };
  } catch (e) {
    if ((e as { status?: number }).status !== 404) throw e;
  }
  const parent = (await gh(`/git/commits/${p.baseSha}`)) as { tree: { sha: string } };
  for (const f of p.files) {
    const old = await readFile(f.path, p.baseSha);
    if (old.content !== f.before) throw new Error("Preview no longer matches base");
  }
  const treeResult = (await gh("/git/trees", "write", "POST", {
    base_tree: parent.tree.sha,
    tree: p.files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.after })),
  })) as { sha: string };
  const commit = (await gh("/git/commits", "write", "POST", {
    message: `${p.title}\n\nMira proposal ${p.id} ${p.hash}`,
    tree: treeResult.sha,
    parents: [p.baseSha],
  })) as { sha: string };
  if (existingRef) {
    const c = (await gh(`/git/commits/${existingRef.object.sha}`)) as {
      tree: { sha: string };
      parents: Array<{ sha: string }>;
      message: string;
    };
    if (
      c.tree.sha !== treeResult.sha ||
      c.parents?.[0]?.sha !== p.baseSha ||
      !c.message.includes(p.id) ||
      !c.message.includes(p.hash)
    )
      throw new Error("Proposal branch conflict");
  } else {
    try {
      await gh("/git/refs", "write", "POST", { ref: `refs/heads/${branch}`, sha: commit.sha });
    } catch (e) {
      if ((e as { status?: number }).status !== 422) throw e;
      const ref = (await gh(`/git/ref/heads/${branch}`)) as { object: { sha: string } };
      const c = (await gh(`/git/commits/${ref.object.sha}`)) as {
        tree: { sha: string };
        parents: Array<{ sha: string }>;
        message: string;
      };
      if (
        c.tree.sha !== treeResult.sha ||
        c.parents?.[0]?.sha !== p.baseSha ||
        !c.message.includes(p.id) ||
        !c.message.includes(p.hash)
      )
        throw new Error("Proposal branch conflict");
    }
  }
  const prs = (await gh(
    `/pulls?state=all&head=${encodeURIComponent("Hendrik5000:" + branch)}&base=main`,
  )) as Array<{ html_url?: string }>;
  if (!Array.isArray(prs)) throw new Error("Unavailable");
  const found = prs.find((x) => safePrUrl(x.html_url));
  if (found && safePrUrl(found.html_url)) return { url: found.html_url, replay: true };
  const pr = (await gh("/pulls", "write", "POST", {
    title: p.title,
    body: p.body,
    head: branch,
    base: "main",
  })) as { html_url?: string };
  if (!safePrUrl(pr.html_url)) throw new Error("Unavailable");
  return { url: pr.html_url, replay: false };
}
