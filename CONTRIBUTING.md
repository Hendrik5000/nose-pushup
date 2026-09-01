# Zusammenarbeit: Lovable + GitHub Copilot + Replit + Manus + Vercel

Dieses Repo wird von mehreren Agenten/Umgebungen bearbeitet. Damit sich nichts
gegenseitig zerstört, gelten die folgenden Regeln.

## Goldene Regel

Lovable ist mit diesem Repo zwei-Wege-synchronisiert.
**Niemals gepushte History umschreiben** – kein `git push --force`, kein Rebase,
Amend oder Squash von bereits gepushten Commits. Sonst geht die Lovable-History verloren.

## Wer macht was

| Umgebung | Aufgabe | Hinweise |
| --- | --- | --- |
| **Lovable** | Feature-Entwicklung, DB-Migrationen, Cloud/Supabase-Konfiguration | Einziger Ort für `supabase/migrations/*` |
| **GitHub Copilot** | Reviews, kleine Fixes, Tests, Refactorings per PR | Regeln in `.github/copilot-instructions.md` |
| **Replit** | Lokales Ausprobieren / Debugging | Start: `npm run dev` (Port 5000, siehe `.replit`) |
| **Manus** | Recherche, Doku, Batch-Änderungen | Immer Branch + PR, nie direkt auf den Lovable-Branch |
| **Vercel** | Optionales Zusatz-Deployment (Preview) | Produktion läuft weiter über Lovable Publish |

## Branch- und PR-Ablauf

1. Externe Agenten arbeiten auf `feat/…`, `fix/…` oder `chore/…`.
2. PR gegen den mit Lovable verbundenen Branch (`main`).
3. CI (`.github/workflows/ci.yml`) muss grün sein: Lint, Typecheck, Build.
4. Merge-Commit oder normaler Merge – **kein** Squash-Rebase auf gepushte Commits.
5. Nach dem Merge zieht Lovable die Änderungen automatisch.

## Was externe Agenten nicht anfassen dürfen

- `src/routeTree.gen.ts` (generiert)
- `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`,
  `auth-attacher.ts`, `types.ts`
- `.env`, `supabase/config.toml`
- Bereits gemergte Dateien in `supabase/migrations/` (append-only)
- `src/components/ui/*` außer bei bewusstem Design-Update

## Environment-Variablen

Für Builds außerhalb von Lovable (CI, Vercel, Replit) werden gebraucht:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Server-Secrets (Push-Keys, AI-Gateway-Key) werden von Lovable Cloud injiziert und
gehören **nicht** ins Repo.

## Vercel

Produktion bleibt Lovable (`https://nose-pushup.lovable.app`) – nur dort greifen
Cloud-Secrets, Web-Push und die Digital-Asset-Links für die Android-App.
Vercel eignet sich für PR-Previews des Frontends: `vercel.json` setzt Build-Command
und SPA-freundliche Header. Vor dem Deployment die drei `VITE_…`-Variablen im
Vercel-Projekt hinterlegen.

## Android / Play Store

Siehe [`ANDROID.md`](./ANDROID.md) – Build per `scripts/build-aab.ps1` (Windows).
