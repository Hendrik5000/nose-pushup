

# Device Control Gateway-Spezifikation (v1, Entwurf)

Interne Dokumentation für Alo / Mira Device Control. Kein App-Inhalt, kein Mira-Inhalt.
Grundlage: Notion „Mira Device Control - Gerätesteuerung für Windows, Android & iPad" sowie
die vom Nutzer am 2026-11-20 bestätigten Entscheidungen.

## Bestätigte Entscheidungen (2026-11-20)

| Punkt | Entscheidung |
| --- | --- |
| Erreichbarkeit | Lokales WLAN **und** von unterwegs über das Internet |
| Autostart | Ja, aber vom Nutzer jederzeit abschaltbar (Phase-2-Agent) |
| Bildschirm | Live-Bildschirmbertragung (zusätzlich zu Screenshots) |
| Transport/Auth | Herausgegebener Gerätetoken + Geräteidentitt über ausgehendes WSS/TLS; kein offener eingehender Port |

## Grundprinzipien

1. Alle Verbindungen werden **vom Gerät ausgehend** aufgebaut (outbound WSS über TLS, Port 443). Das Gateway ffönet niemals einen Port am Gerät und nutzt keine Router-Portfreigaben.
2. Jedes Gerät besitzt eine **eigene Identität**: RSA-2048-Schlüsselpaar, erzeugt auf dem Gerät. Der private Schlüssel verlässt das Gerät nie und wird mit Windows-DPAPI verschlselt gespeichert.
3. Kopplung: In der Mira-UI wird ein **Einmal-Kopplungscode** (6 Ziffern, TTL 5 Minuten) erzeugt. Der Agent sendet ihn zusammen mit Namen, Plattform und öffentlichem Schlüssel an POST {gateway}/v1/pair und erhält deviceId + deviceToken.
4. Der **Gerätetoken** ist langlebig, serverseitig widerrufbar und wird nur DPAPI-verschlüsselt gespeichert, niemals im Klartext, niemals in Logs.
5. **Widerruf**: WebSocket-Close-Code 4403 fhürt dazu, dass der Agent Identität und Token löscht und stoppt.
6. **Berechtigungen**: Das Gateway spiegelt die pro Gerät und Funktionsgruppe gesetzten Stufen (keine - lesen - steuern - kritisch). Aktionen steuern laufen nur bei Freigabe, kritisch nur nach Bestätigung in der Mira-UI.
7. **Live-Bildschirm**: Frames nur in einer ausdrücklich vom Nutzer gestarteten Sitzung; sichtbarer Hinweis am Gerät; jederzeit beendbar (Not-Aus beendet sie ebenfalls).
8. **Not-Aus**: Pausiert auf Gateway-Seite alle Routings; der Agent trennt bei not-aus die Verbindung.

## Nachrichtenformat (Envelope, JSON über WSS)

| Type | Richtung | Payload (Kurzfassung) |
| --- | --- | --- |
| hello | Gerät - Gateway | deviceId, Plattform, Agent-Version, Schlüssel-Fingerprint |
| welcome | Gateway - Gerät | erlaubte Aktionstypen (Allowlist-Spiegel), Richtlinien |
| heartbeat | beide | Zeitstempel |
| action.request | Gateway - Gerät | requestId, toolId, valide Argumente |
| action.result | Gerät - Gateway | requestId, Status ok / error / bestaetigung-erforderlich / nicht-implementiert, minimierter Detailtext |
| screen.session.start / stop | Gateway <=> Gerät | sessionId, nur nach aktiver Nutzerfreigabe |
| screen.frame | Gerät - Gateway | sessionId, JPEG-Frame (Basis64, gedrosselt) |
| not-aus | Gateway - Gerät | Grund |
| revoke | Gateway - Gerät | Grund; Agent löscht Identität und Token |

## Agent-Verhalten

- Verbindungsaufbau mit Authorization: Bearer <deviceToken> und X-Mira-Device: <deviceId>.
- Reconnect mit exponentiellem Backoff (1 s, 2 s, 4 s ... max 60 s); Zustand offline sichtbar in der Mira-UI.
- Jede action.request wird gegen die lokale **Allowlist** geprüft; Unbekanntes wird abgelehnt und protokolliert.
- Niemals beliebige KI-generierte Shell-/PowerShell-Befehle, niemals Administratorrechte für Freiformbefehle.
- Keine Passwörter oder Secrets in Klartext-Dateien, Logs oder Fehlerberichten.

## Endpunkte (Gateway, Phase 4)

- POST /v1/pair: Einmalcode - deviceId + deviceToken (HTTPS)
- GET /v1/ws (WebSocket-Upgrades): authentifizierte Gerätekommunikation

Umsetzung (Draft-PR, Branch mira-device-control-phase4-gateway): dedizierter
Node-Dienst unter gateway/, Kontroll-API /v1/control/* mit Admin-Token,
Token-Hashing serverseitig, Fehlversuch-Sperre für Kopplungscodes, Frame-Drossel,
minimiertes Aktionsprotokoll (ohne Argumente und Bildschirminhalte).

## Offene Punkte

- Live-Betrieb des Gateways einrichten (dedizierter Dienst auf eigenem Host mit
  TLS-Reverse-Proxy; Vercel-Edge eignet sich nicht für stabile WSS-Langverbindungen).
- Anbindung der Kontroll-API an die Mira-UI (Phase 5), inkl. Not-Aus-Schalter.
- öffentlicher Schlüssel-Fingerprint zur Verifikation in der Mira-UI.
- Live-Abnahmetest mit echtem Windows-11-Gerät (Phase 2/3).
