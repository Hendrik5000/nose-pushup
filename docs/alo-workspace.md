# Alo: verbundener Arbeitsbereich

Die neue **Alo**-Schaltfläche öffnet die gemeinsame Zentrale auf jeder angemeldeten Seite. `Strg/Cmd + K` öffnet direkt „Überall suchen“. Die vorhandenen Trainingsfunktionen, Swipe-Ziele einschließlich Einstellungen, Navigationslayouts, Stile, Farbwelten und Widgets bleiben bestehen.

## Die zehn nutzbaren Abläufe

1. **Überall suchen:** Suchbegriff eingeben und suchen. Treffer zeigen Training, Mira, Nexus, Einstellungen oder Alo-Ablage als Quelle; Original beziehungsweise zuständigen Alo-Bereich öffnen oder über Alo-Aktionen weiterverwenden. Mira wird für die Suche nicht aufgerufen. Die Oberfläche benennt Abfragegrenzen: 100 Nexus-Treffer, 100 gespeicherte Wochenpläne, 200 Programme. Kein Anhang-OCR.
2. **Schnell speichern:** Titel/Text/Link eingeben, Bereich und optional Sammlung wählen. Foto, PDF, Textdatei oder Audio anhängen; alternativ eine bis zu 60 Sekunden lange Sprachnotiz aufnehmen. Nach „In Schnellablage speichern“ erscheint der Inhalt unter Sammlungen. Mikrofonfreigabe und `MediaRecorder` müssen im Browser verfügbar sein. Audio wird gespeichert, nicht automatisch transkribiert.
3. **Mira-Datenfreigabe:** Vor dem Senden beziehungsweise unter Daten & Datenschutz Training/Gesundheit und einzelne Nexus-Räume getrennt freigeben. Beide beginnen pro Konto und Gerät ausgeschaltet. Jede neue Freigabe verlangt eine Bestätigung. Direktnachrichten werden nicht einbezogen. Mira sendet immer die eingegebene Frage und den aktuellen Mira-Gesprächsverlauf; optionale App-Daten gehen nur bei ausdrücklicher Freigabe mit. Ein Widerruf kann bereits an einen KI-Anbieter übermittelte Inhalte nicht zurückholen.
4. **Alo-Aktionen:** An einer Mira-Antwort, Nexus-Nachricht oder einem Trainingsprogramm die Inhaltsvorschau öffnen. „Als Trainingsnotiz speichern“, „In Sammlung ablegen“ oder Empfänger wählen und „In Nexus teilen“ nutzen. Teilen sendet Titel und Text, keine angehängten Dateien. Es werden keine Trainingseinheiten als absolviert markiert. Notizen sind auf 500 Zeichen begrenzt; die Oberfläche weist bei Kürzung darauf hin.
5. **Tagesübersicht:** Persönliche Aufgaben und optionale Fälligkeit anlegen, abhaken und einzeln löschen. Fällige Erinnerungen und favorisierte Nexus-Räume mit letzter Nachricht/ungelesenen Einträgen werden angezeigt. Zeiten folgen der Gerätezeitzone. Erinnerungen sind Hinweise innerhalb der geöffneten App, keine zugesicherten Push-Nachrichten bei geschlossener App.
6. **Sammlungen:** Eine persönliche, bereichsübergreifende Sammlung anlegen und gespeicherte Kopien einschließlich kleiner Dateien zuordnen. „Gemeinsam“ bedeutet hier eine gemeinsame Ablage für die drei Produktbereiche, nicht automatisch eine Freigabe an andere Personen. Ein Original zu löschen entfernt gespeicherte Kopien nicht. Eine Sammlung zu entfernen lässt ihre Ablagekopien unter „Alle Ablagen“ bestehen.
7. **Raumfunktionen:** In einem Nexus-Raum angepinnte Infos, Dateien, Umfragen mit 2–10 Antworten und Termine anlegen. Vor dem Speichern wird Empfänger/Sichtbarkeit bestätigt. Pro Konto gibt es eine änderbare Stimme pro Umfrage. Eigene Rauminhalte können gelöscht werden. Termine lassen sich ausdrücklich in die persönliche Tagesübersicht übernehmen. „Aktualisieren“ lädt neue Rauminhalte und Stimmen. Bis zu 100 neueste Rauminhalte werden angezeigt.
8. **Auf allen Geräten:** Nach Einrichtung der Datenbankmigration in Daten & Datenschutz einschalten. Derselbe reguläre Login ist auf allen Geräten erforderlich. Alo-Ablage, Aufgaben, Sammlungen, Schnellaktionen, Trainingsnotizen, Mira-Verläufe und Entwürfe werden kontogebunden abgeglichen. Nexus-Cloudnachrichten verwenden weiterhin das bestehende Chat-Backend. Lokale Nexus-Testchats werden nicht automatisch in die Cloud übertragen. Geräte ohne Netz behalten ausstehende Änderungen; konkurrierende Versionen müssen ausdrücklich ausgewählt werden.
9. **Daten & Datenschutz:** Aktuelle Freigaben, lokale/Cloudspeicherung, offene Änderungen und Konflikte ansehen; lokale Alo-Daten exportieren; nur die lokale Kopie, Mira-Verläufe oder den Alo-Arbeitsbereich lokal und in der Cloud kontrolliert löschen. Die jeweilige Bestätigung benennt die genaue Reichweite. Alte, bisher kontolose Mira-Chats und Notizen werden nicht stillschweigend übernommen; Import oder Löschung dieser Sicherung ist separat möglich.
10. **Schnellaktionen:** Persönliche Namen für häufige Abläufe anlegen: Tagesübersicht, Ablage, Suche, Sammlungen, Trainingsplan oder eine vorbereitete Mira-Frage. Ein Mira-Shortcut erzeugt nur einen Entwurf, niemals eine automatische Sendung.

## Speicherung und Sicherheit

Lokale Alo-Daten liegen im Browserspeicher unter einem kontospezifischen Schlüssel. Sie sind dort nicht verschlüsselt. Bei eingeschalteter Cloud-Synchronisierung schützt Supabase die persönlichen Datensätze durch Row Level Security. Transport und Kontoautorisierung sind kein Ende-zu-Ende-Verschlüsselungssystem. API-Schlüssel, Auth-Token, Providerkonfiguration und Mira-Freigaben werden nicht über Alo synchronisiert. Schutz des angemeldeten Geräts und des Kontos bleibt erforderlich. Anonyme Gastkonten eignen sich nicht als verlässlicher geräteübergreifender Login.

Die Synchronisierung arbeitet mit serverseitigen Revisionen und Compare-and-swap statt stiller „letzte Änderung gewinnt“-Überschreibung. Löschungen entfernen Datensatzinhalte und behalten inhaltsfreie Tombstones, damit alte Geräte gelöschte Cloudversionen nicht unbemerkt wiederherstellen. Abweichende Offlineversionen bleiben als Konflikt sichtbar. Wer bewusst „Lokale Version behalten“ wählt, kann eine lokale Kopie wieder in die Cloud übertragen. Unbekannte, bisher niemals synchronisierte Offlineinhalte anderer Geräte und Datenbankbackups sind keine garantierte Fernlöschung.

Nexus verwendet bestehende Räume, die für alle angemeldeten Nutzer sichtbar sind. Raumwerkzeuge schaffen **keine privaten Mitglieder-Räume**. Kleine Dateien sind im zugriffsgeschützten Raumdatensatz eingebettet; es entstehen keine öffentlich zugänglichen Storage-URLs. Erlaubt sind PNG/JPEG/WebP/GIF, unterstütztes Audio, PDF und Klartext; aktive HTML-/SVG-Dokumente werden abgewiesen. Maximal 1 MB pro Datei, insgesamt gilt das Browserspeicherlimit. Für größere Dateien Links verwenden.

Die Alo-Löschung ist nicht gleich Kontolöschung: ursprüngliche Trainings-/Gesundheitsdaten, bestehende Nexus-Nachrichten, Raumwerkzeuge, Inhalte bei KI-Anbietern und Datenbankbackups sind ausdrücklich nicht Teil des Alo-Workspace-Wipes. Raumwerkzeuge und Nexus-Nachrichten haben eigene Löschaktionen; extern gespeicherte Kopien lassen sich nicht zurückrufen.

## Erforderlich für die Cloudfreischaltung

Das Repository konfiguriert Alo für Supabase-Projekt **`dbnlybjlswuvxrccgqah`**. Der in dieser Entwicklungsumgebung verfügbare Supabase-Zugang konnte nur ein anderes, inaktives Projekt auflisten. Deshalb wurde **keine produktive Migration ausgeführt** und kein anderes Projekt verändert.

Ein Administrator des tatsächlichen Alo-Projekts muss die ausstehenden Repository-Migrationen geordnet ausführen. Die neue Migration ist:

`supabase/migrations/20261019210000_alo_workspace.sql`

Sie setzt die Nexus-Tabellen und `is_conversation_member` aus `20261019010000_nexus_chat_schema.sql` voraus. Existiert das Nexus-Schema noch nicht, muss zuerst dessen Migration ausgeführt werden. Bereits angewandte Migrationen nicht blind erneut abspielen; vorhandenen Migrationsstatus prüfen. Die neue Migration richtet persönliche Datensätze, atomare Sync-/Löschfunktionen, Raumwerkzeuge und Stimmen mit Zugriffsregeln ein und härtet die alte Nachrichtensuchfunktion gegen RLS-Umgehung und anonyme Aufrufe.

Anschließend mit zwei regulären Testkonten und zwei Geräten testen: fremde persönliche Inhalte bleiben verborgen, Entwürfe und Mira-Verläufe werden korrekt geladen, gleichzeitige Änderungen führen zu einem Konflikt, Cloud-Löschungen erscheinen auf dem zweiten Gerät. Raumstimmen und Dateiabruf als berechtigter beziehungsweise nicht angemeldeter Nutzer prüfen. Lokales Kopieren oder ein bestandener Schema-Test ersetzt diesen Live-Test nicht.

Bis dahin bleiben private lokale Alo-Funktionen nutzbar. Fehlende Cloudtabellen werden als Fehlerzustand angezeigt, nicht als erfolgreiche Synchronisierung. Bestehendes Nexus kann je nach vorhandenem Backend weiter lokal laufen; der sichtbare Speicherzustand unterscheidet dies klar.

## Tests und Veröffentlichung

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`tests/alo-workspace.test.ts` prüft unter anderem Kontoisolation, standardmäßig ausgeschaltete Freigaben, Tombstones, Konfliktauswahl, Speicherfehler, sichere Anhänge, Suchlogik und Schemaschutz. Der bestehende Navigationstest wurde auf die neue granulare Freigabekomponente angepasst.

Zusätzlich wurde die neue Migration in einer isolierten PostgreSQL-Testdatenbank ausgeführt und für RLS, CAS, Löschung, Raumstimmen und Nachrichtensuche geprüft. Das ist kein Nachweis einer bereits eingerichteten produktiven Supabase-Datenbank.

Ein GitHub-Push veröffentlicht die Lovable-App nicht automatisch. Nach erfolgreicher Datenbankeinrichtung in Lovable ausdrücklich **„Publish changes“** verwenden.
