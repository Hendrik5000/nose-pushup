# NOSE PUSH

A German-language React web app built with TanStack Start, Tailwind CSS, Radix UI / shadcn-ui components, and Supabase for auth and data. Originally created in Lovable.

## Stack

- **Frontend**: React 19, TanStack Router + Start (SSR), Tailwind CSS v4, Radix UI / shadcn-ui
- **Backend / DB**: Supabase (auth, realtime, database)
- **Build tool**: Vite 8 via `@lovable.dev/vite-tanstack-config`
- **Language**: TypeScript

## Running the app

```bash
npm run dev   # starts Vite dev server on port 5000
```

The "Start application" workflow runs `npm run dev` and exposes the app on port 5000.

## Key files

- `src/routes/` — file-based TanStack Router routes
- `src/integrations/supabase/client.ts` — Supabase client (uses `ws` package for Node 20 SSR WebSocket support)
- `vite.config.ts` — Vite/TanStack Start config (port 5000, host 0.0.0.0 for Replit preview)
- `supabase/` — Supabase project config

## Environment variables

Set in `.env` (already present):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Same values, used server-side (SSR) |

## Notes

- Node.js 20 lacks native WebSocket; the Supabase client passes the `ws` npm package as the realtime transport for SSR.
- The app was imported from Lovable — avoid force-pushing or rewriting published git history on the connected branch.
