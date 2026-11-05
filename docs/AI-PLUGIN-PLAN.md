# Alo – Umsetzungsplan: Mira-Mini-Apps & Plugin-System

> **Status:** Ausarbeitung von Phase 8 aus `docs/AI-ROADMAP.md` (Backlog A: Mira-Mini-Apps, Backlog B: Plugins). Reine Planungsdokumentation; kein Code, keine Migration, kein Publish. Erstellt am 2026-11-05 von Vibe (GLM / Mistral, Vibe Work) im Auftrag von Hendrik. Diese Datei ist interne Repository-Dokumentation – nicht Teil der Alo-App und kein App-Inhalt.

## 1. Architekturüberblick

- **Ein Host, zwei Formate:** Mini-Apps und Plugins nutzen dieselbe Isolationsschicht (Sandbox-Iframe + postMessage-Bridge). Unterschied ist der Ablageort: Mini-Apps laufen als eigene Seite/Bibliothekseintrag, Plugins binden in einen Slot einer bestehenden Route ein. Ein Sicherheitsmodell statt zweier.
- **Deklarativ zuerst:** Das JSON-Schema (Weg B) wird nativ als React-Komponenten gerendert – kein Drittanbieter-Code. HTML/CSS/JS (Weg A) ist Ausnahme hinter dem Iframe. Die meisten erwarteten Use-Cases (Zähler, Timer, Tracker, Rechner) sind deklarativ abdeckbar.
- **Mira programmiert, Alo validiert:** Mira erzeugt Manifest + UI als Daten, nie als direkt ausgeführter Code. Serverseitige Zod-Validierung prüft jede Erzeugung, bevor sie gespeichert oder gerendert wird.

## 2. Datenmodell & Migrationen

Eine append-only Migration (`20261106090000_plugin_system.sql` o. ä.) – nur mit erfüllten Gates anlegen, nicht vorzeitig anwenden.

### `plugins`
- `id uuid pk`, `author_id uuid → auth.users on delete cascade`
- `name text`, `description text`, `icon jsonb` (Lucide-Name oder Data-URI, max. ~16 KB), `tags text[]`
- `version text` (SemVer), `target_app text check in ('health','workout','nexus','mira')`
- `slot text`, `manifest jsonb not null`, `ui jsonb not null` (deklaratives Schema oder HTML-String Weg A)
- `status text check in ('draft','public','revoked') default 'draft'`, `installs int default 0`, `likes int default 0`

Analog `custom_apps` (Name, Beschreibung, Autor-ID, Code bzw. deklaratives Schema, Kategorie, Download-/Like-Zähler, Status draft/public).

### `user_installed_plugins`
- `id uuid pk`, `user_id uuid → auth.users`, `plugin_id uuid → plugins`
- `granted_permissions jsonb` – **Momentaufnahme** der bestätigten Rechte zum Installationszeitpunkt
- `enabled boolean default true`, `installed_at timestamptz`
- Unique-Index `(user_id, plugin_id)`

Analog `user_installed_apps`.

### RLS-Politiken (Entwurf)

```sql
alter table plugins enable row level security;
alter table user_installed_plugins enable row level security;

create policy plugins_read on plugins for select to authenticated
using (status = 'public' or author_id = auth.uid());

create policy plugins_write on plugins for all to authenticated
using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy installed_self on user_installed_plugins for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Zähler-Updates (installs/likes) über `security definer`-RPC mit `set search_path = public`.

## 3. Plugin-Host: Isolation & Bridge

### Iframe-Kontrakt
- `sandbox="allow-scripts"` **ohne** `allow-same-origin` → opaque origin; kein Zugriff auf Supabase-Sessions, localStorage der Haupt-App oder Cookies. Wichtigste einzelne Schutzmaßnahme.
- Weg A: HTML per `srcdoc`, vorher serverseitig gespült (Tag-Allowlist, kein `<script src>`, keine `javascript:`-URLs, kein `fetch` ohne explizite `net:*`-Berechtigung – in Phase 1–3 nicht vorsehen → verbieten).

### postMessage-RPC-Protokoll
Plugin → Host: `{ id, type: 'req', method: 'capability.call', capability: 'write:water_intake', args }`
Host → Plugin: `{ id, type: 'res', ok, data | error: 'E_PERM' }`
Events: `{ type: 'evt', event: 'workout:complete', payload }`

Host-seitige Regeln:
1. `event.source` muss exakt dem erwarteten iframe-contentWindow entsprechen; `event.origin` prüfen, niemals `*` bei Antworten.
2. Jede Methode wird gegen die **Installations-Momentaufnahme** (`granted_permissions`) geprüft, nicht gegen das aktuelle Manifest; neue Rechte nach Plugin-Update erfordern erneute Bestätigung.
3. Capability-Handler als serverseitiger RPC-Layer (Edge Function oder TanStack-Server-Route): nie direkte Tabellenzugriffe, nur geprüfte Funktionen (`read:today_steps`, `write:water_intake`, …); Read-Capabilities geben nur Tages-Aggregate zurück.
4. Rate-Limit pro Plugin-Instanz (z. B. 30 Calls/min) und Payload-Limit (64 KB).
5. Protokollierung in `plugin_invocation_logs` (user_id, plugin_id, capability, ok).

### Slot-Integration
```tsx
// src/components/plugins/PluginSlot.tsx (geplant)
type PluginSlotProps = {
  targetApp: 'health' | 'workout' | 'nexus' | 'mira';
  slot: string; // 'dashboard_widget' | 'workout_panel' | …
  context: SlotContext; // nur nicht-sensible Kontextdaten
};
```
- Laden via React Query; Rendern im Bento-Grid des bestehenden Apple-Health-Looks (`health.tsx`).
- Erster Slot (Phase 1): `health` / `dashboard_widget`.
- Slots erscheinen nur mit mindestens einem installierten Plugin – keine leeren Platzhalter.

## 4. Manifest-Schema (Zod, geteilt Client/Server) – Entwurf

- `specVersion: '1.0'`, `targetApp` (4 Werte), `slot` (max. 40), `displayName` (1–60)
- `permissions`: Allowlist-Enum (`read:today_steps`, `read:workout_summary`, `write:water_intake`, `write:custom_counter`), max. 8, nur append-only erweitern
- `uiKind: 'declarative' | 'html'`, `events`, `sizeHint: 'small'|'medium'|'full'`
- Deklarative UI-Komponenten: `counter`, `stat`, `progress`, `buttonRow` (max. 6), `note`; max. 12 Komponenten; `persistence` mit `plugin_local` oder `user_capability`

Validierung serverseitig erzwingen: `manifestSchema.safeParse()` + `declarativeUiSchema.safeParse()`; ungültige Mira-Ausgaben werden nicht gespeichert; Zod-Fehler als Korrekturprompt zurück an Mira (max. 2 Versuche).

## 5. Mira als Plugin-Programmiererin

Ablauf: Nutzer promptet (`Mach mir einen Wasser-Tracker mit 4 Gläsern à 500 ml`) → Mira (serverseitiges SuperAI-Gateway, BYOK wie bestehender Chat) erzeugt Manifest + deklarative UI als JSON → Zod-Validierung → Draft-Plugin (`status='draft'`, author_id=Nutzer) → Live-Vorschau inline im Mira-Chat (neue Nachrichten-Art `plugin_draft` in `SuperAiPage.tsx`, gleicher PluginHost) → Speichern (Bibliothek) oder Veröffentlichen.

Systemprompt-Gerüst: Zod-Schema als Beschreibung, verfügbare Slots, Berechtigungs-Allowlist mit Klartext-Bedeutung, 2–3 Few-Shots (Wasser-Tracker, Fasten-Timer, Kettlebell-Timer), Ausgabe streng JSON. Keine automatischen Zweitmodell-Aufrufe – jede Verfeinerung ist ein sichtbarer Chat-Turn.

Verbote (Prompt UND technisch erzwingen): keine Secrets in Manifest/UI (Server-Scan auf `sk-`, `Bearer`, `key=`); keine externen APIs (keine `net:*`-Capability, kein `fetch` in UI-Allowlist); keine fremden Nutzerdaten (Capability-Layer nur `auth.uid()`-Daten); kein Mira-Gateway-Zugang aus dem Plugin-Host; Größenlimits Manifest+UI ≤ 128 KB, HTML ≤ 64 KB.

## 6. Marketplace & Verwaltung (Phase 3)

- Neue file routes `src/routes/_authenticated/plugins.tsx` (Marketplace + „Meine Plugins“) und `apps.tsx`; Installationsverwaltung zusätzlich in `profile.tsx`.
- Feed: React Query auf `status='public'`, sortierbar nach installs/created_at, Suche auf Name/Tags (`ilike`, später ggf. `pg_trgm`).
- Installations-Flow: Detailansicht zeigt Manifest-Klartext → Bestätigungsdialog mit exakt angeforderten Berechtigungen → RPC legt Installation an und friert `granted_permissions` ein.
- Updates: neue Plugin-Version mit neuen Rechten → Installation bleibt auf alter Version aktiv, bis Nutzer bestätigt (Versions-Pin).
- Widerruf: Autor setzt `status='revoked'` → aus Marketplace entfernt; Installationen erhalten sichtbares Banner und laufen nicht mehr.
- Phase 3 ohne Kommentare, nur Like-Zähler; Missbrauchsmeldung als Report-Button in `plugin_reports`.

## 7. Phasen- & Release-Plan

| Phase | Inhalt | Abnahmekriterium | Schätzung* |
|---|---|---|---|
| 1a | Plugin-Host + Bridge + Manifest/Zod + `PluginSlot` für health/dashboard_widget; Migration **anlegen** (nicht anwenden) | Isolations-Tests grün; Bridge verweigert ungefragte Capability | ~5–8 Tage |
| 1b | Capability-Layer (read/write Wasser & Steps) + Invocation-Logs | Capability-Integrationstest gegen lokale Supabase | ~3–4 Tage |
| 2 | Mira-Generierungs-Pipeline, Chat-Vorschau, Speichern/Veröffentlichen | E2E: Prompt → validiertes Draft-Plugin → Vorschau → Speichern | ~4–6 Tage |
| 3 | Marketplace, Installation mit Permission-Gate, Verwaltung, Updates | Zwei-Konten-Durchlauf: Veröffentlichen ↔ Installieren ↔ Widerruf | ~4–5 Tage |
| A (Mini-Apps) | nach Backlog-B-Rhythmus: Baukasten/Vorschau → Bibliothek/Icons → Marketplace-Feed | wie oben, getrennte Tabellen | +10–14 Tage |

\* Richtwerte für einen Assistenten mit voller Repo-Dev-Umgebung. Phasen 1a→2 strikt sequenziell: Ein Mira-Prompt ohne Host ist nicht testbar.

Gates (unverändert aus der Roadmap): AI-TEAM-Eintrag vor jeder Dateiänderung; Roadmap-Checkboxen nur mit Beleg; `npm ci` + lint + build + `tsx --test` grün vor jedem Push; Migration nur bei fertiger, getesteter Implementierung auf demselben exakten `main`-Commit; Lovable-403 → fail-closed ohne Migration; Live-Publish bleibt Hendriks manueller Schritt.

## 8. Teststrategie

1. Unit: Zod-Schemas, HTML-Sanitizer-Allowlist, Bridge-Protokoll (req/res/evt, Fehlercodes).
2. Integration (`tests/*.test.ts`): Capability-Layer gegen synthetische Supabase-Werte; RLS (Autor sieht Draft, Fremder nicht; Installation nur eigene Zeile).
3. Isolationstests (kritisch): Plugin-Iframe ohne Zugriff auf localStorage der Haupt-App; fetch-Versuch scheitert; Bridge ignoriert gespoofte origin/source; Rate-Limit greift.
4. E2E-Checkliste in `docs/`: zwei Konten, veröffentlichen/installieren/widerrufen; Mira-Prompt → Vorschau → Speichern; Permission-Gate zeigt exakt die angeforderten Rechte.

## 9. Offene Punkte für Hendrik

1. Plugin-Generierung über Mira als normaler BYOK-Chat-Auftrag (kein Sonderweg) – bestätigen.
2. Erster Umfang: nur Slot `dashboard_widget` oder direkt zwei Slots (Roadmap nennt auch Workout-Slots)?
3. Marketplace in Phase 3 nur **deklarative** Apps veröffentlichen (HTML nur privat/Bibliothek) – empfohlen zur Angriffsflächen-Reduktion.
4. Marketplace-Sichtbarkeit Phase 3 testweise nur für Admins (`global_admin_roles` existiert bereits)?
