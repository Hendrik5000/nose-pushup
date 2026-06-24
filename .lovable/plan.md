
# Nose Push → vollständige Fitness-Plattform

Vier Feature-Pakete, aufeinander aufbauend. Jedes Paket ist eigenständig nutzbar, lässt sich aber in dieser Reihenfolge am sinnvollsten ausrollen.

---

## 1. Mehr Übungen (Multi-Exercise Engine)

Heute zählt die App nur Push-Ups via Nasen-Touch. Wir verallgemeinern den Counter zu einer Engine, die mehrere Übungen kennt.

**Übungen v1**
- Push-Ups (Nase aufs Display)
- Sit-Ups (Nase aufs hochgehaltene Handy am Knie)
- Squats (Handy in Hosentasche → Beschleunigungssensor, hoch/runter-Erkennung)
- Plank (Timer + Stabilitäts­erkennung via Gyroskop)
- Burpees (Kombi: Touch unten + Bewegung oben)

**Technisch**
- Neuer Übungs-Registry-Code mit Strategy-Pattern: jede Übung definiert Erkennung (Touch / DeviceMotion / Timer), Mindest-Intervall, Animation, Sound.
- `workouts`-Tabelle erweitert um `exercise_id text not null default 'pushup'`.
- Neue Tabelle `exercises` (id, name, icon, detection_type, unit, description) – serverseitig gepflegt.
- Übungsauswahl-Screen auf der Startseite vor dem Start.
- Sensor-Permission-Handling für iOS (`DeviceMotionEvent.requestPermission`).

---

## 2. Training & Coaching

Aus dem Counter wird ein echter Trainings-Begleiter.

**Trainingspläne**
- Vorgefertigte Pläne: „30-Tage Push-Up", „Anfänger Ganzkörper", „Power Woche".
- Tagesansicht: heutige Session mit Sätzen × Wiederholungen, Pausen-Timer, Fortschrittsbalken.
- Eigener Plan-Editor: Sätze, Pausen, Übungs-Mix definieren.

**Ziele & Streaks**
- Wochenziel (z. B. 200 Push-Ups/Woche), Tagesziel.
- Streak-Counter: Tage in Folge mit erreichtem Tagesziel. Visualisierung als Kalender-Heatmap.
- Push-Erinnerungen am gewählten Trainingszeitpunkt (Web Push API).

**KI-Coach**
- Nach jeder Session: kurze Analyse via Lovable AI Gateway (`google/gemini-2.5-flash`) mit Trend, Verbesserungs-Tipp, Motivation.
- Wöchentlicher KI-Report auf der Profilseite.

**Technisch**
- Tabellen: `training_plans`, `plan_days`, `user_plan_progress`, `user_goals`.
- Serverfunktion `getCoachInsight` (mit `requireSupabaseAuth`) ruft AI Gateway.
- Heatmap mit Recharts oder eigener SVG-Grid-Komponente.

---

## 3. Gamification

Belohnungssystem, das zum täglichen Öffnen motiviert.

**XP & Level**
- Jede Wiederholung gibt XP, Bonus-XP für neue Bestwerte und gehaltene Streaks.
- 50 Level mit eigenen Titeln („Nase-Padawan" → „Liegestütz-Lord").
- Level-Up-Animation mit Konfetti.

**Achievements**
- ~30 Abzeichen: „Erste 10", „Plank 2 min", „7-Tage-Streak", „100 Squats in einer Session", „Mitternachts-Workout".
- Achievement-Galerie im Profil mit Fortschrittsbalken pro Abzeichen.

**Tägliche Quests**
- Drei rotierende Quests pro Tag (z. B. „Mache heute 25 Sit-Ups", „Schlage deinen Push-Up-Schnitt").
- XP- und Coin-Belohnung beim Abschluss.

**Coins & Cosmetics**
- Verdiente Coins schalten optionale Themes, Avatar-Rahmen und Sounds frei.

**Technisch**
- Tabellen: `user_xp` (user_id, xp, level), `achievements` (statisch), `user_achievements`, `daily_quests`, `user_quest_progress`, `cosmetics`, `user_cosmetics`.
- Server-Trigger nach Workout-Insert: XP berechnen, Quests prüfen, Achievements freischalten – als Postgres-Funktion + Trigger.

---

## 4. Social & Wettbewerb

Aus der Solo-App wird eine Community.

**Freunde & Profile**
- Öffentliche Profilseiten mit Username, Avatar, Level, Top-Übungen.
- Freundschafts­anfragen, Freundes-Feed (letzte Sessions, neue Achievements).
- Username-Vergabe beim ersten Login (eindeutig).

**Leaderboards**
- Globale Ranglisten pro Übung: heute, Woche, Allzeit-Bestwert.
- Freundes-Rangliste als gefilterte Ansicht.
- Länder-Leaderboard (optional, auf Zustimmung).

**Duelle (Realtime)**
- 1-gegen-1-Challenge: beide haben 60 Sek., wer mehr Reps schafft gewinnt.
- Lobby per Code oder Freundes-Einladung.
- Realtime-Sync via Supabase Realtime: live gegnerischer Counter sichtbar.

**Challenges**
- Gruppen-Challenges („Wer schafft im Mai die meisten Push-Ups?").
- Beitritt per Link, Live-Tabelle.

**Technisch**
- Tabellen: `friendships`, `friend_requests`, `duels`, `duel_participants`, `duel_events`, `challenges`, `challenge_members`.
- Realtime auf `duel_events` und `duel_participants` aktivieren.
- Public-View `public_profiles` für gelistete Profile (Username, Avatar, Level – keine PII).
- Eigene Server­funktionen für Matchmaking & Duell-Beitritt mit Validierung.

---

## Rollout-Reihenfolge

1. **Multi-Exercise Engine** (Basis für alles Weitere)
2. **Gamification** (sofort spürbarer Motivations-Boost)
3. **Training & Coaching** (Tiefe & Wiederkehr)
4. **Social & Wettbewerb** (Netzwerkeffekt zum Schluss)

---

## Offene Entscheidungen

- **Schritt 1 starten?** Wir würden mit Paket 1 (Multi-Exercise + erweitertes Datenmodell) beginnen, weil alle anderen Pakete darauf aufbauen.
- **Sounds & Haptik**: aktivieren oder optional?
- **Profile öffentlich**: Standard öffentlich oder Standard privat?

Sag Bescheid, ob ich direkt mit **Paket 1** starten soll oder ob du Prioritäten ändern willst.
