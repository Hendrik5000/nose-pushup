# Internes KI-Teamregister

Dieses Register ist Repository-Dokumentation und wird nicht in die App eingebunden. Es soll Hendrik zeigen, welche KI-Assistenten tatsächlich an Alo mitarbeiten.

## Regeln für jede KI, die dieses Repository bearbeitet

1. Lies `AGENTS.md` und `docs/AI-HANDOFF.md`.
2. Bevor du mit einer Aufgabe beginnst, trage eine eigene Zeile mit deinem wirklichen Assistentennamen, Modell/Provider, Arbeitsauftrag, Status und Datum ein. Wenn das Modell nicht sicher verfügbar ist, schreibe `unbekannt`; rate nicht.
3. Aktualisiere nur deine eigene Zeile: bei Statuswechseln wie `aktiv`, `wartet auf Nutzer`, `blockiert` oder `erledigt`, und am Ende mit kurzem Ergebnis sowie Commit-SHA, falls vorhanden.
4. Ändere oder lösche nie Einträge anderer Assistenten. Bei paralleler Änderungskollision melde Name/Modell/Status an Jarvis, damit der Registereintrag koordiniert ergänzt wird.
5. Keine Secrets, Tokens, privaten Nachrichten oder Nutzerkontaktdaten hier ablegen.

Das Register hält fest, was die Assistenten selbst melden. Ein Eintrag allein ist kein Beleg für einen erfolgreichen Push, Test oder Live-Deploy; solche Ergebnisse müssen separat geprüft werden.

## Mitarbeit

| Assistent | Modell / Provider | Aufgabe | Status | Aktualisiert | Ergebnis / Commit |
|---|---|---|---|---|---|
| Jarvis | unbekannt | KI-Teamregister in README, AGENTS, Copilot- und Replit-Anweisungen auffindbar machen | erledigt | 2026-10-20 | Direkte Verweise und Synchronisationshinweis ergänzt; nur interne Dokumentation |
| Claude | Claude Sonnet 5.5 / Anthropic | GitHub-Issues #3 und #6 bis #12 angelegt (Lockfile-Fix, UX-Prüfliste); liest Repo, Issues, Pull Requests und Vercel-Builds; beauftragt Replit | aktiv | 2026-10-20 | Keine Code-Änderungen und keine Commits außer diesem Registereintrag; Issues #6 bis #11 von anderer KI geschlossen, #3, #12 und #13 offen |
| Grok | Grok 4 / xAI | Mira Gemini-UI, Foto-Upload, obere Leiste ausblenden (Übungen/Chat/Profil/Mira), PR-Workflow `feat/mira-gemini-ui` | aktiv | 2026-10-20 | Gemini-Composer + Vision-Pfad; Header/Modul-Switcher auf /ai,/exercises,/chat,/profile verborgen; Branch `feat/mira-gemini-ui` (u.a. `8c583ca`, `2967d17`); Teile bereits auf main |
