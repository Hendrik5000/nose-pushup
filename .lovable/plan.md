# Große neue Features – nächste Ausbaustufe

Stand: Coach-Chat, Battles, Freunde/Leaderboards, Achievements, Themes, Läufe, Health-Werte, Benachrichtigungen und PWA/Android sind live. Diese vier Features bauen darauf auf und bringen den größten Sprung im Alltagsnutzen.

---

## Feature 1 – Clubs & Saisons

Gruppen-Wettkampf als langfristiger Motivator.

- Club gründen oder per Einladungscode beitreten (max. 30 Mitglieder), Name, Emblem-Farbe, Motto.
- Gemeinsames Wochenziel: alle Reps der Mitglieder zählen auf einen Balken ein, Fortschritt live sichtbar.
- Saison über 4 Wochen mit Liga-Rangliste der Clubs, Auf- und Abstieg zwischen Bronze/Silber/Gold/Elite.
- Club-Feed: automatische Einträge bei neuem Bestwert, Level-Up, Battle-Sieg, plus kurze Text-Posts.
- Exklusive Saison-Badges für Platz 1–3 und für „Wochenziel erreicht".
- Neue Seite „Club" in der Tab-Leiste bzw. als Kachel auf der Startseite.

## Feature 2 – Coach als echter Trainingsbegleiter

Aus dem Chat-Coach wird ein Plan, dem man folgen kann.

- Wochenplan aus Level, Streak, Bestwert und Körperdaten: pro Tag Fokus (Push, Core, Beine, Mobilität, Rest).
- Tagesziel-Karte auf der Startseite mit „Session starten" – öffnet den Workout-Screen vorkonfiguriert.
- Automatische Anpassung: bei verpassten Tagen wird der Plan sanft heruntergefahren, bei starker Woche gesteigert.
- „Wie war meine Woche?" – Auswertung mit echten Zahlen, Trend gegenüber Vorwoche, ein konkreter Tipp.
- Plan wird gespeichert und läuft auch ohne neuen KI-Aufruf weiter (Kosten- und Tempo-Vorteil).

## Feature 3 – Battles 2.0

- Öffentliche Lobby mit Zufalls-Matchmaking gegen andere Online-Nutzer.
- Neue Modi: „Erster auf 30", „60 Sekunden Sprint", „Ausdauer-Duell" (meiste Reps in 5 Min).
- Revanche-Button direkt am Ergebnisbildschirm.
- Bilanz pro Gegner (Siege/Niederlagen) und persönliche Battle-Statistik im Profil.
- Elo-artige Battle-Wertung als eigene Rangliste.

## Feature 4 – Offline & Sync

- App startet und funktioniert ohne Verbindung, zuletzt geladene Daten bleiben sichtbar.
- Trainings, Läufe und Health-Einträge landen offline in einer Warteschlange und werden automatisch nachgesendet.
- Klarer Offline-Hinweis in der Oberfläche plus Anzeige „x Einträge warten auf Synchronisierung".
- Konfliktfreies Nachtragen: Streak und XP werden serverseitig nach Datum berechnet, nicht nach Eingangszeitpunkt.

---

## Technische Hinweise

- Neue Tabellen: `clubs`, `club_members`, `club_posts`, `seasons`, `season_scores`, `training_plans`, `plan_days`, `battle_stats`. Alle mit RLS + GRANTs; Club-Sichtbarkeit über eine SECURITY-DEFINER-Funktion `is_club_member(club_id, user_id)`, um Rekursion in Policies zu vermeiden.
- Club-Wochenziel und Saison-Punkte als serverseitige Aggregation (Trigger auf `workouts` bzw. geplanter Job), nie clientseitig schreibbar – passend zur bestehenden Härtung von XP/Level.
- Wochenplan-Generierung in `src/lib/coach-plan.functions.ts` über den bestehenden AI-Gateway-Aufruf, Ergebnis in `training_plans` gecacht (Neugenerierung max. 1×/Woche oder auf Wunsch).
- Matchmaking über eine `battle_queue`-Tabelle plus Realtime-Kanal; Paarung serverseitig mit `supabaseAdmin`, damit keine Battle-Daten öffentlich lesbar werden.
- Offline über `vite-plugin-pwa` (Network-First für Seiten, Stale-While-Revalidate für Assets) und eine IndexedDB-Warteschlange, die beim `online`-Event abgearbeitet wird; Registrierung nur in der veröffentlichten App, nicht in der Vorschau.

## Reihenfolge

Vorschlag: **2 → 1 → 3 → 4**. Der Coach-Plan wirkt sofort für Einzelnutzer, Clubs bringen den sozialen Sog, Battles 2.0 vertieft den Wettkampf, Offline poliert das App-Gefühl.
