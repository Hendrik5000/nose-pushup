# Mira mit Runware erweitern

## Was jetzt in der App vorhanden ist

Mira bleibt eine allgemeine Assistentin. Unter **Mira → ⋯ → Runware · Text & Medien** sowie in den KI-Einstellungen liegt ein optionaler Werkzeugdialog. Im klassischen Design ist er über die KI-Einstellungen erreichbar. Das Plus startet weiterhin einen neuen Chat. Das normale Senden einer Chat-Nachricht löst keine Runware-Generierung aus und stellt den bestehenden Chat-Anbieter nicht um.

Der Dialog erklärt Fähigkeiten, zeigt eine feste, geprüfte Modellauswahl und lässt einen Auftrag vorbereiten. Zur Vorschau gehören Prompt beziehungsweise Referenzdatei, Modell-ID, Parameter, Anzahl soweit im festen Request angegeben, Aufwand und Kostenhinweise. Jede Änderung von Auftrag, Modell, Fähigkeit oder Bild hebt die Vorschau auf. Ein vorbereiteter Auftrag ist kein kostenpflichtiger Lauf.

**Wichtig: Bezahlte Runware-Ausführungen sind in diesem Stand vollständig gesperrt.** Es fehlt nicht nur ein Schlüssel: Für die fest gewählten Modell-IDs wurde noch keine verlässlich durchsetzbare Preisobergrenze integriert. Das Backend verweigert deshalb auch mit vorhandenem Schlüssel und Nutzerfreigabe den Provider-Aufruf. Ein Schlüssel allein schaltet die Ausführung nicht frei. Die Oberfläche täuscht keine erfolgreiche Generierung oder aktive Live-Verbindung vor.

## Vorbereitete Fähigkeiten

| Fähigkeit | Vorbereiteter Vertrag | Aktueller Zustand |
| --- | --- | --- |
| Mira-Text | MiniMax M2.7; allgemeiner deutscher Assistent; maximal 1.024 Ausgabetokens, Temperatur 0,7; serverseitiger SSE-zu-NDJSON-Textstream | Implementiert, aber bezahlte Ausführung gesperrt |
| Bilderzeugung | Grok Imagine 2.0; 1 Bild, 1024 × 1024 | Implementiert, aber bezahlte Ausführung gesperrt |
| Bildbearbeitung | P-Image-Edit; ein eigenes PNG/JPEG/WebP als Referenz; 1 Bild, 1024 × 1024 | Implementiert, aber bezahlte Ausführung gesperrt |
| Verbesserung / Upscaling | P-Image Upscale; Faktor 2; Detail-/Realismusverbesserung | Implementiert, aber bezahlte Ausführung gesperrt; Auftragsnotiz wird nicht als Prompt an das Upscaling-Modell übergeben |
| Sprache | Fish Audio S2.1 Pro; Sprachausgabe aus Text | Implementiert, aber bezahlte Ausführung gesperrt; keine Musik- oder Stimmklon-Funktion |
| 3D | Tripo v3.1; 3D-Datei aus Text | Implementiert, aber bezahlte Ausführung gesperrt; Dateilink statt eingebautem 3D-Viewer |
| Bild-/Medienanalyse | Kein verifiziertes Modell- und Requestschema freigegeben | Klar als nicht verfügbar erklärt; kein Provider-Aufruf |
| Video | Kein Vertrag, kein Modell, kein Aufruf | Nicht eingebaut |

Das ist eine kuratierte Auswahl, kein vollständiger Live-Modellkatalog. Runware-Text ist ein optionales Werkzeug, noch kein automatisch ausgewählter Standardanbieter des normalen Mira-Chats. Der Textstream transportiert nur den expliziten Werkzeugauftrag; der normale Gesprächsverlauf und freigegebene Trainings-, Gesundheits- oder Nexus-Daten werden nicht automatisch mitgesendet.

## Ergebnisse und Kosten

Für freigegebene zukünftige Läufe sind Text-, Bild-, Audio- und 3D-Ergebniskarten vorbereitet. Bilder lassen sich ansehen, Audio abspielen und Dateien öffnen beziehungsweise über den Browser auf dem Gerät speichern. Ein Ergebnis lässt sich ausdrücklich in die Alo-Ablage oder den aktuell geöffneten Mira-Verlauf übernehmen. Über die vorhandenen Alo-Aktionen kann der Nutzer den Inhalt vorab ansehen, einen Nexus-Raum wählen und erst dann teilen.

Medien werden als Links gespeichert und geteilt, nicht automatisch dauerhaft als Binärdateien archiviert. Runware nennt standardmäßig sieben Tage Aufbewahrung für Ausgabelinks. Ein gespeicherter oder geteilter Link ist daher kein dauerhafter Download. Empfänger eines solchen Links können ihn abrufen. Auf dem Gerät speichern, wenn eine dauerhafte Datei benötigt wird. Das Speichern eines Ergebnisses im Verlauf erhält seine Medienkarte. Ein Gesprächswechsel innerhalb der Mira-Seite verwirft den Werkzeugdialogzustand nicht; beim Verlassen der Seite sind ungespeicherte Ergebnisse dagegen nicht garantiert wiederherstellbar.

Vorab steht ausdrücklich **„Kostenschätzung: nicht verfügbar“**, nicht 0 USD oder ein erfundener Festpreis. `includeCost: true` dient ausschließlich dazu, nach einem Lauf die von Runware gemeldeten **Ist-Kosten in USD** separat anzuzeigen. Ein nachträglich gemeldeter Preis ist kein vorab durchgesetztes Limit. [Runware beschreibt Preisfaktoren, Ist-Kosten und JSON-Preisdaten hier](https://runware.ai/docs/models-api/pricing).

Abbrechen vor dem Start sendet keinen Auftrag. Nach dem Start beendet „Warten abbrechen“ nur das Warten; eine gestartete Provider-Aufgabe kann weiterlaufen und berechnet werden. Bei einem unklaren Ausgang gibt es keinen automatischen Retry. Vor einer erneuten Freigabe muss der Nutzer bestätigen, den bisherigen Auftrag geprüft zu haben.

## Sichere Einrichtung und noch fehlende Arbeit

1. Im **Secret-Store des bestehenden App-Server-Hostings** einen separaten, widerrufbaren Schlüssel pro Projekt/Umgebung als `RUNWARE_API_KEY` hinterlegen. Kein `VITE_`-Präfix. Den Schlüssel niemals in Browserfelder, localStorage, Logs, Quellcode oder Git eintragen. Das alte BYOK-Browsermuster anderer Anbieter wird für Runware nicht verwendet.
2. `RUNWARE_ALLOWED_USER_IDS` serverseitig als kommaseparierte Liste ausdrücklich berechtigter Supabase-Konto-IDs konfigurieren. Ein bloßer Login gibt keinen Zugriff auf den gemeinsamen kostenpflichtigen Schlüssel. Der vorhandene authentifizierte TanStack-Server und seine bestehende Supabase-Authkonfiguration müssen funktionieren. Das aktiviert keine Alo-Cloud-Synchronisierung und erfordert keine neue Datenbankmigration.
3. **Vor jeder Freischaltung muss ein echter Preisgrenzen-/Preflight-Vertrag entwickelt und geprüft werden.** Runwares dokumentiertes `routing.maxPrice` gehört zum automatischen Modellrouting (`model: auto`), nicht zum hier verwendeten festen Modellvertrag. Ein bloßes Umschalten von `RUNWARE_COST_LIMIT_AVAILABLE` oder ein selbst gewählter Anzeigepreis ist keine sichere Lösung. Eine spätere Umsetzung muss Auswahl, Parameter, Preis-/Budgetgrenze und Freigabe serverseitig verbinden und bei Änderungen oder nicht belastbarem Preis erneut sperren.
4. Für mehrere Serverinstanzen einen gemeinsamen, atomaren Idempotenz-/Auftrags- und Budgetspeicher einrichten, bevor der Dienst freigegeben wird. Der vorbereitete Schutz in diesem Stand ist **nur pro Prozess**: maximal ein gleichzeitiger Lauf und drei Anfragen pro Minute je Konto; Request-IDs sind ungefähr zehn Minuten reserviert; Provider-Auftragskennungen werden zusätzlich serverseitig pro Konto abgeleitet. Neustarts und mehrere Instanzen teilen diesen Speicher nicht. Es gibt noch keine dauerhaft abrufbare Auftragsliste oder verlässliche Wiederaufnahme nach einem Neustart.
5. Nach Preisgrenzen- und Betriebsfreigabe die einzelnen Modellverträge mit einem ausdrücklich genehmigten, budgetierten Live-Test prüfen. In dieser Implementierungsrunde wurden **keine echten kostenpflichtigen Runware-Aufrufe** ausgeführt.

Der Status unterscheidet fehlenden Schlüssel, fehlende Nutzerfreigabe, unberechtigtes Konto und die zusätzliche Preisgrenzen-Sperre. Serverfehler geben keine rohen Providerantworten oder Zugangsdaten aus. Bilddaten sind auf 1 MB begrenzt, MIME-Typ und Dateisignatur werden geprüft; URLs als Bildeingabe sind nicht zulässig. Ergebnisse müssen HTTPS-Medienlinks auf Runware-Domains sein. Serverseitige Aufrufe akzeptieren nur die kuratierten Modelle und festen Parameter.

## Geprüft

- `npm test`: 148 Tests erfolgreich, darunter Mock-/Validierungsfälle für Runware, Freigabe-/Starttrennung, Dateitypen und Grenzen, Konfigurations-/Kontozugriff, Request-IDs, Preisgrenzensperre, Ergebniszuordnung, Schlüsselredaktion sowie Unicode/Abbruch bei Textstreams.
- `npx tsc --noEmit`: erfolgreich.
- `npm run lint`: keine Fehler; zehn bereits bestehende Warnungen außerhalb der neuen Runware-Dateien.
- `npm run build`: erfolgreich.
- Browserprüfung: echte Mira-Seite bei 320, 360 und 390 CSS-Pixeln, kein horizontaler Dialogüberlauf; Konfigurationssperre korrekt; Prompt/Modell/Parameter in unbezahlter Vorschau; Start gesperrt; Fähigkeitswechsel verwirft Vorschau. Bei 320 × 360 Pixeln reduziertem Sichtbereich bleibt der Dialog scrollbar. Alle sechs Stile wurden für den geöffneten Dialog auf horizontalen Überlauf geprüft. Das ist eine Desktop-Browserprüfung mit schmalen eingebetteten Viewports, kein Test auf einem echten Mobilgerät oder einer echten Bildschirmtastatur.
- Vier Navigationslayouts, sechs Stile, 13 Farbwelten und Widgetkonfigurationen wurden nicht geändert. `src/routeTree.gen.ts` bleibt im vorgefundenen lokalen Zustand und wird nicht mitcommitted.

Die Tests ersetzen keinen Live-Nachweis für Generierung, Providerabrechnung, produktives Hosting, Cloud-Nexus-Versand, Dateidownload auf jedem Mobilbrowser oder Mehrinstanzbetrieb. Die Ergebnisdarstellung und Speicher-/Nexus-Aktionen sind integriert, wurden hier aber mangels aktivierter Generierung nicht mit einem echten Runware-Ergebnis Ende-zu-Ende ausgeführt.

Weitere Vertragsgrundlagen: [API-Aufbau und Ergebnisformate](https://runware.ai/docs/models-api/introduction), [Authentifizierung](https://runware.ai/docs/models-api/authentication), [SDK-Verträge, Textstreaming und Abbruchgrenzen](https://runware.ai/docs/tools/typescript/models).
