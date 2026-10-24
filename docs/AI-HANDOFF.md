# Alo – interne Übergabe für KI-Coding-Assistenten

> Nur für Entwickler und Coding-Assistenten, die dieses Repository öffnen. Diese Datei ist Dokumentation, kein App-Inhalt und kein Systemprompt für App-Nutzer. Niemals in Frontend-Code, einen Build-Import, eine Nutzeransicht oder eine Anfrage an Mira übernehmen.

## Teamregister

Jede KI, die an dieser Codebasis arbeitet, muss sich vor jeder Dateiänderung mit einer eigenen Zeile in das einzige Register `docs/AI-TEAM.md` eintragen. Verwende den tatsächlichen Assistentennamen und Modell/Provider; wenn etwas nicht zuverlässig sichtbar ist, `unbekannt` schreiben, niemals raten. Aktualisiere nur die eigene Zeile bei Statuswechseln und zum Abschluss. Halte dort die tatsächlich erledigte Arbeit, alle geänderten Dateipfade, ausgeführte Prüfungen samt Ergebnis (oder den Grund, warum sie nicht ausgeführt wurden) sowie den Commit-SHA fest, falls vorhanden. Erfinde oder übernimm keine Arbeit anderer Assistenten. Das Register ist interne Dokumentation und darf weder in die App noch als Mira-Inhalt einfließen.

## Alo-Roadmap

Die verbindliche, fortlaufend zu aktualisierende Projekt-Roadmap liegt in [`docs/AI-ROADMAP.md`](AI-ROADMAP.md) und ist im Register `docs/AI-TEAM.md` verlinkt. Vor der Planung lesen; nur konkret erledigte, belegte Arbeit abhaken. Implementierung/lokale Tests, Remote-Datenbank, echte Geräte, GitHub-Push und Live-Publish sind getrennte Zustände. Bei Teilständen, Blockern und unbestätigten Beobachtungen bleibt das Kästchen offen; Status, Beleg und datierten Changelog-Eintrag ehrlich ergänzen. Keine fremde oder historische Arbeit als eigenen Beitrag verbuchen.

## Identität und Arbeitsbericht

Zu Beginn oder im Abschlussbericht den eigenen tatsächlichen Assistentennamen und das verfügbare Modell / den Provider nennen. Wenn Name oder Modell nicht zuverlässig erkennbar sind, ausdrücklich „unbekannt“ schreiben; nichts erfinden. Diese Angabe gehört nur in die interne Arbeitskommunikation, nie in die Alo-Oberfläche.

Zum Abschluss kurz nennen: was tatsächlich geändert wurde, die exakten Dateipfade, Prüfungen und Ergebnisse (oder warum sie nicht liefen), Commit-/Push-Status, offene Risiken und ob etwas öffentlich veröffentlicht wurde. „Auf GitHub“ bedeutet nicht „live“.

## Produktziel

Alo bedeutet „All in one“ und hat drei gleichwertige Bereiche:

- Nose-Pushup / Gym: Training und Trainingsverlauf.
- Mira: allgemeine KI, nicht bloß ein Sportcoach.
- Nexus Chat: Gespräche und Räume; transparent unterscheiden, ob etwas nur lokal gespeichert oder wirklich zugestellt wurde.

Alo soll sich wie eine sorgfältig gestaltete mobile App anfühlen, nicht wie eine Landingpage. Hendrik bevorzugt ein ruhiges, dunkles Erscheinungsbild mit Anthrazit/Navy und Eisblau. Mira darf stark von Geminis ruhiger, minimalistischer Chatgestaltung inspiriert sein, muss aber Alo/Mira bleiben und darf weder fremde Logos noch eine Zugehörigkeit zu Google behaupten.

Mobile-first prüfen: 320 px und 390 px, Safe Areas, Tastatur, erreichbarer Composer, 44×44-px-nahe Touchflächen, lesbare Labels, keine horizontalen Überläufe und keine durch feste Navigation verdeckten Inhalte. Drei Hauptbereiche sollen gleichwertig bleiben. Bestehende Auswahloptionen unbedingt erhalten: vier Navigationslayouts, sechs Designstile, 13 Farbwelten, „Klassisch“ und persönliche Widgets.

## Nutzerentscheidungen und Verhaltensregeln

- Hendrik möchte offene Aufgaben weiterverfolgt sehen, bis sie tatsächlich erledigt oder ausdrücklich zurückgestellt sind. Status immer ehrlich benennen.
- Vor jeder Coding-Runde die Fehlerbericht-Prozedur aus `AGENTS.md` beachten. Bereits für den Auftrag bereitgestellte Berichte direkt untersuchen und nicht erneut anfordern.
- Änderungen zielgerichtet und ursachenorientiert umsetzen. Keine fremden Änderungen löschen, überschreiben oder mitcommitten.
- Pushes auf GitHub `main` sind freigegeben, sofern nur die beabsichtigten Dateien enthalten sind.
- Die öffentliche Website wird von Hendrik manuell in Lovable mit „Publish changes“ veröffentlicht. Nicht selbst veröffentlichen. Einen lokalen Build, Commit oder Push niemals als Live-Deployment bezeichnen.
- Keine echten KI-Anfragen, Trainings, Nachrichten, Uploads oder Datenbankänderungen als bloßen Test ausführen.
- Mira darf Kontext aus Training, Gesundheit, Suche oder Nexus nicht stillschweigend übernehmen. Vor Übertragung den genauen Inhalt zeigen und den Nutzer bewusst senden lassen. Quellenfreigabe ist kein Freibrief für zusätzliche Daten oder Zweitmodell-Aufrufe.
- BYOK ist Produktanforderung: Nutzer sollen eigene Anbieter-Keys eintragen können. Das ist keine Erlaubnis, Schlüssel unsicher zu speichern. Keine Secrets in Git, Frontend-Bundles, `localStorage`, URLs, Screenshots, Logs oder Fehlerantworten ablegen.
- Mehrere Modelle erhöhen Datenempfänger und Kosten. Keine automatische KI-Runde, Hintergrundprüfung oder Wiederholung ohne sichtbare Nutzeraktion, verständliche Vorschau und geprüfte Kostenbegrenzung.

## Repository und Prüfablauf

- Repository: `/workspace/nose-pushup`.
- Beim letzten geprüften Stand war `main`/`origin/main` auf `32bc73a` (`docs: track AI contributors in internal register`). Vor jeder Arbeit den tatsächlichen Branch, `git status`, aktuelle Commits und Remote-Stand neu prüfen.
- Die folgenden lokalen Voränderungen waren bewusst uncommittet und geschützt: `src/routeTree.gen.ts`; `docs/alo-fresh-*`; `docs/alo-validation/`; `scripts/test-alo-fresh-local.sh`; `supabase/fresh/`; `tests/db/`. Nicht zurücksetzen, löschen, bearbeiten, stagen oder committen, außer Hendrik beauftragt es ausdrücklich.
- Nur ein Codeeditor gleichzeitig. Bei fremden oder parallelen Änderungen erst die Verantwortlichen koordinieren.
- Relevante Prüfungen: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Bei Abhängigkeiten zusätzlich Lockfile aktuell halten und `npm ci --no-audit --no-fund` testen.
- Vorschau/Browsertests nur, wenn sicher ausgeschlossen ist, dass sie lokale Nutzerdaten überschreiben oder bei gespeicherter Chat-Historie automatisch eine KI-Anfrage starten. Andernfalls Unit-/statische Tests verwenden und die fehlende visuelle Abnahme offen nennen.

## Aktueller Funktionsstand, zuletzt bestätigt

- Gym-Modus für zwei echte Konten: getrennte Verläufe, gemeinsam trainieren, optionale Partner-Stats und Besuchskalender mit Wochen-/Monatszahlen. Persönliche Besuchstage und Trainingsdaten sollen getrennt bleiben; nur ausdrücklich freigegebene Werte sichtbar machen.
- Eine Gym-Migration zum Erhalt der Partnerhistorie bei Kontolöschung liegt unter `supabase/migrations/20261020200000_gym_partner.sql`. Letzte bekannte SHA-256: `9343f2331a6edfae109aa74a7d947c6c7b512bf6096f563b1dc6248a80fe8b80`. Sie wurde lokal getestet und einmal für Alo freigegeben, aber NICHT remote angewendet: Das verfügbare `apply_migration`-Werkzeug bot keine belegte Atomaritäts-/Rollback-Garantie. Vor jedem Remote-Zugriff Zustand, Hash und sicheren Ausführungsweg neu prüfen. Bei Hash-/Inhaltsabweichung oder fehlender Transaktionsgarantie stoppen und Hendrik erneut fragen.
- Neues Supabase-Projekt `Alo`, ID `mujuqmcxhdjwgoeaphpe`, Region `eu-central-1`. Letzter belegter Remote-Read-only-Check zeigte `ACTIVE_HEALTHY`, keine Tabellen und keine Migrationen. Vor einem Schreibzugriff erneut prüfen; nicht voraussetzen, dass es unverändert leer ist.
- Mira: frühere Chatstruktur wiederhergestellt und Gemini-inspiriert verfeinert. Letzter Commit ergänzte ruhiges Navy/Schwarz, Schimmer, Farb-Stern und klare Einstiege. Verlauf, Datenschutz, echte Anbieter-/Routinganzeige, bearbeitbare Such-/Inhaltsentwürfe sowie Kamera-/Mediathek-/Dateiauswahl wurden erhalten.
- Mira-Anhänge bleiben zunächst lokal und werden erst beim bewussten Senden übertragen. Letzter bekannter Umfang: JPEG, PNG, WebP, GIF, TXT, MD, CSV, TSV, JSON; PDF nur über Google. Bis zu vier Dateien, 3 MB insgesamt; Bild/PDF je 1 MB, Textdatei je 128 KB, Text gesamt 6.000 Zeichen. DOCX/XLSX müssen exportiert werden. Vor Änderungen prüfen, ob Anbieter und aktuelle Implementierung weiterhin dasselbe unterstützen.
- Der Screenshot-Fehler „Invalid redirect value …“ hatte eine codebelegte Ursache: vier Anbieteraufrufe verwendeten `redirect: "error"`, was die Laufzeit nicht akzeptierte. Der Fix wechselt auf manuelle Redirect-Prüfung und blockiert Weiterleitungen. 40 `Load failed`-Warnungen ohne Stacktrace auf `/ai` waren ebenfalls berichtet; ihre Ursache konnte daraus allein nicht eindeutig zugeordnet werden. Nicht als behoben behaupten, ohne erneute Evidenz.
- Letzter berichteter Mira-Teststand: 297 Tests, TypeScript und Build bestanden; Lint ohne Fehler, 15 bestehende Warnungen. Keine echte App-/Geräteprüfung; die öffentliche Website war nicht aktualisiert.

## Datenbank- und Sicherheitsgrenzen

- Frühere Arbeit an einer leeren Fresh-Datenbank ist von der Lovable-verwalteten bestehenden Datenbank getrennt. Alte Datenbank oder Nutzerdaten niemals löschen, überschreiben oder ungefragt migrieren. Vor Cutover explizite Prüfung von Auth, Redirects, Hosting-Secrets, Caches und Offline-Warteschlangen verlangen.
- Frühere statische Reviews meldeten folgende offene Code-Risiken; sie wurden in späteren Commits nicht nachweislich behoben. Gegen den aktuellen Commit neu prüfen, bevor sie als aktuell oder gelöst bezeichnet werden:
  - `chat-uploads`-SELECT-Policy könnte nicht ausreichend auf Eigentümer/Raum-Mitgliedschaft begrenzt sein.
  - Custom-Provider-URL wird serverseitig mit Bearer-Key angesprochen; SSRF- und Redirect-Schutz prüfen.
  - Allgemeiner Super-AI-Gateway-Pfad braucht harte serverseitige Nutzer-/Kostenquoten, Modell-Allowlist und Tokenlimits.
  - BYOK-, Health- und Watch-Zustand kann browserweit gespeichert sein und Konto-/Logout-Wechsel überleben.
  - Schritte-CSV-/Watch-Sync-Pfade auf Datenverlust und falsche Zeitstempel prüfen.
- Es gibt einen gespeicherten Runware-Key in einem sicheren Secret-Speicher; seinen Wert niemals lesen oder in irgendeine Datei aufnehmen. Runware nicht live aktivieren, bis serverseitige Secret-Nutzung, Auth/Rate-Limit, Kostenobergrenze und ausdrücklich freigegebener Test vorhanden sind. Keine kostenpflichtigen Aufrufe ohne konkrete Freigabe.

## Vorgehen bei neuen KI-Funktionen

Zuerst mit vorhandenen Abläufen integrieren statt neue Tabs, schwebende Leisten oder parallele Chats zu erzeugen. Jede KI-Aktion muss erklären, welcher Anbieter genutzt wird; die vorhandene regelbasierte Auswahl nicht als echtes Multi-Modell-Routing darstellen. Vor zusätzlichem Modellaufruf den genauen Prompt/Kontext und den zweiten Empfänger offenlegen. Originals beibehalten, Entwürfe editierbar machen und bei Fehlern Eingaben/Anhänge nicht verlieren.
