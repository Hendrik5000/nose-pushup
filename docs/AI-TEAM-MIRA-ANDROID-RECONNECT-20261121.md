# Mira Device Control – Android-Reconnect-Schutz

## Eintrag

- Assistent: GPT-6 (OpenAI)
- Aufgabe: Android-Agent Phase 6 – veraltete WebSocket-Callbacks und doppelte Verbindungsstarts absichern.
- Datum: 2026-11-21.
- Status: Implementierung auf neuem Branch vorbereitet; CI und Review stehen aus.
- Geplante Dateien:
  - `android-device-agent/app/src/main/java/app/alo/miraagent/ConnectionGeneration.kt`
  - `android-device-agent/app/src/main/java/app/alo/miraagent/MiraGatewayService.kt`
  - `android-device-agent/app/src/test/java/app/alo/miraagent/ConnectionGenerationTest.kt`
  - `android-device-agent/README.md`
  - `docs/AI-ROADMAP.md`
- Grenzen: Keine Android-Steuerungsaktionen, Bildschirmaufnahme, Datenbank-/Supabase-/SQL-/Migrations-/RLS-Änderungen oder Live-Veröffentlichung.
- Prüfungen: Noch nicht ausgeführt; GitHub Actions wird nach Commit geprüft.
