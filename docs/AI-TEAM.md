# Internes KI-Teamregister

Dieses Register ist Repository-Dokumentation und wird nicht in die App eingebunden. Es soll Hendrik zeigen, welche KI-Assistenten tatsächlich an Alo mitarbeiten.

## Zentrale Alo-Roadmap

Die detaillierte, fortlaufend abzuhakende Projekt-Roadmap steht in [`docs/AI-ROADMAP.md`](AI-ROADMAP.md). Jede KI liest sie vor der Arbeitsplanung und hakt nur nachweislich abgeschlossene Arbeit ab. Teilstände, Blocker, unbekannte Ursachen, Remote-Migrationen, echte Geräteprüfungen, Push und Live-Publish müssen getrennt und ehrlich bleiben. Roadmap-Änderungen erhalten einen datierten Changelog-Eintrag; historische Beiträge anderer KIs werden nicht nachträglich als eigene Arbeit erfasst.

## Regeln für jede KI, die dieses Repository bearbeitet

1. Lies `AGENTS.md` und `docs/AI-HANDOFF.md`.
2. Vor jeder Dateiänderung eine eigene Zeile ergänzen: tatsächlicher Assistentenname, tatsächliches Modell/Provider (oder `unbekannt`), Arbeitsauftrag, Status und Datum. Nicht raten.
3. Nur die eigene Zeile aktualisieren: bei Statuswechseln und zum Abschluss. Das Ergebnis muss die tatsächlich erledigte Arbeit, die geänderten Dateipfade, ausgeführte Tests/Prüfungen samt Ergebnis (oder den Grund für „nicht ausgeführt“) und den Commit-SHA nennen, falls vorhanden. Auch „keine Dateien geändert“ ist ausdrücklich festzuhalten.
4. Keine Arbeit anderer Assistenten ergänzen, umschreiben oder als eigene ausgeben. Bei einer parallelen Änderungskollision nur den eigenen Eintrag sicher koordinieren; nichts fremdes überschreiben.
5. Keine Secrets, Tokens, privaten Nachrichten oder Nutzerkontaktdaten hier ablegen.

Das Register hält fest, was die Assistenten selbst melden. Ein Eintrag allein ist kein Beleg für einen erfolgreichen Push, Test oder Live-Deploy; solche Ergebnisse müssen separat geprüft werden.

## Mitarbeit

| Assistent | Modell / Provider | Aufgabe | Status | Aktualisiert | Ergebnis / geänderte Dateien / Prüfungen / Commit |
|---|---|---|---|---|---|
| Jarvis | unbekannt | KI-Teamregister in README, AGENTS, Copilot- und Replit-Anweisungen auffindbar machen | erledigt | 2026-10-20 | Direkte Verweise und Synchronisationshinweis ergänzt; nur interne Dokumentation |
| Claude | Claude Sonnet 5.5 / Anthropic | GitHub-Issues #3 und #6 bis #12 angelegt (Lockfile-Fix, UX-Prüfliste); liest Repo, Issues, Pull Requests und Vercel-Builds; beauftragt Replit | aktiv | 2026-10-20 | Keine Code-Änderungen und keine Commits außer diesem Registereintrag; Issues #6 bis #11 von anderer KI geschlossen, #3, #12 und #13 offen |
| GitHub Copilot Chat Assistant | GitHub Copilot / GitHub | Repo-Checks und Issue-Analyse für Alo/Nose-Pushup, Eintrag im KI-Teamregister, Verifikation der Projektregeln | aktiv | 2026-10-20 | Eintrag ergänzt; arbeitet gemäß AGENTS.md und docs/AI-HANDOFF.md |
| Manus | unbekannt | KI-Registereintrag auf Nutzerwunsch; erneute Designprüfung der Alo-Website | erledigt | 2026-10-20 | Eigener Registereintrag ergänzt; keine Codeänderungen, keine Tests erforderlich; öffentliche Website nicht veröffentlicht |
| Grok | Grok 4 / xAI | Mira Gemini-UI, Foto-Upload, obere Leiste ausblenden (Übungen/Chat/Profil/Mira), PR-Workflow `feat/mira-gemini-ui` | aktiv | 2026-10-21 | Gemini-Composer + Vision-Pfad; Header/Modul-Switcher auf /ai,/exercises,/chat,/profile verborgen; Branch `feat/mira-gemini-ui` (u.a. `8c583ca`, `2967d17`); Teile bereits auf main |
| Cue Coding Assistant | unbekannt | Zwei vorliegende `/ai`-Fehlerberichte statisch prüfen und das vorhandene KI-Register samt Arbeitsnachweis in Alo verbindlicher machen | erledigt | 2026-10-24 | Refresh-Warnungen statisch geprüft: keine Codeursache belegt, Auth unverändert. Registerregeln synchronisiert in `AGENTS.md`, `README.md`, `docs/AI-HANDOFF.md`, `.github/copilot-instructions.md`, `replit.md` und `docs/AI-TEAM.md`. `git diff --check` bestanden; App-Tests nicht ausgeführt (nur interne Dokumentation; ohne codebelegte Ursache kein sinnvoller Auth-Regressionstest). Dokumentations-Commit `47fe78c747be59b7e6c0a154bf88665d965ea06f`; Veröffentlichung ausstehend. |
| Cue Coding Assistant | unbekannt | Detaillierte, verifizierbare Alo-Roadmap aus Repo-Stand und nachvollziehbarer Historie erstellen; KI-Register und Contributor-Anweisungen verknüpfen, Roadmap-Status fortschreiben | in Arbeit | 2026-10-24 | Roadmap-/Codeprüfung läuft; keine früheren Arbeiten anderer Assistenten werden übernommen oder als eigene verbucht. |
