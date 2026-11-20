# Mira Device Control Gateway (Phase 4)

Dedizierter WSS-Dienst fr Mira Device Control, umgesetzt nach
docs/device-control-gateway-spec.md (v1). Kein App-Inhalt, kein Mira-Inhalt.

## Warum ein eigener Dienst?

Stabile Langzeit-WebSocket-Verbindungen zu Gerten passen nicht auf Vercel
Edge. Das Gateway luft als eigener Node-Prozess (empfohlen: kleiner VPS,
z. B. Hetzner CX11) hinter einem TLS-Reverse-Proxy (Caddy/nginx) mit
.domain und Let's Encrypt. Port 443 nach auen, sonst nichts.

## Sicherheitsmodell

- Gerte bauen die Verbindung selbst auf: outbound wss (TLS), Bearer-Token,
  X-Mira-Device. Keine eingehenden Ports am Gert, keine Portfreigaben.
- Kopplung ber Einmalcode (6 Ziffern, TTL 5 Minuten, nur einmal verwendbar).
- Gertetoken wird serverseitig nur als SHA-256-Hash mit Salt gespeichert,
  nie im Klartext, nie in Logs.
- Kontroll-API (fr die Mira-App ab Phase 5) nur mit MIRA_GATEWAY_ADMIN_TOKEN.
- Not-Aus: pausiert das Routing aller Aktionen auf Gateway-Ebene.
- Widerruf: revoke-Nachricht + WebSocket-Close-Code 4403; der Windows-Agent
  (Phase 2) lscht darauf Identit und Token.
- Protokoll (action-log) speichert nur Ereignisarten und Statuswrter,
  keine Argumente, keine Bildschirm-inhalte.

## Start

~~~bash
cd gateway
npm install

# Produktion (hinter TLS-Reverse-Proxy):
MIRA_GATEWAY_ADMIN_TOKEN=< eigenes langes Geheimnis > \
MIRA_GATEWAY_TRUST_PROXY=1 \
MIRA_GATEWAY_PORT=8787 \
npm start

# Entwicklung / lokales Testen ohne TLS:
MIRA_GATEWAY_ADMIN_TOKEN=dev-token \
MIRA_GATEWAY_ALLOW_PLAIN_HTTP=1 \
npm run dev
~~~

Wird kein Admin-Token gesetzt, erzeugt das Gateway einen Zufallstoken und
schreibt ihn einmal beim Start auf stderr.

## Umgebungsvariablen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| MIRA_GATEWAY_PORT | 8787 | HTTP/WSS-Port |
| MIRA_GATEWAY_HOST | 127.0.0.1 | Bind-Adresse (0.0.0.0 nur hinter Proxy) |
| MIRA_GATEWAY_DATA_DIR | ./data | Persistenter Zustand (gateway-state.json) |
| MIRA_GATEWAY_ADMIN_TOKEN | (Zufall) | Token fr /v1/control/* |
| MIRA_GATEWAY_TRUST_PROXY | aus | X-Forwarded-Proto vertrauen (Reverse-Proxy) |
| MIRA_GATEWAY_ALLOW_PLAIN_HTTP | aus | Nur fr lokale Entwicklung |
| MIRA_GATEWAY_PAIR_REMOTE_ALLOWED | aus | Kopplung auch von Nicht-localhost (via TLS) |
| MIRA_GATEWAY_PAIRING_TTL_MS | 300000 | Kopplungscode-TTL |
| MIRA_GATEWAY_HEARTBEAT_TIMEOUT_MS | 90000 | Verbindung ohne Nachricht trennen |
| MIRA_GATEWAY_SCREEN_MAX_FPS | 10 | Frame-Drossel fr Live-Sitzungen |
| MIRA_GATEWAY_ACTION_TIMEOUT_MS | 15000 | Warten auf action.result |

## Endpunkte

- POST /v1/pair: Einmalcode + Gertedaten + ffentlicher Schlssel
  deviceId + deviceToken. Nur ber HTTPS bzw. localhost.
- GET /v1/ws (Upgrade): Gerteverbindung (Bearer + X-Mira-Device),
  Handshake hello/welcome, danach action.request/action.result,
  screen.session/screen.frame, not-aus, revoke (Close 4403).
- /v1/control/*: Kontroll-API fr Mira-App (Admin-Token): devices,
  pairing-code, permissions, action, not-aus, screen, revoke, action-log.
- GET /healthz: Betriebstatus, Not-Aus-Zustand.

## Tests und Typprfung

~~~bash
cd gateway
npm run typecheck
npm test
~~~

Hinweis: In der Entwicklungsumgebung, die diesen Pull Request erstellt hat,
konnten weder Node noch npm ausgefhrt werden. Die Prfungen mssen beim
grnen CI bzw. lokal nachgeholt werden.

## Ableitung

- Spezifikation: docs/device-control-gateway-spec.md
- Envelope kompatibel zu windows-agent/src/MiraDeviceAgent/Messages.cs
- Protokollregister: docs/AI-TEAM-MIRA-GATEWAY-PHASE4.md
