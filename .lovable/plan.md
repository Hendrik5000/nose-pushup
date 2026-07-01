# Nosy Push-Ups – Roadmap für große neue Funktionen

Etappe 1 (XP/Level/Streak/Modi) und der Coach-Bereich sind live. Jetzt kommen die vier großen Ausbaustufen, die die App zu einer echten gamifizierten Fitness-Community machen. Nach jeder Etappe ist die App voll nutzbar.

---

## Etappe A – Smart Coach v2 + Challenges

**Smart Coach v2 (AI)**
- Neue Server-Function `getCoachAdvice` nutzt Lovable AI (`google/gemini-3-flash-preview`).
- Input: letzte 14 Tage `daily_stats`, PR, Streak, Level.
- Output: 2–3 Sätze Feedback + konkreter Tagesplan (z. B. „4×12, 60 s Pause").
- Anzeige im bestehenden `CoachPanel` mit „Neu generieren" (rate-limited auf 1×/Stunde pro User).
- Fallback: bestehende regelbasierte Logik, wenn AI fehlschlägt.

**Daily & Weekly Challenges**
- Tabellen `challenges` (Templates) + `user_challenges` (Fortschritt, reset_at).
- 3 rotierende Daily Challenges (z. B. 50 Reps, 3 Sessions, Streak halten).
- 1 Weekly Challenge (z. B. 300 Reps, neuer PR).
- Belohnung: Bonus-XP + Coins (für spätere Themes).
- UI: Challenge-Karten auf dem Dashboard mit Fortschrittsbalken.

## Etappe B – Battle-Modus (Realtime 1v1)

**Datenbank**
- `battles` (host_id, guest_id, status, duration_s, winner_id, code).
- `battle_reps` (battle_id, user_id, count, ts).

**Flow**
- Host erstellt Battle → 6-stelliger Code / Share-Link.
- Guest joint → Countdown 3-2-1 → 60 s Zählphase → Ergebnis + Revanche.
- Supabase Realtime Channel pro Battle für Live-Reps beider Seiten.
- Bot-Modus: simulierter Gegner nach realistischem Reps/s-Profil, wenn niemand joint.

**UI**
- Neue Route `/_authenticated/battle` (Lobby) und `/_authenticated/battle/$id` (Arena).
- Live-Balken beider Spieler, Rep-Counter, Restzeit.
- Ergebnisscreen mit W/L-Bilanz-Update.

## Etappe C – Social: Freunde, Leaderboards, Public Profile

- `friendships` (requester, addressee, status).
- View `public_profiles` (display_name, avatar, level, longest_streak, total_reps) – lesbar für alle authenticated.
- Globales & Freunde-Leaderboard (Reps/Woche, Level, längste Streak) als eigene Route `/leaderboard`.
- Battle-Bilanz (W/L) und Achievements-Badges am Profil sichtbar.
- Freund hinzufügen per Suche (Anzeigename) oder Battle-Code.

## Etappe D – Achievements, Themes, Sounds, Politur

**Achievements (~25)**
- Meilensteine: 10 / 100 / 1 000 / 10 000 Reps, Streak 7 / 30 / 100, Level 10 / 25 / 50, Battle-Wins, Challenge-Sammler.
- DB-Trigger auf `workouts`/`battles`/`user_challenges` vergibt Badges.
- Badge-Galerie im Profil, Toast bei Freischaltung.

**Themes**
- Dark (Default), Gym (rot/orange), Neon (cyan/magenta), Minimal (mono).
- CSS-Variablen-Sets in `styles.css`, Auswahl in Einstellungen, Persistenz in `profiles.theme`.
- Einige Themes durch Level/Coins freischaltbar.

**Sounds & Haptik**
- Web-Audio-Click pro Rep (keine Asset-Größe), eigene Sounds für Level-Up / Battle-Win / Streak-Save.
- `navigator.vibrate` wo verfügbar, globaler Mute-Toggle.

**Politur**
- 3-Slide-Onboarding, Empty States, Loading-Skeletons.
- PWA-Manifest fürs Home-Screen-Icon.

---

## Technische Hinweise

- Backend: Lovable Cloud, `createServerFn` mit `requireSupabaseAuth` für alle privaten Reads/Writes.
- AI: Lovable AI Gateway – kein zusätzlicher Key nötig.
- Realtime: Supabase Realtime Channels für Battles.
- Alle neuen Tabellen mit RLS + GRANTs; Achievements & Challenges über SECURITY DEFINER-Trigger.

## Reihenfolge

Vorschlag: **A → B → C → D**. Etappe A baut direkt auf dem Coach-Panel auf und liefert schnellen sichtbaren Mehrwert; danach das große Highlight Battle-Modus.

Womit soll ich starten – Etappe A (Coach v2 + Challenges) oder lieber direkt Etappe B (Battle-Modus)?
