# AI-TEAM Zusatzregister — Mira Device Control (Phase 2, Windows-Agent)

Interne Dokumentation, kein App-Inhalt und kein Mira-Inhalt. Gleicher Modus wie
`docs/AI-TEAM-MIRA-DEVICES-PHASE1.md`: das kanonische Register `docs/AI-TEAM.md`
(~329 KB) konnte aus der Umgebungsbeschränkung heraus nicht sicher angehängt
werden; der Eintrag sollte beim Merge übertragen werden.

## Eintrag

- Assistent: Vibe
- Modell/Provider: GLM 5.3 Flash, auf Mistral-AI-Infrastruktur (Plattformangabe, nicht unabhängig verifizierbar)
- Aufgabe: Mira Device Control Phase 2 – Windows-Agent, sichere Geräteidentität, Kopplung, ausgehende authentifizierte Verbindung, Reconnect/Offline/Widerruf, optionaler Autostart
- Status: Als Pull Request implementiert; **nicht kompiliert, nicht auf einem echten Gerät geprüft**; nicht gemerged, nicht live
- Datum: 2026-11-20
- Vom Nutzer bestätigte Entscheidungen: Internet-Erreichbarkeit von unterwegs, Autostart (abschaltbar), Live-Bildschirmübertragung, Transport/Auth wie in `docs/device-control-gateway-spec.md`

## Geänderte Dateien

- `docs/device-control-gateway-spec.md` (neu): verbindliche Protokoll-/Sicherheitsspezifikation v1
- `windows-agent/README.md` (neu)
- `windows-agent/src/MiraDeviceAgent/MiraDeviceAgent.csproj` (neu, net8.0-windows)
- `windows-agent/src/MiraDeviceAgent/Program.cs` (neu)
- `windows-agent/src/MiraDeviceAgent/Messages.cs`, `DeviceIdentity.cs`, `GatewayConnection.cs`, `PairingClient.cs`, `AutostartManager.cs`, `ActionExecutor.cs` (neu)
- `windows-agent/test/MiraDeviceAgent.Tests/` (neu, xunit)

## Prüfungen

- `dotnet build`, `dotnet test`: **nicht ausgeführt** (keine .NET-SDK in der Umgebung).
- Keine echten Geräte-Tests (Kopplung, Widerruf, Reconnect) – Abnahmeoffenpunkt.

## Ehrliche Grenzen

- Gateway-Serverseite ist nicht Teil dieses PRs; Kopplung bleibt ohne Gateway funktionslos.
- Live-Bildschirmübertragung ist im Protokoll definiert, im Agent noch nicht implementiert (Phase 3).
- Kein Tray-/Hintergrundmodus; Menü-Autostart setzt den HKCU-Eintrag für zukünftigen Hintergrundbetrieb.
- Keine Datenbank-, Migrations- oder RLS-Änderungen (Verbindliche Reihenfolge).
