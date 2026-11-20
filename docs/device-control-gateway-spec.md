# Device Control Gateway-Spezifikation (v1, Entwurf)

Interne Dokumentation fr Alo / Mira Device Control. Kein App-Inhalt, kein Mira-Inhalt.
Grundlage: Notion „Mira Device Control - Gertesteuerung fr Windows, Android & iPad" sowie
die vom Nutzer am 2026-11-20 besttigten Entscheidungen.

## Besttigte Entscheidungen (2026-11-20)

| Punkt | Entscheidung |
| --- | --- |
| Erreichbarkeit | Lokales WLAN **und** von unterwegs ber das Internet |
| Autostart | Ja, aber vom Nutzer jederzeit abschaltbar (Phase-2-Agent) |
| Bildschirm | Live-Bildschirmbertragung (zustzlich zu Screenshots) |
| Transport/Auth | Herausgegebener Gertetoken + Gerteidentitt ber ausgehendes WSS/TLS; kein offener eingehender Port |

## Grundprinzipien

1. Alle Verbindungen werden **vom Gert ausgehend** aufgebaut (outbound WSS ber TLS, Port 443). Das Gateway ffnet niemals einen Port am Gert und nutzt keine Router-Portfreigaben.
2. Jedes Gert besitzt eine **eigene Identitt**: RSA-2048-Schlsselpaar, erzeugt auf dem Gert. Der private Schlssel verlsst das Gert nie und wird mit Windows-DPAPI verschlselt gespeichert.
3. Kopplung: In der Mira-UI wird ein **Einmal-Kopplungscode** (6 Ziffern, TTL 5 Minuten) erzeugt. Der Agent sendet ihn zusammen mit Namen, Plattform und ffentlichem Schlssel an POST {gateway}/v1/pair und erhlt deviceId + deviceToken.
4. Der **Gertetoken** ist langlebig, serverseitig widerrufbar und wird nur DPAPI-verschlsselt gespeichert, niemals im Klartext, niemals in Logs.
5. **Widerruf**: WebSocket-Close-Code 4403 fhrt dazu, dass der Agent Identitt und Token lscht und stoppt.
6. **Berechtigungen**: Das Gateway spiegelt die pro Gert und Funktionsgruppe gesetzten Stufen (keine - lesen - steuern - kritisch). Aktionen steuern laufen nur bei Freigabe, kritisch nur nach Besttigung in der Mira-UI.
7. **Live-Bildschirm**: Frames nur in einer ausdrcklich vom Nutzer gestarteten Sitzung; sichtbarer Hinweis am Gert; jederzeit beendbar (Not-Aus beendet sie ebenfalls).
8. **Not-Aus**: Pausiert auf Gateway-Seite alle Routings; der Agent trennt bei not-aus die Verbindung.

## Nachrichtenformat (Envelope, JSON ber WSS)

| Type | Richtung | Payload (Kurzfassung) |
| --- | --- | --- |
| hello | Gert - Gateway | deviceId, Plattform, Agent-Version, Schlssel-Fingerprint |
| welcome | Gateway - Gert | erlaubte Aktionstypen (Allowlist-Spiegel), Richtlinien |
| heartbeat | beide | Zeitstempel |
| action.request | Gateway - Gert | requestId, toolId, valide Argumente |
| action.result | Gert - Gateway | requestId, Status ok / error / bestaetigung-erforderlich / nicht-implementiert, minimierter Detailtext |
| screen.session.start / stop | Gateway <=> Gert | sessionId, nur nach aktiver Nutzerfreigabe |
| screen.frame | Gert - Gateway | sessionId, JPEG-Frame (Basis64, gedrosselt) |
| not-aus | Gateway - Gert | Grund |
| revoke | Gateway - Gert | Grund; Agent lscht Identitt und Token |

## Agent-Verhalten

- Verbindungsaufbau mit Authorization: Bearer <deviceToken> und X-Mira-Device: <deviceId>.
- Reconnect mit exponentiellem Backoff (1 s, 2 s, 4 s ... max 60 s); Zustand offline sichtbar in der Mira-UI.
- Jede action.request wird gegen die lokale **Allowlist** geprft; Unbekanntes wird abgelehnt und protokolliert.
- Niemals beliebige KI-generierte Shell-/PowerShell-Befehle, niemals Administratorrechte fr Freiformbefehle.
- Keine Passwrter oder Secrets in Klartext-Dateien, Logs oder Fehlerberichten.

## Endpunkte (Gateway, Phase 4)

- POST /v1/pair: Einmalcode - deviceId + deviceToken (HTTPS)
- GET /v1/ws (WebSocket-Upgrades): authentifizierte Gertekommunikation

Umsetzung (Draft-PR, Branch mira-device-control-phase4-gateway): dedizierter
Node-Dienst unter gateway/, Kontroll-API /v1/control/* mit Admin-Token,
Token-Hashing serverseitig, Fehlversuch-Sperre fr Kopplungscodes, Frame-Drossel,
minimiertes Aktionsprotokoll (ohne Argumente und Bildschirminhalte).

## Offene Punkte

- Live-Betrieb des Gateways einrichten (dedizierter Dienst auf eigenem Host mit
  TLS-Reverse-Proxy; Vercel-Edge eignet sich nicht fr stabile WSS-Langverbindungen).
- Anbindung der Kontroll-API an die Mira-UI (Phase 5), inkl. Not-Aus-Schalter.
- ffentlicher Schlssel-Fingerprint zur Verifikation in der Mira-UI.
- Live-Abnahmetest mit echtem Windows-11-Gert (Phase 2/3).
