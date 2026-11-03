# Neue Funktionen: Mira & KI + Gesundheit & Geräte

## 1. Mira Sprach-Coach
- Mikrofon-Taste im Mira-Chat: sprechen statt tippen, Antwort wird vorgelesen (an/aus).
- Freihändiger Trainingsmodus: Mira zählt Sätze an und motiviert während des Workouts.

## 2. Mira Trainingsanalyse
- Wöchentliche KI-Auswertung (Gemini): Stärken, Schwächen, ein konkretes Ziel für die nächste Woche.
- Verknüpft mit Readiness-Score, RPE und Plateau-Erkennung; Ergebnis wird zwischengespeichert, damit es nicht jedes Mal neu berechnet wird.

## 3. Ernährungstipps mit Foto
- Mahlzeit fotografieren → Mira schätzt Kalorien/Protein und gibt einen kurzen Tipp passend zum Trainingsziel.
- Tagesübersicht Protein im Dashboard (optional, nur eigene Daten).

## 4. Echte Gesundheitsdaten
- Schlaf, Schritte und Ruhepuls über Google Health Connect übernehmen (statt fester 7 h Schlaf-Schätzung).
- Manueller Eintrag als Fallback für Web/iPhone.
- Readiness-Score nutzt die echten Werte automatisch.

## 5. Home-Screen-Schnellstart
- App-Verknüpfungen beim langen Drücken des App-Icons: „Push-Ups starten", „Lauf starten", „Mira fragen".
- Kleine Tagesübersicht (Streak, heutige Reps) als Startkarte nach dem Öffnen.

## Reihenfolge
4 → 2 → 1 → 3 → 5 (erst echte Daten, dann bessere KI darauf aufbauen).

## Technische Details
- KI über Lovable AI Gateway (Gemini, kein eigener Schlüssel); Server-Funktionen mit Anmeldung.
- Sprache: Browser-Spracherkennung + Gateway-Sprachausgabe.
- Foto-Analyse: Bild an Gemini-Vision, Bild wird nicht dauerhaft gespeichert.
- Neue Tabellen additiv: health_samples (Schlaf/Schritte/Puls pro Tag), meal_logs; RLS nur eigene Zeilen, GRANTs.
- Shortcuts über PWA-Manifest `shortcuts`.
