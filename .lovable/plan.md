# Nosy Push-Ups – Nächste große Updates

Stand: Achievements & Badge-Galerie (Phase 1) und Themes (Phase 2) sind live. Battles, Freunde, Leaderboards, Läufe, Health-Eingabe und der KI-Coach existieren bereits. Die nächsten Updates zielen darauf, dass die App sich nativer anfühlt, Nutzer zurückkommen und Battles wiederspielbar werden.

---

## Update 1 – Feedback & App-Feeling (Sounds, Haptik, PWA)

**Ziel:** Jede Wiederholung fühlt sich spürbar an, und die App ist wie eine echte App installierbar.

- Sound-Feedback: Klick pro Rep, Level-Up-Fanfare, Battle-Sieg, Streak-gerettet.
- Vibration auf dem Handy bei Rep, Level-Up und Battle-Ende.
- Ton- und Vibrations-Schalter im Profil, gespeichert pro Konto.
- Installierbar machen: App-Manifest mit dem vorhandenen Icon, Startfarbe passend zum aktiven Theme, Vollbild-Start ohne Browserleiste.
- Offline-Start: Die App öffnet auch ohne Verbindung, Trainings werden bei Rückkehr nachgesendet.

## Update 2 – Wiederkommen: Onboarding, Erinnerungen, Wochenrückblick

**Ziel:** Neue Nutzer verstehen die App in 20 Sekunden, bestehende bekommen einen Grund zurückzukommen.

- **Onboarding in 3 Schritten** beim ersten Start: Nase-Modus erklären, XP/Streak/Level zeigen, Freunde & Battle vorstellen. Status wird im Profil gespeichert, erscheint also nur einmal.
- **Streak-Erinnerung**: Wer eine laufende Serie hat und bis abends nicht trainiert hat, bekommt eine Benachrichtigung. Nur nach ausdrücklicher Zustimmung.
- **Streak-Rettung sichtbar machen**: Anzeige der verfügbaren Streak-Freezes plus Button „Streak retten“, wenn gestern gefehlt hat.
- **Wochenrückblick** (sonntags): eigene Seite mit Reps der Woche, neuen Bestwerten, abgeschlossenen Challenges und Level-Fortschritt – als teilbare Karte.
- Leere Zustände und Ladeskelette überall dort, wo aktuell nur „Lade…“ oder eine leere Liste steht.

## Update 3 – Battles ausbauen

**Ziel:** Battles werden sozialer und wiederspielbar statt einmalig.

- Revanche-Button direkt im Ergebnisbildschirm.
- Battle-Bilanz pro Gegner (Siege/Niederlagen) im Profil und in der Freundesliste.
- Öffentliche Lobby mit Zufalls-Matchmaking gegen andere Nutzer, die gerade suchen.
- Verschiedene Battle-Modi: Zeitlimit (aktuell), „Erster auf 30 Reps“ und Ausdauer-Duell.

## Update 4 – Trainingsplan & Coach-Anbindung

**Ziel:** Der KI-Coach wird von einem Chat zu einem echten Begleiter.

- Wöchentlicher Trainingsplan, den der Coach aus Level, Streak, Körperdaten und den letzten Trainings erstellt.
- Plan erscheint als Tagesziel-Karte auf der Startseite und hakt sich beim Training selbst ab.
- Coach erkennt Plateaus und Pausen und passt den Plan automatisch an.
- Rückblick im Chat: „Wie war meine Woche?“ beantwortet der Coach mit echten Zahlen.

---

## Technische Hinweise

- Sounds über die Web-Audio-API mit kurzen, im Code erzeugten Tönen – keine externen Audiodateien nötig; Vibration über `navigator.vibrate` mit Feature-Check.
- PWA über ein statisches Manifest plus Service Worker; Offline-Warteschlange für Workouts im lokalen Speicher, Sync beim Wiederverbinden.
- Push-Benachrichtigungen über die Web-Push-API; Versand über eine geplante Server-Route unter `api/public/*` mit Signaturprüfung.
- Neue Spalten am Profil für Onboarding-Status, Sound-/Vibrations-Einstellung und Push-Abo; Battle-Modus als zusätzliche Spalte an `battles`.
- Matchmaking-Warteschlange als eigene Tabelle mit Realtime, kein Polling.
- Alle neuen Tabellen mit Zugriffsregeln auf den eigenen Nutzer beschränkt, Battle-Ergebnisse weiterhin ausschließlich serverseitig aus dem Rep-Ledger berechnet.

---

## Vorschlag zur Reihenfolge

Ich würde mit **Update 1** starten (sofort spürbar, kleiner Umfang), dann **Update 2** (größter Effekt auf Wiederkehr), danach 3 und 4.
