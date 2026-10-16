# Nächste Ausbaustufe: Training, Social, Feinschliff, Integrationen

Vier Workstreams, umgesetzt in dieser Reihenfolge (Feinschliff zuerst, weil er bestehende Nutzer sofort betrifft).

## Phase A — Bestehendes fertig machen
1. **Shop-Themes im ThemePicker**: Gekaufte Themes/Rahmen aus `user_items` im ThemePicker anzeigen und anwendbar machen; gekaufte Rahmen auf Profil-Avatar.
2. **Einladungsbonus**: `/auth?ref=slug` speichert den Referrer; nach erstem Workout des Eingeladenen bekommen beide Seiten Coins (z. B. 100) — serverseitig via RPC, einmalig pro Paar.
3. **Battle-Queue transaktional**: Matchmaking-Claim über `FOR UPDATE SKIP LOCKED`-RPC, damit keine Doppel-Matches entstehen.
4. **Recovery-Schätzung verbessern**: Schlaf aus `health_entries` lesen statt fest 7 h; Fallback bleibt Schätzwert.
5. **Nemesis-Abzeichen clientseitig**: Nach Battle-Ende `check_achievements` auslösen, damit das vorhandene Nemesis-Badge tatsächlich vergeben wird.

## Phase B — Mehr Training & Coach
1. **Intervall-Timer**: Konfigurierbarer HIIT/Tabata-Timer (Arbeit/Pause/Runden) als eigene Seite, mit Sound/Haptik aus `src/lib/feedback.ts`, zählt als Workout.
2. **Adaptive Trainingspläne**: Coach-Wochenplan reagiert auf Readiness-Score und RPE-Verlauf — bei 3 Tagen rotem Score automatisch Deload-Vorschlag.
3. **Video-Formanalyse (Kamera)**: Nach Kamera-Workout Rep-Qualitäts-Score (1–5) aus Winkel-Metriken der bestehenden Pose-Erkennung, gespeichert pro Workout, Trend im Verlauf.

## Phase C — Mehr Social & Wettkampf
1. **Team-Battles**: 2v2-Battles, Summen-Wertung, nutzt bestehende `battles`-Infrastruktur mit Team-Feldern.
2. **Turniere**: Einfaches K.-o.-Turnier für Clubs (8 Teilnehmer), Bracket-Ansicht, automatisches Weiterkommen.

## Phase D — Neue Integrationen
1. **Apple Health / Google Fit Import**: Täglicher Import von Schritten/Schlaf in `health_entries` (Web: manueller Sync-Button + Dateiimport, wo native APIs fehlen).
2. **Home-Screen-Widget (PWA)**: Tages-Reps und Streak als Badge/Shortcut im Manifest.

## Technische Hinweise
- Neue KI-Aufrufe: `openai/gpt-6-astra` via `/v1/responses` (store:false, reasoning low) — wie in AGENTS.md.
- Readiness-Score bleibt einzige Quelle in `src/lib/readiness.ts`; adaptive Pläne konsumieren ihn.
- Neue Tabellen (interval_sessions, tournaments, tournament_matches, referral_bonuses) mit RLS und Grants; Migration enthält Seeds wo nötig.
- Battle-Queue-Fix per SQL-RPC, kein Client-Lock.
