# Mira Device Agent (Windows 11)

Eigenständige C#/.NET-Anwendung aus Phase 2 des Auftrags „Mira Device Control“:
sichere Geräteidentität, Kopplung, ausgehende authentifizierte Verbindung zum
Gateway, Wiederverbindung, Offline-Zustand, Widerruf und nutzerkontrollierbarer
Autostart.

## Status

- **Implementiert, aber nicht kompiliert und nicht auf einem echten Gerät geprüft**
  (Entwicklungsumgebung ohne .NET-SDK). Vor der ersten Nutzung `dotnet build`
  und `dotnet test` ausführen.
- Ziel: `.NET 8 LTS` (`net8.0-windows`). Laut Projektregeln ist die konkrete
  .NET-Version vor dem Live-Einsatz mit Hendriks Windows-Umgebung abzugleichen;
  ein Wechsel auf eine neuere LTS-Version erfordert nur die Anpassung der
  `TargetFramework`-Zeilen.

## Bauen und starten

```powershell
cd windows-agent
dotnet build
dotnet run --project src/MiraDeviceAgent
```

Interaktives Menü:

1. Status anzeigen (Identität, Autostart)
2. Kopplung starten (Gateway-URL + Einmalcode aus der Mira-UI)
3. Autostart ein-/ausschalten (HKCU-Registrierungseintrag, jederzeit reversibel)
4. Identität widerrufen (löscht Identität und Token lokal)
5. Beenden

Nach erfolgreicher Kopplung bleibt der Agent verbunden; die Wiederverbindung
mit exponentiellem Backoff läuft automatisch. Strg+C beendet sauber. Ein
Hintergrund-/Tray-Modus für den dauerhaften Betrieb ist Phase 3 vorbehalten
und hier noch nicht enthalten.

## Sicherheit

- Ausgehende `wss://`-Verbindung, kein eingehender Port, keine Router-Freigabe.
- RSA-2048-Geräteidentität; privater Schlüssel mit DPAPI verschlüsselt unter
  `%LOCALAPPDATA%\MiraDeviceAgent\identity.json`, niemals im Klartext.
- Gerätetoken nur verschlüsselt gespeichert (`token.bin`), niemals in Logs.
- Keine Shell-/PowerShell-Ausführung; Aktionen nur über Allowlist (Phase 3, dort leer).
- Protokolle enthalten nur minimale Verbindungsdaten, keine Inhaltsdaten.

## Tests

```powershell
dotnet test test/MiraDeviceAgent.Tests
```

Protokolltests (Envelope-Serialisierung, Kopplungsanfrage, Allowlist) laufen
ohne echte Verbindung. Gerätetests (echte Kopplung, Widerruf, Live-Bildschirm)
sind Teil der Abnahme und hier noch nicht vorhanden.
