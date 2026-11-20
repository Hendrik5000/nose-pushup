# AI-TEAM Zusatzregister — Mira Device Control (Phase 1)

Interne Dokumentation, kein App-Inhalt und kein Mira-Inhalt.

## Warum dieses Zusatzregister?

Das vorgeschriebene kanonische Register `docs/AI-TEAM.md` ist (Stand 2026-11-20) rund 329 KB groß
und konnte aus dieser Arbeitsumgebung (kein lokales `git`/`npm` verfügbar, Änderungen nur über
die GitHub-API mit vollständigen Dateiinhalten) nicht sicher angehängt werden, ohne das Risiko
einer Inhaltsverfälschung einzugehen. Dieser Pull Request enthält daher statt des kanonischen
Eintrags dieses Zusatzregister im Stil von `docs/AI-TEAM-PR203.md`. Beim Merge sollte die Zeile
in `docs/AI-TEAM.md` nachgetragen werden.

## Eintrag

- Assistent: Vibe
- Modell/Provider: GLM 5.3 Flash, auf Mistral-AI-Infrastruktur (Plattformangabe der Umgebung; nicht unabhängig verifizierbar)
- Aufgabe: Mira Device Control Phase 1 (Device Control UI) gemäß Notion-Seite „Mira Device Control – Gerätesteuerung für Windows, Android & iPad" (Page-ID `41e0556c-9d03-819b-91c7-f276c2991753`)
- Status: Als Pull Request implementiert; nicht gemerged, nicht live veröffentlicht, keine echte Geräteabnahme
- Datum: 2026-11-20

## Geänderte Dateien

- `src/lib/mira-device-control.ts` (neu): lokale Zustandslogik, Berechtigungsstufen, Not-Aus, Aktivitätsprotokoll, localStorage-Persistenz ohne Geheimnisse
- `src/components/mira/MiraDevicesPage.tsx` (neu): Geräteübersicht, Detailansicht, Berechtigungsmatrix, Not-Aus, Protokoll
- `src/routes/_authenticated/mira-devices.tsx` (neu): Route `/mira-devices`
- `src/routeTree.gen.ts` (angepasst): Route manuell nachgetragen (generierte Datei)
- `src/components/alo/AloPageSidebar.tsx` (angepasst): Menüeintrag „Geräte" im Mira-Bereich
- `tests/mira-device-control.test.ts` (neu): Unit-Tests für die reine Logik

## Prüfungen

- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`: **nicht ausgeführt**. In der
  verwendeten Umgebung sind `node`, `npm` und `git` nicht verfügbar; die Prüfungen müssen vor dem
  Merge lokal oder in CI nachgeholt werden. Die Tests sind bewusst so geschrieben, dass sie ohne
  Browser/DOM laufen (`node:test`, reine Logikfunktionen).

## Ehrliche Grenzen

- Kein visueller Test, kein Build, keine Geräteprüfung, kein Live-Publish.
- Keine Änderungen an Datenbank, Migrationen oder RLS (gemäß Verbindlicher Reihenfolge).
- Verbindungszustand „verbunden" ist in der Logik blockiert, solange kein echtes Gateway existiert
  (`DEVICE_CONTROL_GATEWAY_AVAILABLE = false`); gekoppelte Geräte bleiben „gekoppelt (offline)".
- Kanonischer Registereintrag in `docs/AI-TEAM.md` und Roadmap-Update in `docs/AI-ROADMAP.md`
  mussten wegen der Dateigröße und fehlender lokaler Werkzeuge ausgesetzt werden und sind offen.
