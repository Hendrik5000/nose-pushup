
# Nosy Push-Ups – Erweiterung zur gamifizierten Fitness-App

Wir bauen die bestehende Multi-Exercise-Engine wieder klar auf Push-Ups als Hauptfeature zurück (andere Übungen bleiben optional sichtbar) und ergänzen ein vollständiges Gamification-, Battle- und Coach-System. Umsetzung in **4 Etappen** – nach jeder Etappe ist die App nutzbar.

---

## Etappe 1 – Fundament: Tracking-Modi, XP, Level, Streaks

**Tracking-Modi für Push-Ups**
- Nose-Tap (Haupt, vorhanden)
- Manueller Tap (großer Button)
- Kamera-Modus (MVP): nutzt `getUserMedia` + einfache Bewegungs-/Helligkeitsdifferenz im unteren Bildbereich zur Repetition-Erkennung. Hinweis: kein ML-Modell, dafür offline & ohne Extra-Kosten. Kann später durch MediaPipe Pose ersetzt werden.

**XP & Level**
- 1 Push-Up = 10 XP, Bonus für Streaks & Challenges
- 50 Level mit Titeln: Beginner → Rookie → Athlete → Beast → Machine → Legend → Mythic
- Level-Up-Animation + Sound

**Streak-System**
- `current_streak`, `longest_streak`, `last_workout_date`
- Visuelles Feuer-Icon, „Streak in Gefahr"-Badge ab 20:00 Uhr lokal
- Streak-Freeze (1× pro Woche automatisch)

**DB-Migration**
- `profiles`: + `xp int`, `level int`, `current_streak`, `longest_streak`, `last_workout_date`, `theme text`
- `daily_stats` (user_id, date, total_reps, sessions) für schnelle Charts
- Trigger nach `workouts` insert: XP/Level/Streak/daily_stats aktualisieren

---

## Etappe 2 – Smart Coach, Challenges, Dashboard

**Smart Coach** (Lovable AI, `google/gemini-3-flash-preview`)
- Server-Function `getCoachAdvice`: nimmt letzte 14 Tage Stats → liefert 2–3 Sätze Feedback + konkreten Trainingsvorschlag (z. B. „Heute 4×12 mit 60 s Pause")
- Anzeige als Karte im Dashboard, „Neu generieren"-Button (rate-limited)
- Kurze Motivations-Snippets während des Workouts (lokal aus Pool, ohne AI-Call pro Rep)

**Challenges**
- Tabelle `challenges` (Template) + `user_challenges` (Fortschritt)
- Daily (3 rotierende): z. B. 50 Reps, 3 Sessions, 1 Streak halten
- Weekly: z. B. 300 Reps, neue PR, 5 Tage trainieren
- Belohnung: XP + Coins (für spätere Themes)

**Statistik-Dashboard** (überarbeitet)
- Bar-Chart letzte 30 Tage (Reps)
- Line-Chart Wochenvergleich
- Karten: PR, stärkster Tag, Ø Reps/Session, Streak
- Recharts bereits drin

---

## Etappe 3 – Battle-Modus & Community

**1v1 Battle (Realtime)**
- Tabellen: `battles` (host_id, guest_id, status, duration_s, winner_id), `battle_reps` (battle_id, user_id, count, ts)
- Flow: Host erstellt Battle → Code/Link teilen → Guest joint → Countdown 3-2-1 → 60 s zählen → Ergebnis + Revanche
- Supabase Realtime channel pro Battle für Live-Reps
- Bot-Modus (simulierter Gegner) wenn kein Freund da

**Freunde & Leaderboard**
- `friendships` (requester, addressee, status)
- Globales & Freunde-Leaderboard (Reps/Woche, Level, längste Streak)
- Battle-Bilanz (W/L) am Profil

**Public Profile**
- View `public_profiles` (display_name, avatar, level, longest_streak, total_reps) – RLS: alle authenticated lesen

---

## Etappe 4 – Achievements, Themes, Sounds, Politur

**Achievements** (~25)
- Erste 10 / 100 / 1000 / 10000 Reps, Streak 7/30/100, Battle gewonnen, Level 10/25/50, Challenge-Sammler, etc.
- Trigger-basiert, Badge-Galerie im Profil

**Themes**
- Dark (default), Gym (warm rot/orange), Neon (cyan/magenta), Minimal (mono)
- CSS-Variablen-Sets in `styles.css`, Auswahl in Einstellungen, Persistenz in `profiles.theme`
- Manche Themes durch Level/Coins freischaltbar

**Sounds & Haptik**
- Pro Push-Up: kurzer Click (Web Audio, generiert – keine Asset-Größe)
- Level-Up, Battle-Win, Streak-Save: eigene Töne
- Vibration via `navigator.vibrate` wo verfügbar
- Stummschalt-Toggle

**Politur**
- Onboarding (3 Slides)
- Empty States, Loading-Skeletons
- PWA-Manifest fürs Home-Screen-Icon

---

## Technische Hinweise

- Backend: Lovable Cloud + `createServerFn` mit `requireSupabaseAuth`
- AI: Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Realtime: Supabase Realtime für Battles
- Kein neuer Provider, keine extra Secrets nötig
- Push-Ups bekommen wieder einen prominenten „Start"-CTA auf der Startseite; andere Übungen rutschen in einen „Mehr Übungen"-Bereich

---

## Reihenfolge & Bestätigung

Vorschlag: **Etappe 1 zuerst** umsetzen (Modi, XP/Level/Streak, Migration, Dashboard-Update), dann nach deinem OK Etappe 2.

Soll ich mit Etappe 1 starten – oder willst du die Reihenfolge ändern (z. B. Battle-Modus früher)?
