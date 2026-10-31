# Internes KI-Teamregister

Dieses Register ist Repository-Dokumentation und wird nicht in die App eingebunden. Es soll Hendrik zeigen, welche KI-Assistenten tatsächlich an Alo mitarbeiten.

## Zentrale Alo-Roadmap

Die detaillierte, fortlaufend abzuhakende Projekt-Roadmap steht in [`docs/AI-ROADMAP.md`](AI-ROADMAP.md). Jede KI liest sie vor der Arbeitsplanung und hakt nur nachweislich abgeschlossene Arbeit ab. Teilstände, Blocker, unbekannte Ursachen, Remote-Migrationen, echte Geräteprüfungen, Push und Live-Publish müssen getrennt und ehrlich bleiben. Roadmap-Änderungen erhalten einen datierten Changelog-Eintrag; historische Beiträge anderer KIs werden nicht nachträglich als eigene Arbeit erfasst.

## Projektübersicht

Eine detaillierte Übersicht über Aufbau, Routen, Datenbank, Mira, Nexus, Teststand und Code-Befunde steht in [`docs/AI-PROJEKTUEBERSICHT.md`](AI-PROJEKTUEBERSICHT.md). Sie ist reine Dokumentation und kein Ersatz für Roadmap oder Handoff.

## Regeln für jede KI, die dieses Repository bearbeitet

1. Lies `AGENTS.md` und `docs/AI-HANDOFF.md`.
2. Vor jeder Dateiänderung eine eigene Zeile ergänzen: tatsächlicher Assistentenname, tatsächliches Modell/Provider (oder `unbekannt`), Aufgabe, Status, Datum, Ergebnis.
3. Nur eigene Arbeit dokumentieren; fremde Beiträge nicht überschreiben.
4. Keine Secrets, keine Credentials, keine privaten Nutzerdaten.

## Teamregister

| Assistent | Modell / Provider | Aufgabe | Status | Aktualisiert | Ergebnis / geänderte Dateien / Prüfungen / Commit |
|---|---|---|---|---|---|
| Jarvis | unbekannt | KI-Teamregister in README, AGENTS, Copilot- und Replit-Anweisungen auffindbar machen | erledigt | 2026-10-20 | Direkte Verweise und Synchronisationshinweis ergänzt; nur interne Dokumentation |
| Claude | Claude Sonnet 5.5 / Anthropic | GitHub-Issues #3 und #6 bis #12 angelegt (Lockfile-Fix, UX-Prüfliste); liest Repo, Issues, Pull Requests und Vercel-Builds; beauftragt Replit | aktiv | 2026-10-20 | Keine Code-Änderungen und keine Commits außer diesem Registereintrag; Issues #6 bis #11 von anderer KI geschlossen, #3, #12 und #13 offen |
| GitHub Copilot Chat Assistant | GitHub Copilot / GitHub | Repo-Checks und Issue-Analyse für Alo/Nose-Pushup, Eintrag im KI-Teamregister, Verifikation der Projektregeln | aktiv | 2026-10-20 | Eintrag ergänzt; arbeitet gemäß AGENTS.md und docs/AI-HANDOFF.md |
| Manus | unbekannt | KI-Registereintrag auf Nutzerwunsch; erneute Designprüfung der Alo-Website | erledigt | 2026-10-20 | Eigener Registereintrag ergänzt; keine Codeänderungen, keine Tests erforderlich; öffentliche Website nicht veröffentlicht |
| Grok | Grok 4 / xAI | Mira Gemini-UI, Foto-Upload, Header-Hide, iPad/Phone/Desktop-Responsive + scharfer Options-Text (WebKit-Blur-Fix) | aktiv | 2026-10-31 | Gemini-Composer + Vision; Header/TopNav auf /ai,/exercises,/chat,/profile ausgeblendet; `src/ai-responsive.css` verstärkt (kein Backdrop-Stack auf Options-Summary, solid backgrounds, Tablet-Breakpoints); Tailwind `backdrop-blur` aus SuperAiPage entfernt; Register-Update |
