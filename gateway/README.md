


# Mira Device Control Gateway (Phase 4)

Dedizierter WSS-Dienst für Mira Device Control, umgesetzt nach
docs/device-control-gateway-spec.md (v1). Kein App-Inhalt, kein Mira-Inhalt.

## Warum ein eigener Dienst?

Stabile Langzeit-WebSocket-Verbindungen zu Geräten passen nicht auf Vercel
Edge. Das Gateway läuft als eigener Node-Prozess (empfohlen: kleiner VPS,
z. B. Hetzner CX11 oder ähnlich) hinter einem TLS-Reverse-Proxy
(Caddy/nginx) mit eigener Domain und Let's Encrypt. Nur Port 443 nach
außen, sonst nichts.

## Sicherheitsmodell

- Geräte bauen die Verbindung selbst auf: outbound WSS (TLS), Bearer-Token
  und X-Mira-Device. Kein eingehender Port am Gerät, keine Portfreigaben.
- Kopplung über Einmalcode (6 Ziffern, TTL 5 Minuten, genau einmal verwendbar).
- Gerätetoken wird serverseitig nur als SHA-256-Hash mit Salt gespeichert,
  nie im Klartext, nie in Logs.
- Kontroll-API (Grundlage für die Mira-App ab Phase 5) nur mit
  MIRA_GATEWAY_ADMIN_TOKEN.
- Not-Aus: pausiert das Routing aller Aktionen auf Gateway-Ebene.
- Widerruf: revoke-Nachricht plus WebSocket-Close-Code 4403; der
  Windows-Agent (Phase 2) löscht daraufhin Identität und Token.
- Protokoll (action-log) speichert nur Ereignisarten und Statuswörter,
  keine Argumente und keine Bildschirminhalte.
- Kopplungscodes sind Brute-Force-geschützt: Fehlversuche pro Herkunft
  werden gezählt, ab Schwelle folgt eine Sperre.

## Start

~~~bash
cd gateway
npm install

# Produktion (hinter TLS-Reverse-Proxy):
MIRA_GATEWAY_ADMIN_TOKEN=<eigenes langes Geheimnis> \
MIRA_GATEWAY_TRUST_PROXY=1 \
MIRA_GATEWAY_PORT=8787 \
npm start

# Entwicklung / lokales Testen ohne TLS:
MIRA_GATEWAY_ADMIN_TOKEN=dev-token \
MIRA_GATEWAY_ALLOW_PLAIN_HTTP=1 \
npm run dev
~~~

Wird kein Admin-Token gesetzt, erzeugt das Gateway einen Zufallstoken und
schreibt ihn einmalig beim Start auf stderr.

## Umgebungsvariablen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| MIRA_GATEWAY_PORT | 8787 | HTTP/WSS-Port |
| MIRA_GATEWAY_HOST | 127.0.0.1 | Bind-Adresse (0.0.0.0 nur hinter Proxy) |
| MIRA_GATEWAY_DATA_DIR | ./data | Persistenter Zustand (gateway-state.json) |
| MIRA_GATEWAY_ADMIN_TOKEN | (Zufall) | Token für /v1/control/* |
| MIRA_GATEWAY_TRUST_PROXY | aus | X-Forwarded-Proto vertrauen (hinter Proxy) |
| MIRA_GATEWAY_ALLOW_PLAIN_HTTP | aus | Nur für lokale Entwicklung |
| MIRA_GATEWAY_PAIR_REMOTE_ALLOWED | aus | Kopplung auch von Nicht-localhost (via TLS) |
| MIRA_GATEWAY_PAIRING_TTL_MS | 300000 | TTL für Kopplungscodes |
| MIRA_GATEWAY_HEARTBEAT_TIMEOUT_MS | 90000 | Verbindung ohne Nachricht trennen |
| MIRA_GATEWAY_SCREEN_MAX_FPS | 10 | Frame-Drossel für Live-Sitzungen |
| MIRA_GATEWAY_ACTION_TIMEOUT_MS | 15000 | Warten auf action.result |

## Endpunkte

- POST /v1/pair: Einmalcode plus Gerätedaten und öffentlicher Schlüssel
  ergibt deviceId und deviceToken. Nur über HTTPS bzw. localhost.
- GET /v1/ws (Upgrade): Geräteverbindung (Bearer und X-Mira-Device),
  Handshake hello/welcome, danach action.request/action.result,
  screen.session/screen.frame, not-aus und revoke (Close 4403).
- /v1/control/*: Kontroll-API für die Mira-App (Admin-Token): devices,
  pairing-code, permissions, action, not-aus, screen, revoke, action-log.
- GET /healthz: Betriebsstatus und Not-Aus-Zustand.

## Tests und Typprüfung

~~~bash
cd gateway
npm run typecheck
npm test
~~~

Hinweis: In der Umgebung, die diesen Pull Request erstellt hat, konnten
weder Node noch npm ausgeführt werden. Typprüfung und Tests sind beim
grünen CI bzw. lokal nachzuholen.

## Referenzen

- Spezifikation: docs/device-control-gateway-spec.md
- Envelope kompatibel zu windows-agent/src/MiraDeviceAgent/Messages.cs
- Protokollregister: docs/AI-TEAM-MIRA-GATEWAY-PHASE4.md
