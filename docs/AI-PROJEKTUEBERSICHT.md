# Alo (Nose-Pushup) – Projektübersicht

> Interne Entwicklerdokumentation, kein App-Inhalt. Nicht in Frontend-Code, Build-Importe, Nutzeransichten oder Mira-Anfragen übernehmen. Verfasst von Perplexity Computer (Claude Sonnet 5.5 / Anthropic), siehe Eintrag in [`AI-TEAM.md`](AI-TEAM.md).

Repository: https://github.com/Hendrik5000/nose-pushup (öffentlich, Branch `main`)
Stand der Analyse: 30.10.2026, Commit-Stand `8adcd5d` ("Remove green neon accents from Alo PWA icons", 27.10.2026)
Methode: Repo geklont, Doku und Code gelesen, `npm ci`, `npm test`, `tsc --noEmit` und `eslint` lokal ausgeführt. Keine Datenbank-, KI- oder Live-Zugriffe. Die Befunde sind Momentaufnahmen aus statischer Codeprüfung; vor einer Behebung gegen den aktuellen Commit neu prüfen. Roadmap-Status (`AI-ROADMAP.md`) bleibt maßgeblich, diese Datei hakt nichts ab.

---

## 1. Was Alo ist

Alo ("All in one") ist eine deutschsprachige, mobile-first Web-App/PWA mit drei gleichwertigen Bereichen:

| Bereich | Route | Inhalt |
|---|---|---|
| Nose-Pushup / Training | `/` | Übungen zählen (Nase tippt Handy, Bewegungssensor, Timer, Kamera), XP/Level, Battles, Seasons, Clubs, Health |
| Mira | `/ai`, `/coach` | Allgemeine KI (kein reiner Sportcoach), BYOK-Anbieter, Anhänge, Gedächtnis, Runware (gesperrt) |
| Nexus Chat | `/chat` | Räume, DMs, Reaktionen, Suche; hybrid Supabase oder lokal |

Dazu kommen Einstellungen (`/profile`), ein globaler Arbeitsbereich ("Alo"-Zentrale mit Suche per Strg/Cmd+K) und ein App-Hub als Startseite.

Ursprung: in Lovable erstellt, später in Replit/Vercel weiterentwickelt. Mehrere KI-Assistenten arbeiten parallel; deshalb gibt es ein Register (`docs/AI-TEAM.md`) und eine Roadmap (`docs/AI-ROADMAP.md`).

---

## 2. Tech-Stack

- Frontend: React 19, TanStack Start + Router (SSR, Dateirouten), Tailwind CSS v4, Radix UI / shadcn (46 UI-Komponenten), Recharts, Sonner
- Build: Vite 8, Nitro 3 (beta), `@lovable.dev/vite-tanstack-config`
- Backend: Supabase (Auth, Postgres mit RLS, Realtime, Storage), TanStack-Server-Funktionen (`createServerFn`)
- KI: Lovable AI Gateway, OpenAI, Anthropic, Google Gemini, Custom (OpenAI-kompatibel), Runware (Bild/Video, gesperrt)
- Kamera/Pose: `@mediapipe/tasks-vision` (PoseLandmarker lite, per CDN geladen)
- Push: `web-push` + Service Worker `public/sw.js`
- Android: TWA-Manifest-Vorlage (`android/`, `ANDROID.md`, `scripts/build-aab.ps1`) plus Health-Connect-Brücke
- Hosting: Vercel (`vercel.json`, `npm ci`), öffentliche Veröffentlichung manuell über Lovable "Publish"
- CI: GitHub Actions (`ci.yml`): `npm ci`, Lint, Tests, `tsc`, Build mit Node 22
- Drizzle (`drizzle/`, `drizzle.config.ts`) ist vorhanden; die eigentliche Datenbank wird über `supabase/migrations/` verwaltet.

Codegröße: rund 41.800 Zeilen TypeScript in `src/` (ohne CSS). Größte Dateien: `workout.$exerciseId.tsx` (2.721 Zeilen), `SuperAiPage.tsx` (2.025), `LocalChatShell.tsx` (1.345), `_authenticated/index.tsx` (1.210), `profile-page-impl.tsx` (1.078).

---

## 3. Verzeichnisstruktur

```
src/
  routes/                 Dateirouten (TanStack)
    __root.tsx            Root: Theme, Fehlerreporting, Offline-Banner
    auth.tsx              Login/Registrierung
    u.$slug.tsx           Öffentliches Profil
    mcp.ts, [.mcp], [.well-known]   MCP-Server (OAuth über Supabase)
    _authenticated/       Geschützter Bereich (Login-Pflicht, ssr:false)
      route.tsx           Layout: Navigation, Swipe, AloWorkspace, WelcomeTour
  components/             ~53 App-Komponenten + ui/ (shadcn) + alo/ + mira/ + chat/ + dashboard/
  hooks/                  Übungs-Engine, Kamera, Benachrichtigungen, Readiness, Auto-Hide-Header
  lib/                    74 Module: Logik, Server-Funktionen, Stores
    mcp/tools/            4 MCP-Werkzeuge
  integrations/supabase/  Client, Server-Client, Auth-Middleware, Typen
supabase/migrations/      52 SQL-Migrationen (Juni bis Okt 2026)
tests/                    60 Dateien (Node-Testrunner via tsx) plus SQL/Shell-DB-Tests
docs/                     7 Handbücher (siehe Abschnitt 11)
public/                   Manifest, Service Worker, Alo-Icons/Branding
```

---

## 4. Routen und Funktionen

Alle Routen unter `_authenticated` prüfen per `supabase.auth.getUser()`, sonst Redirect nach `/auth`.

| Route | Zweck |
|---|---|
| `/` | Trainingsdashboard / App-Hub (konfigurierbare Widgets) |
| `/workout/$exerciseId` | Trainingssession (Push-Up, Sit-Up, Squat, Plank, Burpee), Zähl-Engine, Offline-Queue |
| `/exercises`, `/programs` | Übungskatalog und Trainingsprogramme |
| `/calisthenics`, `/cali-workout/$skillId` | Skill-Baum (z. B. Planche Lean), Cali-Coach |
| `/run` | Laufen/Tracking (mit Offline-Queue) |
| `/battle`, `/battle/$id`, `/battle-league` | 1-gegen-1-Battles (Modi: timed, first_to, sprint, endurance), Liga, Freundes-Einladungen |
| `/season`, `/leaderboard`, `/clubs` | Seasons, Bestenliste, Clubs mit Beitrittscode |
| `/health` | Health-Übersicht, Smartwatch/Health Connect |
| `/coach`, `/ai` | KI-Coach und Mira (Super-AI) |
| `/chat` | Nexus Chat |
| `/profile` | Einstellungen: Design, Navigation, Themes, Freunde, Gym-Partner, KI-Anbieter, Fehlerberichte, Datenschutz |
| `/u/$slug` | Öffentliches Profil |
| `/mcp` | MCP-Endpunkt (OAuth) |

### Zählung von Wiederholungen (`src/lib/exercises.ts`, `useExerciseEngine.ts`)
Vier Erkennungsarten: `touch` (Nasentipp), `motion_vertical` (Beschleunigungssensor, Schwelle z. B. 3,2 m/s² bei Squat), `timer` (Planks/Halteübungen, 1 Zählung pro Sekunde) und `combo` (Burpee). Jede Übung hat eine Mindest-Entprellzeit (Push-Up 280 ms, Sit-Up 350, Squat 500, Burpee 800, Plank 1000). Zusätzlich gibt es kamerabasierte Erkennung mit MediaPipe.

### Gamification
- XP: 10 pro Wiederholung, 1 pro Plank-Sekunde; Level = `floor(sqrt(xp/100)) + 1`, Maximum 50 (`level.ts`, gespiegelt in der DB-Funktion `calc_level`)
- Datenbank-Trigger: `on_workout_inserted`, `check_achievements`, Season-Punkte, Challenge-Fortschritt, Battle-Rating
- Weitere Funktionen: Streak-Freeze, Mikro-Challenges, Shop (`purchase_shop_item`), Abzeichen

---

## 5. Datenbank (Supabase)

52 Migrationen, 49-mal wird Row Level Security aktiviert. Rund 56 Tabellen:

- Training und Profil: `profiles`, `workouts`, `exercises`, `daily_stats`, `runs`, `health_entries`, `wearable_devices`, `coach_advice`, `training_plans`, `plan_days`, `programs`, `program_days`, `user_programs`, `user_program_days`
- Gamification: `achievements`, `user_achievements`, `challenges`, `user_challenges`, `seasons`, `season_scores`, `shop_items`, `user_items`
- Sozial: `friendships`, `clubs`, `club_members`, `club_posts`, `battles`, `battle_reps`, `battle_queue`, `friend_battle_invitations`
- Gym zu zweit: `gym_sessions`, `gym_sets`, `gym_visits`, `gym_memberships`, `gym_active_memberships`
- Nexus: `rooms`, `conversations`, `conversation_members`, `messages`, `message_reactions`, `message_reads`, `room_mutes`
- Alo-Arbeitsbereich: `alo_records`, `alo_room_tools`, `alo_room_votes`
- Sonstiges: `notifications`, `push_subscriptions`, `error_reports`; Storage-Bucket `chat-uploads`

Wichtige serverseitige Funktionen (RPC): `alo_sync_record` (Compare-and-swap mit Revisionen), `alo_erase_workspace`, `gym_*` (Sitzung erstellen/beitreten/Satz hinzufügen/Sichtbarkeit/Historie/Kontolöschung), `create/respond_to/cancel_friend_battle_invitation`, `search_messages`, `get_or_create_dm`, `create_group`, `join_club_by_code`, `update_personal_best`, `public_profile`.

Zwei Supabase-Projekte sind im Spiel:
1. Das in `supabase/config.toml` und `.env` konfigurierte, von Lovable verwaltete Projekt. Dort läuft die produktive App.
2. Das neue leere Projekt "Alo" (Region eu-central-1) für einen geplanten Neuanfang ("Fresh Cutover"). Es ist laut Doku noch nicht angewendet und nicht umgeschaltet.

---

## 6. Mira (KI)

Dateien: `components/mira/SuperAiPage.tsx`, `lib/super-ai.functions.ts`, `ai-providers.ts`, `ai-provider-fetch.ts`, `mira-attachments.ts`, `mira-memory.ts`, `mira-handoff.ts`, `super-ai-tools.ts`, `runware*.ts`

- Anbieter: OpenAI, Anthropic, Google, Lovable Gateway, Custom. Nutzer tragen eigene Schlüssel ein (BYOK, im `localStorage`, pro Konto-ID). Die Schlüssel gehen pro Anfrage an die Server-Funktion `superAiChat`.
- Serverseitige Schutzmaßnahmen in `superAiChat`: Login erforderlich, Modell-Allowlist je Anbieter, max. 12.000 Zeichen Eingabe, höchstens 16 Nachrichten, 20 Anfragen pro Minute pro Nutzer (prozesslokal), Custom-URL nur HTTPS, Port 443, keine privaten IPs, DNS-Prüfung, optionale Host-Allowlist (`CUSTOM_AI_HOST_ALLOWLIST`), Weiterleitungen werden nicht verfolgt (`fetchAiProvider`).
- Anhänge: bis zu vier Dateien, 3 MB gesamt; JPEG/PNG/WebP/GIF, TXT/MD/CSV/TSV/JSON; PDF nur bei Google. Bleiben lokal bis zum bewussten Senden.
- Datenschutzprinzip: App-Kontext (Training, Gesundheit, Nexus-Räume) geht nur nach ausdrücklicher, widerrufbarer Freigabe an die KI. Keine stillen Zweitmodell-Aufrufe.
- Gedächtnis: optional (Opt-in), lokal, wird beim Abmelden gelöscht (`sensitive-storage.ts`).
- Personas, Tools, Favoritenprompts, Sitzungsverlauf, Markdown-Export in `super-ai-tools.ts`.
- Coach-Funktionen (`coach.functions.ts`, `coach-chat`, `coach-plan`, `cali-coach`) nutzen serverseitig `LOVABLE_API_KEY` am Lovable Gateway.
- Runware (Bild/Video): vollständig implementiert (Preflight, Idempotenz, Rate-Limit 3/Minute, Bildvalidierung), aber bewusst gesperrt, bis ein verbindlicher Kostenvertrag existiert. Ein Schlüssel liegt laut Doku in einem sicheren Secret-Speicher.

---

## 7. Nexus Chat und Alo-Arbeitsbereich

- `chat-backend.ts` entscheidet zur Laufzeit: ist die Tabelle `rooms` abfragbar, wird Supabase genutzt, sonst `local-chat.ts` (localStorage pro Nutzer). Die UI soll klar zeigen, was nur lokal gespeichert und was zugestellt wurde.
- `LocalChatShell.tsx` (1.345 Zeilen): Räume, DMs, Reaktionen, Bearbeiten/Löschen, Suche, Uploads.
- Alo-Arbeitsbereich (`components/alo/`, `alo-store.ts`, `alo-sync.ts`): Suche über alles, Schnellablage (inkl. Sprachnotiz bis 60 s), Sammlungen, Tagesübersicht, Raumwerkzeuge (Infos, Umfragen, Termine), Schnellaktionen, Daten und Datenschutz. Lokal-first mit kontogebundenem Speicher; optionale Cloud-Synchronisierung über `alo_records` mit Revisionen, Tombstones und Konflikterkennung. Ausführliche Beschreibung: `docs/alo-workspace.md`.

---

## 8. Gym zu zweit

`GymPartnerPanel.tsx`, `GymVisitCalendar.tsx`, `lib/gym-partner.ts`, `gym-calendar.ts`, Migration `20261020200000_gym_partner.sql`. Zwei echte Konten trainieren gemeinsam, behalten aber getrennte Verläufe. Partner-Stats und Besuchskalender werden freiwillig und je Kategorie einzeln freigegeben (standardmäßig aus). Einladungen laufen nach 15 Minuten ab. Die Migration ist lokal getestet (SQL-/Shell-Tests in `tests/`), laut Doku aber nicht remote angewendet. Anleitung: `docs/gym-partner-setup.md`.

---

## 9. Oberfläche und Navigation

- Sechs Designstile: soft, compact, editorial, studio, performance, legacy-performance
- 13 Farbwelten: solar, ember, aqua, neon, violet, mono, daylight, sand, forest, midnight, rose, contrast, glacier
- Vier Navigationslayouts: top, top-tabs, bottom, floating (feste Homebar nur bei bottom/floating, seit 25.10. keine globale obere Leiste mehr)
- Swipe-Navigation zwischen Training, Mira, Nexus und Einstellungen (`module-swipe-*.ts`), blockiert in Eingabefeldern, Dialogen, Sliders und laufendem Workout
- Persönliche Widgets (`dashboard-layout.ts`, `DashboardGrid.tsx`)
- PWA mit Service Worker (Push-Benachrichtigungen), Offline-Banner, Offline-Queue für Workouts/Läufe, eigene Fehlerseiten

---

## 10. Qualität: lokal gemessen

| Prüfung | Ergebnis |
|---|---|
| `npm ci` | erfolgreich |
| `npm test` | 324 Tests, 324 bestanden, 0 fehlgeschlagen (ca. 16 s) |
| `npx tsc --noEmit` | keine Fehler |
| `eslint .` | 0 Fehler, 15 Warnungen (z. B. fehlende Hook-Abhängigkeiten) |
| `npm run build` | nicht ausgeführt |
| Echte Geräte, Screenreader, Remote-DB, Live-Betrieb | nicht geprüft |

Testschwerpunkte: Gym-Partner und Kontolöschung (auch gegen eine lokale Postgres-Instanz), Battle-Einladungen, Mira-Anhänge und -Handoff, Navigation und Swipe, Chat-Barrierefreiheit, Dashboard-Layout, Coach-Sicherheit, Brandkonsistenz, Offline-Queue.

---

## 11. Dokumentation im Repo

| Datei | Inhalt |
|---|---|
| `README.md` | Einstieg für Entwickler/KI |
| `AGENTS.md` | Projektregeln, Fehlerbericht-Ablauf, Abhängigkeitsregeln |
| `docs/AI-HANDOFF.md` | Produktziel, Nutzerentscheidungen, geschützte Dateien, Sicherheitsgrenzen |
| `docs/AI-TEAM.md` | Pflichtregister aller KI-Mitwirkenden |
| `docs/AI-ROADMAP.md` | Roadmap, Phasen 0 bis 7, 35 Punkte erledigt, 30 offen |
| `docs/alo-workspace.md` | Arbeitsbereich im Detail |
| `docs/gym-partner-setup.md` | Einrichtung Gym zu zweit |
| `docs/mira-runware.md` | Runware-Anbindung |
| `docs/ux-40-traceability.md` | UX-Nachverfolgung |
| `ANDROID.md`, `CONTRIBUTING.md`, `replit.md` | Android-Build, Beitragsregeln, Replit-Hinweise |

Arbeitsregeln aus der Doku, die jede Änderung betreffen:
1. Vor jeder Dateiänderung eigene Zeile in `docs/AI-TEAM.md` eintragen.
2. Roadmap nur mit belegter Arbeit abhaken; Push ist nicht gleich live.
3. Keine echten KI-Anfragen, Uploads oder DB-Änderungen als Test.
4. Geschützte lokale Dateien nicht anfassen: `src/routeTree.gen.ts`, `docs/alo-fresh-*`, `docs/alo-validation/`, `scripts/test-alo-fresh-local.sh`, `supabase/fresh/`, `tests/db/`.
5. Veröffentlichung macht Hendrik manuell in Lovable.
6. Nur ein Code-Editor gleichzeitig.

---

## 12. Befunde aus dem Code

Bewertung gegen den aktuellen Stand `main`. Die Einordnung "bestätigt" bedeutet: ich habe die Stelle im Code gesehen.

### Sicherheit
1. `.env` ist im öffentlichen Repo eingecheckt (Commit `faa15b4`). Sie enthält nur Projekt-ID, URL und den Publishable (Anon) Key von Supabase. Diese Werte sind für Browser gedacht und kein Geheimnis, solange RLS überall korrekt ist. Trotzdem besser: `.env` aus Git entfernen, `.env.example` anlegen und `.env` in `.gitignore` aufnehmen. Ein Service-Role-Key oder KI-Schlüssel steht dort nicht (ich habe nur die Variablennamen geprüft).
2. Bei eingecheckter `.env` plus öffentlichem Repo hängt die Sicherheit vollständig an der RLS aller 56 Tabellen. Eine Gesamtprüfung der Policies gegen das echte Remote-Schema steht aus.
3. Custom-KI-Anbieter (SSRF): DNS wird vor dem Aufruf geprüft, der eigentliche `fetch` löst aber erneut auf (DNS-Rebinding bleibt theoretisch möglich). Die private-IP-Erkennung kennt kein `::ffff:`-IPv4-Mapping, `100.64.0.0/10` und keine vollständige IPv6-Abdeckung. Roadmap führt das als "teilweise".
4. Rate-Limit von Mira (20/min) und Runware (3/min) liegt nur im Arbeitsspeicher je Server-Instanz. Auf Serverless/mehreren Instanzen ist das keine harte Grenze. Das Lovable-Gateway hat keine nutzerbezogenen Kostenquoten.
5. BYOK-Schlüssel liegen im Browser-`localStorage` und gehen bei jeder Anfrage an den eigenen Server. Aufräumen beim Abmelden ist umgesetzt.
6. `chat-uploads`: Die SELECT-Policy ist seit `20261020210000` auf den Eigentümerordner begrenzt. Damit können Raummitglieder fremde Uploads nicht lesen; das ist bewusste Einschränkung, aber remote nicht verifiziert.
7. Nexus-Räume sind laut Doku für alle angemeldeten Nutzer sichtbar, keine privaten Mitgliederräume bei Raumwerkzeugen.
8. Battle-Codes verwenden `Math.random()` (`battle.functions.ts`, `makeCode`). Für sechsstellige Einladungscodes ist das schwach; `crypto.getRandomValues` wäre besser.

### Zuverlässigkeit
9. `SmartwatchPanel.tsx` ignoriert den Fehler von `health_entries.upsert` und meldet trotzdem Erfolg (in der Roadmap als bestätigt geführt).
10. Datum "heute" wird teils per `toISOString().slice(0,10)` gebildet (UTC). Nahe Mitternacht weicht das vom lokalen Tag ab (Europe/Berlin).
11. Offene Android-Chrome-Warnungen auf `/ai` (`Failed to fetch` bei Token-Refresh) sind nicht geklärt.
12. Mehrere Seiten sind sehr groß (Workout-Seite 2.721 Zeilen, SuperAiPage 2.025). Das erschwert Wartung und Tests.

### Betrieb und Wartung
13. Zwei Supabase-Projekte: produktiv (Lovable) und neues leeres "Alo". Der Cutover ist blockiert. Alte und neue Konfiguration nicht vermischen.
14. Offene Migrationen: `20261020200000_gym_partner.sql` und `20261019210000_alo_workspace.sql` sind laut Doku remote nicht angewendet. Die Funktionen laufen deshalb nur lokal bzw. mit sichtbarem Fehlerzustand.
15. Mehrere Pakete sind Beta oder sehr neu (`nitro 3.0.260603-beta`, Vite 8). Updates vorsichtig und mit `npm ci`-Test.
16. `package.json` heißt noch `tanstack_start_ts`; die Doku nennt die App teils "Nosy Push-Up", "NOSE PUSH" und "Alo". Namensabgleich offen.

---

## 13. Offene Arbeit laut Roadmap (Auswahl)

- Phase 1: Abnahme auf echtem Android-Gerät (320 und 390 px, Tastatur, Safe Areas); Screenreader-Durchlauf
- Phase 2: Gym-Migration remote anwenden (braucht atomaren Weg und Freigabe), Test mit zwei echten Konten, Kontolöschung isoliert testen
- Phase 3: SSRF-Härtung, Quoten und Tokenlimits, BYOK-Scope, Runware gesperrt lassen, Anbieter-Transparenz je KI-Aufruf
- Phase 4: Cloud-Sync und Nexus live abnehmen, Zustellstatus klar unterscheiden
- Phase 5: Watch-Sync-Fehler, UTC-Datum, Fresh-Cutover
- Phase 6: Release-Gates (sauberer CI-Lauf, Migrationsdokumentation, manueller Lovable-Publish)
- Phase 7: appweites Redesign (P0), Freunde-Verknüpfung (P1), Partnerverlauf/Datentrennung (P1), eigenständiges privates Spiel (P2, ohne Nähe zu geschützten Inhalten)

---

## 14. Empfohlene nächste Schritte

1. `.env` aus Git nehmen und `.env.example` einführen (klein, risikoarm).
2. Watch-Sync-Fehlerbehandlung und lokales Datum beheben (klar belegte Bugs, schnell testbar).
3. SSRF-Härtung der Custom-Provider-URL ergänzen und Test dazu schreiben.
4. Battle-Codes mit `crypto` erzeugen.
5. RLS-Policies der Tabellen systematisch gegen das echte Projekt prüfen (nur lesend).
6. Entscheiden, wann Gym- und Alo-Workspace-Migrationen sicher angewendet werden.
7. Echten Gerätetest auf Android durchführen und dokumentieren.

Hinweis: Diese Datei ist eine reine Dokumentation. Sie ändert weder Code noch Roadmap-Status. Jede KI, die aus den Befunden Änderungen ableitet, trägt sich vorher in `AI-TEAM.md` ein und pflegt `AI-ROADMAP.md`.
