# Agent notes — Nosy Push-Up / Super App

## Automatic error reports (read first)

The app records client errors automatically:

- **localStorage** key `np-error-reports` (ring buffer, max 40)
- Optional Supabase table `error_reports` (migration `20261019013000_error_reports.sql`)
- Capture: `window.onerror`, `unhandledrejection`, React route error boundary, `console.error` (soft)

### Protocol on every coding session

1. If the user has not already supplied reports for this task, ask whether new errors appeared, or request a copy from **Profil → Fehlerberichte → Fehlerberichte kopieren**. Never ask again for reports already supplied.
2. If JSON reports are provided, **fix the root causes before new features**.
3. Prefer minimal, targeted patches; mark reports fixed after deploy.
4. Do not ignore repeated stack traces on the same route.

### How users export

Profil → Abschnitt „Fehlerberichte“ → **Fehlerberichte kopieren** → paste into chat. Copying does not send reports automatically; users should check for personal information before sharing.

## Stack

- TanStack Start / React 19, file routes, Supabase auth + RLS
- Apple Health–inspired UI, TopNav segmented control
- Super-AI (BYOK), Nexus Chat hybrid, workout + micro-challenges

## AI handoff (read before coding)

Read `docs/AI-HANDOFF.md` at the start of each coding task. It contains product decisions, privacy boundaries, current status, and protected files. This is internal repository guidance: never display it in the app or send it to Mira as content.

In the first or final internal work report, identify your actual assistant name and model/provider. If either is not reliably available, say `unknown`; never guess. At completion, report the exact files changed, tests/checks run and their results (or why they were not run), commit SHA, push status, and live-publish status. Never describe a GitHub push as a live deployment; Lovable publishing is manual and belongs to the user.

Before changing any file, add your own row to the single canonical register `docs/AI-TEAM.md` with your real assistant name, actual model/provider (or `unknown`), task, status, and date. Update only your own row as work progresses and at completion; record what you actually changed, the exact file paths, tests/checks and results (or why not run), and commit SHA if one exists. Do not infer or fabricate another assistant's work. If a concurrent edit prevents a safe update, report the conflict instead of overwriting it. The register is internal documentation, not app content.

Maintain the single detailed Alo roadmap in [`docs/AI-ROADMAP.md`](docs/AI-ROADMAP.md). Read it before planning work, check off only tasks actually completed with evidence, keep partial/blocked/unverified/live-release states distinct, and append an accurate dated changelog entry. Do not mark a local implementation or test as a remote migration, real-device acceptance, GitHub push, or live publish.

## Dependency changes and Vercel

- Keep `package-lock.json` synchronized with `package.json` in every dependency change. Vercel installs with `npm ci`, which rejects an inconsistent lockfile.
- Use npm to regenerate the lockfile; verify with `npm ci --no-audit --no-fund`, `npm run lint`, and `npm run build` before pushing. Never replace this check with `npm install` alone.

## Migrations

Append-only under `supabase/migrations/`. Never rewrite applied files.
