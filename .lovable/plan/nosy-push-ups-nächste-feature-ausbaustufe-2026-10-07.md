# Nosy Push-Ups – nächste Feature-Ausbaustufe

Bereits live: Cali-System (Skill-Tree, Tages-Check-in, Load-Manager, Stagnations-Hinweis), Coach mit Wochenplan, Clubs & Liga, Battles 2.0, Saisons & Shop, Programme, Form-Check, Offline-Sync, Teilen & öffentliches Profil.

Diese vier Features schließen die Lücken aus dem Cali-System-Konzept und vertiefen die vorhandenen Systeme.

---

## Feature 1 – Cali 2.0: RPE-Tracking & Plateau-KI

Aus dem Stagnations-Hinweis wird echte Analyse mit Handlungsempfehlung.

- Nach jedem Satz kurzes Belastungs-Feedback (RPE 1–10, ein Tippen genügt), gespeichert am Workout.
- Trendanalyse pro Skill: Haltezeiten/Wiederholungen der letzten 4 Wochen als Verlaufslinie, Plateau wird automatisch erkannt (keine Verbesserung über 2 Wochen trotz Training).
- Bei Plateau generiert der Coach konkrete Empfehlungen (Volumen senken, leichtere Progression mit mehr Volumen, mehr Schlaf, Pausen anpassen).
- Dynamischer Tagesfokus: Das morgendliche Check-in (Energie/Schmerzen) steuert, welcher Skill heute dran ist – bei Topform wird der Hochform-Skill vorgeschlagen, bei Müdigkeit Mobilität.

## Feature 2 – Readiness-Score

Ein täglicher Gesamtscore, der alle Datenquellen verbindet.

- Score aus Schlaf, Schritten, Check-in (Energie/Schmerzen), Trainingslast der letzten 7 Tage und Streak.
- Prominente Anzeige auf der Startseite mit Ampel (grün = vollgas, gelb = moderat, rot = regenerieren).
- Der Score steuert automatisch den Coach-Wochenplan und den Cali-Load-Manager – keine doppelte Logik mehr.
- Verlauf der letzten 14 Tage als kleine Grafik.

## Feature 3 – Wochenrückblick zum Teilen

Der Sonntags-Rückblick als sichtbares Ritual.

- Automatische Wochen-Zusammenfassung: Reps, Trainings, Streak, bester Satz, Form-Score-Trend, Vergleich zur Vorwoche in Prozent.
- Als teilbare Bild-Karte (bestehende ShareCard-Technik) für Stories/Status.
- Sonntags-Benachrichtigung „Deine Woche ist da" (bestehendes Notification-System).
- Archiv vergangener Wochenberichte im Profil.

## Feature 4 – Battle-Liga & Rivalen

Battles bekommen ein Langzeit-Gesicht.

- Elo-Ranglisten-Seite: Top-Spieler nach Battle-Wertung, eigene Platzierung, Verlauf der letzten 10 Kämpfe.
- Rivalen-Ansicht: Bilanz pro Gegner (Siege/Niederlagen), direkter Revanche-Button.
- Saisonale Battle-Platzierung: Battle-Punkte fließen in die Saison-Wertung ein.
- „Nemesis"-Abzeichen für 5 Siege gegen denselben Gegner.

---

## Technische Hinweise

- RPE: neue nullable Spalte `rpe` auf `workouts` (1–10), Eingabe im Workout-Abschluss; keine Breaking Changes.
- Plateau-Erkennung in `src/lib/calisthenics.ts` (reine Auswertung vorhandener Workout-Daten), KI-Empfehlung über den bestehenden Coach-Aufruf in `src/lib/coach-chat.functions.ts`, Ergebnis gecacht in `coach_advice`.
- Readiness-Score rein clientseitig berechnet aus `health_entries`, `workouts` und Check-in-Daten; als eigenes Modul `src/lib/readiness.ts`, damit Startseite, Coach-Plan und Cali-Hub denselben Score nutzen.
- Wochenrückblick: Aggregation aus `daily_stats` + `workouts`, Bild über `ShareCard`-Canvas, Benachrichtigung über das lokale Notification-System.
- Battle-Liga: nur Lese-Auswertung der vorhandenen `battles`-/`profiles.battle_rating`-Daten, keine neue Tabelle nötig; Nemesis-Abzeichen über den bestehenden Achievement-Trigger.

## Reihenfolge

Vorschlag: **2 → 1 → 3 → 4**. Der Readiness-Score liefert die Datenbasis für Cali 2.0, der Wochenrückblick macht Fortschritt sichtbar, die Battle-Liga rundet den Wettkampf ab.
