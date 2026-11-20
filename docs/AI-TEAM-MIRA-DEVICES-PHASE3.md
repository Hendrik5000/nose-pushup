# Mira Device Control – Phase 3 (Windows-Steuerungswerkzeuge)

Stand: 2026-11-20. Umsetzung auf Branch `gpt6/mira-device-control-phase3-7-20261120`.

## Umgesetzt in diesem Arbeitsstand
- Allowlist statt beliebiger Shell-/PowerShell-Ausführung.
- Prozessliste, Start ausgewählter Apps und sanftes Schließen per Hauptfenster.
- Fensterliste, Fokussieren, Minimieren und Maximieren.
- Maus- und Tastatureingaben über Windows-API mit validierten Eingaben.
- Benutzerdateien in Desktop/Dokumente/Downloads auflisten, kleine UTF-8-Textdateien lesen und neue Dateien erstellen; umbenennen/verschieben ohne Überschreiben.
- Freigegebene Windows-Einstellungsseiten öffnen, geplantes Herunterfahren mit kritischer Bestätigung (60 Sekunden Verzögerung) und Abbruch.
- Lautstärke-Tasten und Stummschaltung.
- Live-Bildschirm nur nach Gateway-Sitzungsstart; sichtbarer Konsolenhinweis, 1 FPS, JPEG verkleinert, Frames nicht lokal gespeichert.
- Gateway übermittelt Bestätigungsstatus an den Agent; zusätzliche Policy-Einträge für Datei-Umbenennen/Verschieben und Shutdown-Abbruch.
- Windows- und Gateway-CI-Workflow für Build/Tests.

## Sicherheitsgrenzen
- Keine Shell-/PowerShell-/CMD-Freiformausführung.
- Kein unbeschränktes Admin-Recht; der Agent läuft mit den Rechten des angemeldeten Windows-Benutzers.
- Dateizugriff nur auf Desktop, Dokumente und Downloads; keine absoluten Pfade, Reparse-Points, Überschreiben oder Löschen.
- Kritisches Herunterfahren erfordert Gateway-Bestätigung und hat 60 Sekunden Verzögerung.
- Bildschirmframes nur in aktiver freigegebener Sitzung, keine Speicherung im Agent.

## Noch nicht abgenommen
- Kein Build/Test in dieser Arbeitsumgebung (kein .NET SDK / Windows Desktop).
- Kein Test auf Hendriks echtem Windows-11-PC, kein tatsächlicher Gateway-Betrieb und keine Kopplung.
- Die Gateway-Dateien sind auf einem gestapelten Branch erstellt worden; dieser PR führt sie erstmals in `main` über.
