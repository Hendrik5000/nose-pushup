# Nosy Push-Ups – nächste große Ausbaustufe

Umgesetzt sind bereits: Coach mit Wochenplan, Clubs & Liga, Battles 2.0, Offline-Sync, Achievements, Themes, Läufe, Health, Benachrichtigungen, PWA/Android.

Diese vier Upgrades bringen den nächsten großen Sprung.

---

## Upgrade 1 – Form-Check mit der Kamera

Aus dem Kamera-Zähler wird ein echter Technik-Trainer.

- Bewertung jeder Wiederholung: Tiefe, Hüftlinie, Tempo – Note von 1 bis 5.
- Live-Hinweis während des Satzes („tiefer", „Hüfte hoch", „langsamer").
- Nur saubere Wiederholungen zählen voll, halbe Reps zählen halb (abschaltbar).
- Form-Score pro Training, Verlauf im Profil, eigenes Abzeichen für 20 saubere Sätze.
- Kurzer Video-Schnipsel der schlechtesten Wiederholung (bleibt nur auf dem Gerät).

## Upgrade 2 – Saisons, Ligen und Belohnungen

Der Langzeit-Motor über der Wochenlogik.

- Saison über 6 Wochen, danach Reset mit Rangliste und Saison-Abzeichen.
- Ligen Bronze/Silber/Gold/Elite für Einzelspieler und Clubs, Auf- und Abstieg.
- Punkte aus Trainings, Streak, Battles, Challenges und Club-Beitrag.
- Saison-Shop: Themes, Avatar-Rahmen und Streak-Freezes gegen gesammelte Punkte.
- Saison-Countdown und aktuelle Platzierung auf der Startseite.

## Upgrade 3 – Trainingsprogramme statt Einzel-Sessions

- Mehrwöchige Programme („30 Tage Push-Ups", „Erster Klimmzug", „Core 4 Wochen").
- Klarer Tagesablauf mit Sätzen, Pausen-Timer und automatischem Weiterschalten.
- Fortschrittsbalken über das ganze Programm, Nachholen verpasster Tage.
- Coach passt Sätze automatisch an die letzten Ergebnisse an.
- Abschluss-Zertifikat mit Vorher/Nachher-Zahlen zum Teilen.

## Upgrade 4 – Sozial teilen und einladen

- Teilbare Ergebnis-Karte (Bild) für Training, Lauf, Battle-Sieg und Level-Up.
- Öffentliches Profil unter eigener Adresse mit Bestwerten und Abzeichen, per Schalter ein/aus.
- Einladungslink für Freunde und Clubs, Bonus für beide nach dem ersten Training.
- Wochenrückblick als Bild mit den wichtigsten Zahlen, jeden Sonntag als Hinweis.

---

## Technische Hinweise

- Form-Check erweitert `useCameraDetection` um Winkel-Auswertung aus den vorhandenen MediaPipe-Landmarks (Ellbogen-, Hüft-, Schulterwinkel); Bewertung läuft rein auf dem Gerät. Neue Spalten `form_score`, `clean_reps` auf `workouts`; Videoschnipsel nur im Browser-Speicher, kein Upload.
- Saisons: Tabellen `seasons`, `season_scores`, `shop_items`, `user_items` mit RLS und GRANTs. Punkte ausschließlich serverseitig per Trigger/Server-Funktion, passend zur bestehenden Härtung von XP und Level. Saisonwechsel über eine geplante Server-Route unter `src/routes/api/public/*` mit Secret-Prüfung.
- Programme: Tabellen `programs`, `program_days`, `user_programs`, `user_program_days`. Vorlagen als feste Daten in der Migration, individuelle Anpassung über die bestehende Coach-Plan-Logik in `src/lib/coach-plan.functions.ts`.
- Ergebnis-Karten werden als Bild im Browser gezeichnet (Canvas) und über die native Teilen-Funktion weitergegeben; kein Server-Rendering. Öffentliches Profil als öffentliche Route mit eigener Server-Funktion und enger Leserichtlinie, nur freigegebene Felder.

## Reihenfolge

Vorschlag: **1 → 3 → 2 → 4**. Der Form-Check verbessert sofort jedes Training, Programme geben Struktur, Saisons binden langfristig, Teilen bringt neue Nutzer.
