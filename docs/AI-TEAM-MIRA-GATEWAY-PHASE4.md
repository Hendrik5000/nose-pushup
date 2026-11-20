


# Mira Device Control: Phase 4 - Gateway-Server

Nachtrag zu docs/AI-TEAM.md (Register), analog docs/AI-TEAM-MIRA-DEVICES-PHASE1.md.

## Stand (2026-11-20, Draft)

Branch: mira-device-control-phase4-gateway (aufgebaut auf
mira-device-control-phase2-agent, Basis des zugehrigen Draft-PRs).

Inhalt:

- gateway/: eigenstndiger Node-Dienst (wss), gemäß
  docs/device-control-gateway-spec.md: POST /v1/pair (Einmalcode, 6 Ziffern,
  TTL 5 Minuten, nur einmal verwendbar, Fehlversuch-Sperre), GET /v1/ws
  (Bearer + X-Mira-Device), Handshake hello/welcome, Aktionsrouting
  action.request/action.result, Bildschirm-Sitzungen mit Frame-Drossel,
  Not-Aus (Routing-Pause), Widerruf (revoke + Close 4403).
- Kontroll-API /v1/control/* mit Admin-Token (Grundlage für Phase 5,
  Anbindung an die Mira-UI).
- Gerätetoken nur als SHA-256-Hash mit Salt gespeichert; Protokoll speichert
  keine Argumente oder Bildschirminhalte.
- Tests (node:test via tsx): Protokoll, Kopplung, Richtlinien, Speicher,
  Integrationstest für den Serverablauf inkl. Close-Code 4403.

## Wichtig

- Keine Berührung der Supabase-Datenbank, der Migrationen oder RLS.
- Keine Berührung bestehender Mira-Chat-Funktionen, kein Bezug zu PR #227.
- Der Gateway-Code liegt bewusst neben der App; tsconfig/eslint des Repos
  umfassen ihn nicht (eslint-Ignor-Eintrag für das eigenstndige Paket).
- Zustand liegt in gateway/data (git-ignoriert), bewusst außerhalb Supabase.

## Offen / nächste Schritte

- Phase 3 (Windows-Steuerwerkzeuge im Agent) ist weiterhin offen und vor
  Phase 5 zu bauen.
- Anbindung der Kontroll-API an die Mira-UI (Phase 5), inklusive
  Not-Aus-Schalter und Fingerprint-Anzeige in der Geräteliste.
- Live-Betrieb abgeschlossen? Nein: Ausrollen (VPS + TLS-Proxy) ist separat
  und geschieht nicht über diesen Draft-PR.
