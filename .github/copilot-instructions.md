# GitHub Copilot – Projektanweisungen (Nosy Push-Up)

Diese Datei gilt für Copilot Chat / Coding Agent, Replit Agent, Manus und alle
anderen Agenten, die über GitHub an diesem Repo arbeiten.

## Wichtig: Lovable-Sync

Das Repo ist mit [Lovable](https://lovable.dev) verbunden. **Niemals** gepushte
Git-History umschreiben (kein force-push, rebase, amend, squash auf gepushten
Commits) – sonst geht die Projekt-History in Lovable verloren. Immer neue
Commits auf den verbundenen Branch pushen und diesen lauffähig halten.

## Stack (nicht austauschen)

- React 19 + **TanStack Start v1** (SSR) mit **TanStack Router** – kein
  react-router-dom, kein Next.js, kein `src/pages`, kein `App.tsx`-Router.
- Vite 8 über `@lovable.dev/vite-tanstack-config`.
- Tailwind CSS v4 (Konfiguration in `src/styles.css`, keine `tailwind.config.js`).
- Radix UI / shadcn-Komponenten in `src/components/ui` (nicht umschreiben).
- Supabase (Lovable Cloud) für Auth, DB, Realtime, Storage.

## Konventionen

- Routen: Datei-basiert in `src/routes/`. `src/routeTree.gen.ts` ist generiert –
  niemals manuell bearbeiten.
- Server-Logik: `createServerFn` aus `@tanstack/react-start` in `src/lib/*.functions.ts`.
  Reine Server-Helfer in `*.server.ts`. Öffentliche HTTP-Endpunkte unter
  `src/routes/api/public/*` (dort immer Signatur/Auth selbst prüfen).
- Geschützte Server-Funktionen nutzen `requireSupabaseAuth`; sie dürfen **nicht**
  im Loader einer öffentlichen Route aufgerufen werden (Prerender hat keine Session).
- Generierte Dateien nie editieren: `src/integrations/supabase/client.ts`,
  `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`, `.env`.
- Farben/Abstände nur über die Design-Tokens aus `src/styles.css` und die
  Themes in `src/lib/theme.ts` – keine hartkodierten Farbklassen (`bg-black`, `#hex`).
- Sprache der UI: **Deutsch**. Code, Kommentare und Commits: Englisch oder Deutsch, konsistent zur Datei.
- Runtime ist ein Edge/Worker-Kontext: keine `child_process`, `sharp`, `puppeteer`,
  kein Node-natives Modul in Server-Funktionen.

## Datenbank & Sicherheit

- Jede neue Tabelle in `public`: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → Policies.
- Gamification-Werte (XP, Level, Streak, Achievements, Challenge-Fortschritt,
  Battle-Ergebnisse) werden **ausschließlich serverseitig** per Trigger/Server-Funktion
  gesetzt. Clients dürfen diese Spalten nicht schreiben – das ist bewusst so und
  darf nicht "vereinfacht" werden.
- Migrationen liegen in `supabase/migrations/` und sind append-only.

## Vor dem Push

```bash
npm run lint
npm run build
```

Beides muss fehlerfrei durchlaufen. Die CI (`.github/workflows/ci.yml`) prüft
dasselbe bei jedem PR.
