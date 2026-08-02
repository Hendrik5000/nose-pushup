# Nosy Push-Ups – Nächste große Features

Ausgangslage: Etappe A (Smart Coach + Challenges), B (Battle-Modus) und C (Freunde + Leaderboards) sind live. Etappe D ist noch offen. Fokus: User-Engagement steigern durch Gamification, Personalisierung und ein runderes Erstbesucher-Erlebnis.

---

## Phase 1 – Achievements & Badge-Galerie

**Ziel:** Spielerische Meilensteine sichtbar machen und Motivation durch sammelbare Badges liefern.

- Tabelle `achievements` (id, title, description, icon, category, condition_type, condition_value, xp_reward, hidden).
- Tabelle `user_achievements` (user_id, achievement_id, unlocked_at, seen).
- Kategorien:
  - Reps: 10 / 100 / 1.000 / 10.000 / 50.000 Push-Ups
  - Streak: 7 / 30 / 100 / 365 Tage
  - Level: 10 / 25 / 50
  - Battle: 1 / 10 / 50 / 100 Siege
  - Challenges: 5 / 25 / 100 abgeschlossen
  - Social: Erste Freundschaft, 5 Freunde
- SECURITY DEFINER-Trigger auf `workouts`, `battles` und `user_challenges` prüft Bedingungen und vergibt Badges serverseitig.
- UI:
  - Badge-Galerie im Profil (gesperrt = Silhouette, freigeschaltet = farbig).
  - Toast/Popup bei Freischaltung mit XP-Bonus.
  - "Neu"-Badge für ungesehene Achievements.

## Phase 2 – Themes & App-Personalisierung

**Ziel:** Die App fühlt sich individuell an und bindet Langzeit-Nutzer durch Freischaltbares.

- Spalte `profiles.theme` erweitern (`dark`, `gym`, `neon`, `minimal`, `ocean`).
- CSS-Variablen-Sets in `styles.css` für jedes Theme.
- Theme-Wähler in den Profileinstellungen.
- Einige Themes freischaltbar per Level/Achievement (z. B. Neon ab Level 15, Ocean ab Streak 30).
- App-Icon-Variante passend zum aktiven Theme (optional).

## Phase 3 – Sounds, Haptik & PWA-Politur

**Ziel:** Feedback pro Rep, Erfolgsmomente spürbar machen, App installierbar wie eine native App.

- Web-Audio-API:
  - Klick pro Rep.
  - Level-Up-Sound.
  - Battle-Win / Streak-Save-Sound.
- `navigator.vibrate` für Rep, Level-Up und Battle-Ergebnis.
- Globaler Mute-/Sound-Toggle in den Einstellungen.
- PWA-Manifest (`manifest.json`, Icons, `theme-color`, `display: standalone`).
- Service-Worker-Registrierung für Offline-Start und Add-to-Home-Screen-Prompt.

## Phase 4 – Engagement-Loop: Erinnerungen, Recaps & Onboarding

**Ziel:** Nutzer kommen zurück, verstehen die App sofort und feiern Fortschritte.

- **3-Slide-Onboarding** für neue Nutzer:
  1. Nose-Push-Up erklären.
  2. XP, Streak, Level zeigen.
  3. Freunde & Battle einladen.
  - Onboarding-Status in `profiles.onboarded` speichern.
- **Streak-Erinnerung** (Browser-Push-Notification):
  - Wenn Streak aktiv und bis 20 Uhr kein Workout → "Hol dir deine Streak!".
  - Opt-in in den Einstellungen.
- **Wöchentlicher Recap** (Push + In-App-Seite):
  - Reps-Woche, neue PBs, abgeschlossene Challenges, Level-Up.
  - Sonntags als Notification und als teilbare Karte.
- **Streak-Freeze-UI**:
  - Sichtbarer Counter `streak_freezes`.
  - Button "Streak retten" für gestern, falls Freeze verfügbar.
- **Empty States & Loading-Skeletons** überall dort, wo aktuell "Lade…" oder leere Listen stehen.

## Phase 5 – Battle-Modus ausbauen (optional, Engagement-Booster)

**Ziel:** Battles noch sozialer und wiederspielbarer machen.

- Revanche-Button direkt nach Battle-Ergebnis.
- Battle-Statistik (Siege/Niederlagen pro Gegner).
- Öffentliche Battle-Lobby mit Zufalls-Matchmaking gegen Online-Nutzer.

---

## Technische Hinweise

- Backend: Lovable Cloud, `createServerFn` mit `requireSupabaseAuth` für alle privaten Reads/Writes.
- Alle neuen Tabellen mit RLS + GRANTs; Achievements über SECURITY DEFINER-Trigger.
- Push-Notifications über Web Push (VAPID) oder Browser-Notification-API; erst einfach beginnen mit `Notification.requestPermission`.
- Sounds rein per Web-Audio-API generieren, keine externen Assets nötig.
- PWA-Manifest und Service-Worker über Vite-PWA-Plugin oder manuell in `public/`.

## Reihenfolge

Vorschlag: **1 → 2 → 3 → 4 → 5**. Jede Phase ist nach Fertigstellung allein nutzbar und liefert sichtbaren Mehrwert. Phase 1 (Achievements) und Phase 4 (Onboarding/Reminders) haben den stärksten Engagement-Effekt.

Soll ich mit Phase 1 beginnen?
