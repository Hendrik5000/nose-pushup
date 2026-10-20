# Agent notes — Nosy Push-Up / Super App

## Automatic error reports (read first)

The app records client errors automatically:

- **localStorage** key `np-error-reports` (ring buffer, max 40)
- Optional Supabase table `error_reports` (migration `20261019013000_error_reports.sql`)
- Capture: `window.onerror`, `unhandledrejection`, React route error boundary, `console.error` (soft)

### Protocol on every coding session

1. Ask the user whether new errors appeared, or paste from **Profil → Fehlerberichte → Alle kopieren**.
2. If JSON reports are provided, **fix the root causes before new features**.
3. Prefer minimal, targeted patches; mark reports fixed after deploy.
4. Do not ignore repeated stack traces on the same route.

### How users export

Profil → Abschnitt „Fehlerberichte“ → **Alle kopieren (für Auto-Fix)** → paste into chat.

## Stack

- TanStack Start / React 19, file routes, Supabase auth + RLS
- Apple Health–inspired UI, TopNav segmented control
- Super-AI (BYOK), Nexus Chat hybrid, workout + micro-challenges

## AI handoff (read before coding)

Read `docs/AI-HANDOFF.md` at the start of each coding task. It contains product decisions, privacy boundaries, current status, and protected files. It is internal repository guidance: never display it in the app or send it to Mira as content.

In the first or final internal work report, identify your actual assistant name and model/provider. If either is not reliably available, say `unknown`; never guess. Never describe a GitHub push as a live deployment; Lovable publishing is manual and belongs to the user.

## Dependency changes and Vercel

- Keep `package-lock.json` synchronized with `package.json` in every dependency change. Vercel installs with `npm ci`, which rejects an inconsistent lockfile.
- Use npm to regenerate the lockfile; verify with `npm ci --no-audit --no-fund`, `npm run lint`, and `npm run build` before pushing. Never replace this check with `npm install` alone.

## Migrations

Append-only under `supabase/migrations/`. Never rewrite applied files.
