# Alo-Roadmap – internes Arbeitsregister

**Stand:** 2026-10-24
**Geltungsbereich:** Alo im Repository `/workspace/nose-pushup`. Die separate Guardians-of-Hyrule-Roadmap gehört nicht hierher.
**Zweck:** Diese Datei ist die zentrale, lebende Roadmap. Erledigte Punkte werden nur dann mit `[x]` abgehakt, wenn Code, Test oder dokumentierter Nachweis sie tatsächlich belegt. „Im Repository implementiert/lokal getestet“ bedeutet ausdrücklich weder „remote eingerichtet“ noch „live veröffentlicht“.

## Status lesen

- `[x]` Abgeschlossen – der konkrete lokale Code-/Dokumentationsstand oder ein benannter Test belegt es.
- `[ ]` Offen – noch zu erledigen oder noch nicht ausreichend nachgewiesen. Bei `TEILWEISE`, `UNGEPRÜFT` oder `BLOCKIERT` bleibt das Kästchen offen.
- Ein Häkchen bezieht sich nur auf den darunter benannten Umfang. Es darf nicht auf Migration, Live-Betrieb, echte Geräte oder Veröffentlichung übertragen werden.
- Prüfe bei jedem neuen Coding-Auftrag diese Roadmap. Hake nur Arbeit ab, die in diesem Auftrag wirklich fertig wurde; aktualisiere Status, Beleg, Abhängigkeit und Changelog. Erfinde keine früheren Beiträge anderer KIs und übertrage nicht ungeprüft veraltete Pläne.

## Produktvertrag und Sicherheitsgrenzen

Alo besteht aus drei gleichwertigen Bereichen: Nose-Push-Up/Gym, Mira als allgemeine KI und Nexus Chat. Die App ist mobile-first; vorhandene vier Navigationslayouts, sechs Designstile, 13 Farbwelten, „Klassisch“ und persönliche Widgets bleiben erhalten. Mira erhält App-Kontext nur auf ausdrückliche, einzeln widerrufbare Freigabe; eine Freigabe ist keine Erlaubnis zu stillen Zweitmodell-Aufrufen. Gym-Daten zweier Personen bleiben getrennt; Partnerwerte werden freiwillig und je Kategorie separat geteilt. Nexus muss klar zwischen lokalem Inhalt und tatsächlich zugestelltem Cloudinhalt unterscheiden.

Keine KI-Anfrage, Nachricht, Trainingsaktion, Upload, Datenbankänderung, kostenpflichtige Provider-Ausführung oder Live-Veröffentlichung wird als bloßer Test ausgeführt. Öffentliche Lovable-Veröffentlichung bleibt Hendriks manueller Schritt. Git-Push ist keine Veröffentlichung.

## Kurzüberblick

- **Grundlegende Trainings-, Dashboard- und UX-Arbeit:** Weitgehend im Repository umgesetzt und mit Tests dokumentiert. Ein echter Smartphone-/Screenreader-Nachweis fehlt weiterhin.
- **Gym zu zweit:** UI, Server-/Datenbankverträge und lokale Migrationstests liegen vor. Remote-Migration und echter Zwei-Konten-Abnahmelauf sind nicht belegt.
- **Mira:** Allgemeiner Chat, Provider-/Anhängepfad, optionale Kontextfreigaben und Runware-Vorschau sind vorhanden. Zwei Android-Chrome-Refresh-Warnungen vom 20.10.2026 bleiben ungeklärt. Runware-Ausführungen sind aus Kostenschutz gesperrt.
- **Nexus und Alo-Arbeitsbereich:** Funktionsumfang und lokale Tests sind dokumentiert. Produktive Cloudmigration und geräteübergreifende Live-Abnahme fehlen.
- **Alo-Startseite:** Der lokale Home-Bildschirm ist jetzt ein responsiver App-Hub mit eigenen Illustrationen; das bestehende Trainingsdashboard bleibt eingeklappt erreichbar. Das appweite Redesign, tiefere Freunde-Verknüpfungen und ein eigenständiges privates Spiel sind noch offen.
- **Fresh-Supabase-Arbeit:** Ein lokaler Fresh-Baseline-Test ist in einem separaten, geschützten und derzeit ungetrackten Arbeitsstand dokumentiert. Das ist kein produktiver Cutover; die Dateien werden von dieser Roadmap-Arbeit nicht geändert, gestaget oder mitcommittet.
- **Veröffentlichung:** Die öffentliche Website wurde in dieser Arbeit nicht geprüft oder veröffentlicht. Vor dem Roadmap-Commit stand `main` lokal zwei Commits vor `origin/main` (`0588dba` vs. `a9de123`); der öffentliche Remote-Read bestätigte `origin/main` auf `a9de123`. Die vorhandenen Hinweise melden fehlende Push-Authentifizierung.

## Phase 0 – Arbeitsnachweis, Fehlerberichte und Kontinuität

- [x] Das bestehende zentrale Register `docs/AI-TEAM.md` mit den bisherigen Einträgen erhalten und die neue Roadmap dort verlinken. Die Contributor-Regeln verlangen tatsächliche Identität/Modell oder „unbekannt“, echte Tests, geänderte Dateien, Commit-/Push- und Live-Status.
- [x] Den Alo-Auftrag von der separaten Guardians-of-Hyrule-Arbeit abgegrenzt; an diesem Spielrepo oder dessen Roadmap wurde nichts geändert.
- [ ] **UNGEKLÄRT – `/ai` Refresh-Warnungen vom 20.10.2026:** Zwei Meldungen aus Android Chrome nennen `TypeError: Failed to fetch` während Supabase `_refreshAccessToken`. Aus den vorliegenden Meldungen und der statischen Codeprüfung ergibt sich keine belegte Root Cause. Keine Reparatur, Regression oder Behebung behaupten.
  - Nächster sicherer Schritt: falls der Fehler erneut auftritt, den vollständigen Export aus Profil → Fehlerberichte mit Datum/Uhrzeit, Browser-/Android-Version, Loginzustand und Netzsituation erfassen. Keine Tokens, Schlüssel oder vollständigen privaten Gesprächsinhalte in die Roadmap kopieren.
  - Erst bei reproduzierbarer bzw. codebelegter Ursache einen eng begrenzten Fix planen und einen passenden Auth-Regressionstest ergänzen. Eine echte Nutzer- oder Produktionssession nicht für Diagnoseversuche verwenden.
- [x] Bestehende geschützte Änderungen unberührt gelassen: `src/routeTree.gen.ts`, `docs/alo-fresh-*`, `docs/alo-validation/`, `scripts/test-alo-fresh-local.sh`, `supabase/fresh/` und `tests/db/`.

## Phase 1 – Mobile Oberfläche, Navigation und Trainingskern

### Bereits umgesetzt und nachgewiesen

- [x] Drei Alo-Hauptbereiche und Swipe-Navigation mit Schutz vor versehentlichen Gesten; die Bereiche bleiben gleichwertig. Verweise: `docs/AI-HANDOFF.md`, `tests/alo-navigation.test.ts`, `tests/module-swipe-gesture.test.ts`.
- [x] Vier Navigationslayouts und voneinander unabhängige Personalisierung für Stile, Farben und Widgets erhalten. Der Code listet die vier Layouts in `src/lib/navigation-layout.ts`; die bestehende UX-Übergabe dokumentiert sechs Stile, 13 Farbwelten und persönliche Widgets. Tests: `tests/navigation-layout.test.ts`, `tests/design-style.test.ts`, `tests/theme.test.ts`, `tests/dashboard-layout.test.ts`.
- [x] Der UX-Trace für die 40 früheren Anforderungen ordnet Dashboard, Trainingslogik, Readiness, Coach, Eingaben, leere Zustände, Sprache, Fokusziele und Kamera-Fallback konkreten Implementierungen und Prüfergebnissen zu: `docs/ux-40-traceability.md`. Die dortigen Zustände „bereits vorhanden“ und „ergänzt“ bleiben historische Nachweise, keine neue Behauptung über Livebetrieb.
- [x] Der Trainingsentwurf wird gegen Überschreiben geschützt; gültige Teiltrainings können wiederhergestellt werden. Tests: `tests/workout-session-roundtrip.test.ts`, `tests/workout-session-validation.test.ts`, `tests/workout-save.test.ts`.
- [x] Mira-, Trainings- und Profilbereiche wurden in Richtung kompakter, ruhiger mobiler Oberfläche gestaltet; mobile Menü-/Fokus- und Composer-Fälle haben automatisierte Regressionstests.

### Noch offene Abnahme

- [ ] **ECHTES GERÄT OFFEN:** Den dokumentierten Ablauf auf einem echten Android-Smartphone abnehmen – mindestens schmale und übliche Breite, Hoch-/Querformat, Softkeyboard, Safe Areas, Scrollen, fixe Navigation und Rückkehr nach Hintergrundwechsel. Ein 390-px-iframe oder ein Desktopbrowser ist kein Hardwaretest.
- [ ] **BARRIEREFREIHEIT TEILWEISE:** Screenreader- und Tastaturdurchlauf der Hauptnavigation, Trainingsphasen, Dialoge, Chatcomposer, Fehler-/Offlinezustände und Gym-Freigaben. Frühere Arbeit belegt große Touchziele und sichtbare Statusbeschriftungen, aber keinen vollständigen WCAG-AA-Nachweis.
- [ ] Im Geräteabnahmelauf prüfen, dass 320/390 CSS-Pixel keine horizontale Überläufe erzeugen, Inhalte nicht unter Status-/Navigationsleisten verschwinden und Fokus/Tastatur keine primäre Aktion verdecken.
- [ ] Ergebnisse mit Gerät, Browser/OS, getesteten Pfaden und offenen Mängeln dokumentieren; Screenshots nur ohne persönliche Daten.

**Akzeptanz:** Ein frischer Nutzer kann auf dem echten Telefon die drei Bereiche finden, ein Training starten/unterbrechen/fortsetzen/speichern und Mira/Nexus bedienen; keine Überläufe oder verdeckten Aktionen; Tastatur-/Screenreader-Fokus ist nachvollziehbar. Nicht getestete Funktionen bleiben offen.

## Phase 2 – Gym zu zweit und private Trainingsdaten

### Bereits umgesetzt und lokal geprüft

- [x] Der Gym-Partnerablauf benötigt zwei registrierte Konten, verwendet einen kurzlebigen Einmal-Einladungscode und trennt Sätze, Gewicht, Verläufe und Kalender pro Person. Beleg: `docs/gym-partner-setup.md`, `src/components/GymPartnerPanel.tsx`, `src/lib/gym-partner.ts`.
- [x] Drei Partnerfreigaben sind voneinander getrennt, standardmäßig aus und widerrufbar: Summen der aktuellen Einheit, Wochen-/Monatstage als Anzahl und konkrete Besuchstage. Keine Trainingsdetails oder Gesundheitsdaten werden automatisch geteilt.
- [x] Kontolöschung beendet Einheiten und Freigaben, bewahrt nur den zulässigen eigenen Partnerverlauf der verbleibenden Person und nutzt transaktionale Bereinigung. Die statische Migrationsbeschreibung und lokale SQL-/Concurrency-Tests sind in `docs/gym-partner-setup.md`, `tests/gym-account-deletion.sql` und `tests/gym-account-deletion-concurrency.sh` dokumentiert.
- [x] Automatisierte Gym-Logik-/UI-Regressionen bestehen im aktuellen Testlauf (siehe „Prüfstand dieser Roadmap“).

### Offen bzw. blockiert

- [ ] **BLOCKIERT – REMOTE-MIGRATION:** `supabase/migrations/20261020200000_gym_partner.sql` wurde laut aktuellem Handoff nicht remote angewendet. Vor einem künftigen Schreibzugriff aktuellen Projektstatus, vollständigen SQL-Inhalt und SHA-256 erneut read-only prüfen. Nur mit belegtem atomarem Transaktions-/Rollbackweg und erforderlicher ausdrücklicher Freigabe weitergehen; bei Abweichung oder unklarer Ausführung stoppen. Eine lokale Migration ist keine Produktionsmigration.
- [ ] Nach gesonderter Migration mit zwei echten Konten in getrennten Browserprofilen prüfen: Einladungsablauf/15-Minuten-Ablauf, genau zwei Teilnehmer, parallele Einheiten, getrennte Historien, alle drei Freigaben einzeln ein/aus, Dritte/Gäste ausgeschlossen, Widerruf, Beenden und Kalender. Vor echter Konto-/Datenänderung Testkonten verwenden.
- [ ] Den dokumentierten Kontolöschungsfall erst in einer isolierten, kontrollierten Auth-Umgebung testen; lokale Auth-Nachbildungen ersetzen nicht Supabase Auth-Trigger in Produktion.

**Akzeptanz:** Kein Konto sieht fremde Einzeltrainings oder private Besuchstage ohne die passende aktuelle Freigabe; Widerruf verhindert weitere Serverabrufe; bestehender persönlicher Nose-Pushup-Verlauf bleibt unverändert.

## Phase 3 – Mira, Datenfreigaben und KI-Anbieter

### Bereits umgesetzt und teilweise abgesichert

- [x] Mira ist als allgemeine Alo-KI angelegt, nicht nur als Sportcoach. Der mobile Chat, Verlauf, Anbieter-/Routinghinweis, Bild-/Dateianhänge und bearbeitbare Übergabeentwürfe sind im aktuellen Projekt dokumentiert (`docs/AI-HANDOFF.md`, `src/components/mira/SuperAiPage.tsx`, `src/lib/mira-attachments.ts`). Anhänge werden zunächst lokal gehalten und nur beim bewussten Senden übertragen.
- [x] Die Mira-Datenfreigabe trennt optionale Trainings-/Gesundheitsdaten und ausgewählte Nexus-Räume; Konten und Geräte beginnen mit Freigaben aus. Such-/Alo-Aktionen erzeugen sichtbare, bearbeitbare Entwürfe statt stiller Sendungen. Belege: `docs/alo-workspace.md`, `tests/alo-workspace.test.ts`, `tests/mira-handoff.test.ts`.
- [x] Das fehlerhafte Redirect-Verhalten aus einem früheren Bericht wurde codebasiert auf `redirect: "manual"` umgestellt; die Weiterleitung wird geprüft und nicht verfolgt (`src/lib/ai-provider-fetch.ts`). Das ist getrennt von den neuen ungeklärten Token-Refresh-Warnungen.
- [x] Für Mira-Runware sind Vorschau, kuratierte Modelle, serverseitige Auth-/Nutzer-Allowlist, Eingabegrenzen und Fehlerredaktion vorbereitet. Die Kostenobergrenze ist ausdrücklich nicht verfügbar; bezahlte Ausführungen sind daher im Servercode gesperrt (`docs/mira-runware.md`, `src/lib/runware.server.ts`).

### Offene Sicherheits- und Zuverlässigkeitsarbeit

- [ ] **BESTÄTIGT, NICHT BEHOBEN – BYOK-/Health-/Watch-Scope:** Providerkeys liegen im Browser-`localStorage`, soweit im UI angegeben; Providerprofile nutzen UID-Schlüssel und `SIGNED_OUT` räumt bekannte Schlüssel auf. `loadProviders` kann jedoch einen alten globalen Schlüssel in ein Konto migrieren, Gesundheits-/Watch-Caches sind browserweit benannt, und `__root.tsx` löscht beim `SIGNED_IN`-Kontowechsel nicht. Wechsel-/Abmeldepfade in einem dedizierten Zwei-Konten-Test prüfen; danach sichere Scope-/Löschstrategie festlegen. Keine bestehenden Nutzerwerte in Testläufen offenlegen.
- [ ] **TEILWEISE – CUSTOM-PROVIDER-SSRF:** Servercode verlangt HTTPS, sperrt bestimmte private Hosts/IPs, prüft DNS und folgt Redirects nicht. Die Host-Allowlist ist optional; DNS-Auflösung und spätere Fetch-Auflösung sind nicht als gepinnte Verbindung belegt. Vor breiter Nutzung eine verpflichtende, eng definierte Allowlist bzw. gleichwertigen verbindungsgebundenen Schutz, DNS-/IPv6-/Sondernetzfälle und Redirect-Verhalten testen. Bis dahin keinen Custom-Provider-Sicherheitsnachweis behaupten.
- [ ] **TEILWEISE – QUOTEN/MODELL-/TOKENLIMITS:** `super-ai.functions.ts` verlangt Auth, begrenzt die Eingabe und setzt ein Prozess-lokales 20/Minute-Limit; gängige Provider haben Modell-Allowlisten. Custom-Modelle werden nur syntaktisch geprüft, Limits sind nicht instanzübergreifend dauerhaft und eine harte nutzer-/kostenbezogene Gesamtquota ist nicht belegt. Der getrennte Coach-Gateway-Pfad braucht eigene Prüfung auf Rate-/Kosten-/Ausgabelimits. Vor Erweiterung: serverseitige dauerhafte Quoten, explizite Modell-Allowlist, begrenzte Ausgabetokens/Requestgrößen, verständliche Kosteninformation und Tests für Parallelität/Mehrinstanzbetrieb.
- [ ] **RUNWARE GESPERRT LASSEN:** Nicht entsperren, bevor ein echter serverseitig durchgesetzter Preis-/Preflight-Vertrag für die festen Modell-IDs, ein gemeinsamer atomarer Budget-/Idempotenzspeicher über mehrere Instanzen und ein ausdrücklicher kostengeprüfter Live-Test existieren. Danach höchstens einzelne genehmigte Läufe; kein automatischer Retry bei unklarem Ausgang. Ein vorhandener API-Key ist keine Freigabe.
- [ ] Für jeden optionalen KI-Aufruf sichtbar festhalten: welcher Anbieter/Empfänger, welcher genaue App-Kontext und ob eine zweite Modellanfrage erfolgt. Regelbasierte Aufgabenauswahl nicht als automatisches Multi-Modell-Routing darstellen.

**Akzeptanz:** Kontowechsel kann keine fremden Keys, Gesundheitsdaten, Watch-Snapshots oder Mira-Notizen sichtbar machen; keine nicht freigegebene Kontextübermittlung; jedes kostenpflichtige Werkzeug bleibt ohne nachweislich wirksame Kostenbegrenzung gesperrt.

## Phase 4 – Nexus Chat, Alo-Suche und gemeinsamer Arbeitsbereich

### Bereits umgesetzt und lokal geprüft

- [x] Der Alo-Arbeitsbereich beschreibt zehn zusammenhängende Abläufe: bereichsübergreifende Suche, Schnellablage, getrennte Mira-Freigaben, explizite Teilen-Aktionen, Tagesübersicht, Sammlungen, Raumwerkzeuge, geräteübergreifende Synchronisierung, Datenschutz/Löschung und Schnellaktionen. Quelle und Grenzen: `docs/alo-workspace.md`.
- [x] Arbeitsbereichsdaten sind UID-gebunden, Freigaben standardmäßig aus und Änderungen nutzen Revisionen/Compare-and-swap statt stiller Last-write-wins-Überschreibung. Konflikt- und Löschfälle haben automatisierte Regressionen.
- [x] Lokaler Nexus-Chat und Cloudmodus werden unterscheidbar angezeigt; Nachrichteneingaben werden nach fehlgeschlagenem Versand nicht als erfolgreich entfernt. Cloud-DMs sind laut Code-/Testvertrag hier nicht verfügbar; bestehende öffentliche Räume sind nicht automatisch private Räume.
- [x] Eine neue Migration `20261020210000_chat_uploads_select_owner.sql` begrenzt den SELECT-Zugriff im Bucket `chat-uploads` auf den eigenen UID-Ordner. Das ist ein Repository-Artefakt, kein bestätigter Remote-Policy-Zustand.

### Offen bzw. nur teilweise gelöst

- [ ] **TEILWEISE – CHAT-UPLOADS:** Remote-Policy und effektive Grants/RLS sind nicht verifiziert. Die aktuelle SELECT-Policy ist eigentümergebunden; damit ist fremde Raum-Mitgliedschaft nicht als Leserecht implementiert. Vor einer künftigen Datei-/Raumfreigabe separat festlegen, ob und wie ein Eigentümer Uploads teilen darf; niemals eine pauschale Bucket-Lesbarkeit wieder einführen.
- [ ] **BLOCKIERT – CLOUD-SYNC/LIVE-ABNAHME:** `20261019210000_alo_workspace.sql` setzt Nexus-Schema voraus und ist laut Dokumentation nicht produktiv angewendet. Remote-Schema/Migrationsstatus vor jedem Schreibzugriff neu prüfen. Danach mit zwei regulären Konten und Geräten Kontoisolation, CAS-Konflikte, Tombstones/Löschung, Raumstimmen, Uploadzugriff, Realtime und Offlinewiederkehr testen.
- [ ] Cloudzustellung auf realem Client für alle Hauptaktionen verifizieren: „nur lokal gespeichert“ darf nie als „zugestellt“ erscheinen; ausstehende, fehlerhafte und wiederholte Sendungen müssen unterscheidbar sein.

**Akzeptanz:** Keine privaten Inhalte an andere Konten/Anbieter ohne bewusste Aktion; Cloud-Sync ist nachweislich auf dem Zielprojekt eingerichtet; echte Zwei-Geräte-Tests bestehen; keine lokalen Nexus-Testchats werden stillschweigend hochgeladen.

## Phase 5 – Supabase, Datenintegrität, Health und Watch

### Vorhandene Arbeit

- [x] Historische App-Migrationen wurden nicht blind in ein frisches Ziel replayt. Eine Fresh-only-Baseline samt Inventar, Seeds, SQL-/RLS-/API-Tests und exakten Prüfsummen ist im separaten lokalen Arbeitsstand dokumentiert. `docs/alo-fresh-validation.md`, `docs/alo-fresh-cutover-plan.md`, `supabase/fresh/`, `tests/db/` und `scripts/test-alo-fresh-local.sh` bleiben geschützte lokale Artefakte; sie werden in dieser Roadmap-Arbeit nicht geändert, gestaget oder mitcommittet. Diese lokale Validierung ist keine Produktionsfreigabe.
- [x] Der Watch-Import erhält in `SmartwatchPanel` bestehende Werte, wenn eine CSV nur Schritte enthält. Das verhindert, dass importierte Schritte allein Schlaf/Kalorien auf null setzen.

### Offene Befunde und Freigabeschranken

- [ ] **BESTÄTIGT – WATCH-SYNC MELDET ERFOLG TROTZ FEHLER:** `src/components/SmartwatchPanel.tsx` ignoriert den Fehler des `health_entries.upsert`, markiert das Gerät danach synchronisiert und zeigt einen Erfolgsstatus. Beim Dateiimport werden Fehler ebenfalls nicht pro Tag gemeldet. Künftige gezielte Codearbeit muss Fehler ausgeben, nur bestätigte Datensätze als importiert zählen und fehlgeschlagene Zeilen für Retry sichtbar halten; mit kontrolliertem Mock-Test, nicht mit echten Nutzerdaten.
- [ ] **BESTÄTIGT – UTC-DATUM ALS FALLBACK:** `src/lib/smartwatch.ts` und die Watch-UI bilden „heute“ teils über `new Date().toISOString().slice(0, 10)`. Das kann nahe Mitternacht vom lokalen Kalendertag abweichen. Mit `localDateKey`-ähnlicher Logik und Tests für Zeitzonen-/Tageswechsel beheben, bevor tägliche Summen als verlässlich gelten.
- [ ] **BLOCKIERT – FRESH CUTOVER:** Vor jeder Umschaltung exakten Fresh-Payload/Hash und Seedinventar erneut prüfen, aktuellen Zielprojektzustand read-only bestätigen, App-/Build-/Runtime-Konfiguration sowie Auth-URLs/Redirects, Provider, Offlinequeue und Hosting-Secrets separat planen. Keine alten Projekte oder Benutzer migrieren/löschen. Änderungen an Datenbank, `.env`, Hosting, Auth oder Deployment brauchen die dafür vorgesehene ausdrückliche Freigabe.
- [ ] Alte und neue Supabase-Projekte, lokale Konfiguration und Hosting-/Preview-Umgebungen nicht vermischen. Fehlende Cloudtabellen als Fehlerzustand darstellen; lokale Vorschau oder bestandener SQL-Test ist kein Remote-Nachweis.

**Akzeptanz:** Erfolgsanzeigen entsprechen gespeicherten Antworten; Datumsfelder verwenden beabsichtigte lokale Kalendertage; Fresh-Cutover hat reproduzierbare Vorher-/Nachher-Checks und keine unbeabsichtigte Migration alter Konten oder Queue-Einträge.

## Phase 6 – Tests, Barrierefreiheit, Release und Veröffentlichung

### Aktueller Prüfstand dieser Roadmap-Arbeit

- [x] `npm test`: **300/300 bestanden**.
- [x] `npx tsc --noEmit`: erfolgreich.
- [x] `npm run lint`: keine Fehler, **15 bestehende Warnungen** in anderen Komponenten/Routen.
- [x] `npm run build`: erfolgreich in einem temporären Archiv mit der aktualisierten Startseitenroute. Die bereits vor diesem Auftrag lokal geänderte `src/routeTree.gen.ts` im eigentlichen Arbeitsbaum blieb unangetastet. Der isolierte Build enthielt keine Änderungen an der geschützten Route-Datei oder an Fresh-Supabase-Dateien.
- [ ] Echte Hardware-/Screenreader-, produktive DB-, Providerkosten-, Push-, OAuth-/Mail-, Realtime- und Live-Veröffentlichungsprüfungen sind hier nicht durchgeführt.

### Release-Gates

- [ ] Für jeden Code-Release sauberer CI-Lauf: `npm ci --no-audit --no-fund`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; keine zusätzlichen Änderungen aus dem lokalen Worktree einschließen.
- [ ] Für Remote-Migrationen separat aktuellen Zustand, vollständigen SQL-Inhalt, Hash, atomare Ausführung/Rollback und Freigabe dokumentieren. Migrationen bleiben append-only.
- [ ] GitHub-Push nur als Fast-forward mit ausschließlich beabsichtigten Dateien; kein Force-Push. Der aktuelle Auth-Hinweis meldet fehlende Push-Anmeldung. Remote-Read bestätigt `origin/main` auf `a9de123`; Push wurde in dieser Arbeit nicht versucht.
- [ ] Lovable-Liveveröffentlichung ausschließlich Hendrik überlassen. Nach einem späteren manuellen Publish die Live-URL und tatsächliche Version separat bestätigen; Commit oder Git-Push nie als Livegang bezeichnen.

## Phase 7 – Alo-App-Hub, vollständige Neugestaltung, Freunde und private Spielintegration

### In diesem Auftrag lokal umgesetzt

- [x] Die Startseite `/` ist nun ein eigenständiger, responsiver Home-Bildschirm statt einer über die Trainingsseite gelegten Zusatzleiste. Vier aktive Kacheln führen zu den vorhandenen Zielen: Mira `/ai`, Nexus `/chat`, Alo Health/Nose Pushup `/exercises` und Einstellungen `/profile`. Freundesaktion und gespeichertes Profilbild beziehungsweise Initial stehen nebeneinander wie in der Skizze.
- [x] Jede aktive App-Kachel und der Spielplatzhalter hat eine eigene, handgeschriebene SVG-Illustration. Die Gestaltung orientiert sich nur allgemein an einem kuratierten App-Katalog; es wurden weder Neal.fun-Layout/Assets kopiert noch fremde Markenbilder eingebunden.
- [x] Trainingsplan, Gym-Partnerbereich, persönliche Widgets, Trainingsdaten und Deep Links bleiben im selben Home-Modul unter „Trainingsübersicht & Gym-Partner“ einklappbar erhalten. Die Sektion startet geschlossen und kennzeichnet, dass Partner- und eigene Trainingsverläufe getrennt sind.
- [x] Das Spiel bleibt ein nicht anklickbarer, ausdrücklich privater Platzhalter für ein späteres eigenständiges Abenteuer. Kein Zelda-/Nintendo-Inhalt, kein Spielcode, kein öffentlicher Host und keine Veröffentlichung.
- [x] Die Neugestaltung fügt keine Backend-Freigaben hinzu und überträgt keine Freunde-, Trainings-, Gesundheits-, Mira- oder Nexus-Daten. Belege: `src/routes/_authenticated/index.tsx`, `tests/home-app-hub.test.ts`, vorhandene Partnerdatentests in `tests/gym-partner-ui.test.ts`.

### Priorisierte offene Arbeit und Entscheidungen

- [ ] **P0 – APPWEITES REDESIGN NOCH OFFEN:** Die neue Home-Ansicht ist umgesetzt; weitere Bereiche der Alo-Website wurden nicht neu gestaltet. Als nächste Stufe die vorhandenen Trainings-, Health-, Mira-, Nexus- und Einstellungsseiten konsistent auf die neue Informationsarchitektur und Bildsprache abstimmen, einschließlich Lade-, Fehler-, Leer- und Rückkehrzuständen. Neal.fun bleibt nur allgemeine Inspiration für einen kuratierten Katalog – keine kopierte Anordnung, Texte, Grafiken oder Identität. Vier Navigationslayouts, sechs Designstile, 13 Farbwelten, „Klassisch“, persönliche Widgets, bestehende Deep Links und Trainingsfunktionen dürfen nicht stillschweigend entfallen.
- [ ] **P1 – FREUNDE-VERKNÜPFUNG IST NUR TEILWEISE VORHANDEN:** Die Profilseite enthält die aktuelle Freundesverwaltung und eine Trainingsaktivität. Noch nicht belegt sind Freunde direkt aus Mira-Unterhaltungen hinzuzufügen, Nexus-Chats zuverlässig mit Freunden zu verknüpfen oder die globale Freundesliste als Gym-Partner- und Spiel-Einladung zu verwenden. Je Ziel eine konkrete Interaktion, Rollen-/Mitgliedschaftsprüfung und Abbruch-/Widerrufspfad entwerfen und testen. Eine bestätigte Freundschaft ist keine Einwilligung, private Trainings-, Gesundheits-, Chat- oder KI-Inhalte zu teilen; kein stilles Hinzufügen, Einladen oder Übertragen.
- [ ] **P1 – PARTNERVERLAUF UND DATENTRENNUNG KLÄREN:** Der vorhandene Gym-Vertrag hält die Sätze und Kalender beider Konten getrennt; Freigaben sind einzeln, standardmäßig aus und widerrufbar. Die lokale Kontolöschungslogik entfernt die Daten des gelöschten Kontos und bewahrt die eigenen Sätze und Besuchstage der verbleibenden Person. Die formulierte Anforderung „Verlauf des Partners behalten und trennen“ ist semantisch noch offen: Soll nur jede Person ihren eigenen Verlauf nach dem Entkoppeln behalten, oder soll auch der Verlauf eines gelöschten/ausgeschiedenen Partners beim anderen Konto erhalten bleiben? Letzteres ist durch den beschriebenen Vertrag nicht belegt und darf nicht als bloße UI-Änderung umgesetzt werden; Eigentum, Zustimmung, Aufbewahrungsgrundlage, Identitätsentfernung und Löschweg müssen zuerst ausdrücklich entschieden werden. Remote-Migration und Zwei-Konten-Abnahme bleiben gemäß Phase 2 offen.
- [ ] **P2 – SPIEL VOLLSTÄNDIG EIGENSTÄNDIG ENTWICKELN:** Eine Umbenennung des Titels allein genügt nicht, um Nähe zu geschützten Inhalten auszuschließen. Vor einer Integration Titel, Welt, Figuren, Regionsnamen, Handlung, Texte, UI, Logos, Musik, Sounds und Grafiken eigenständig neu entwickeln und alle verwendeten Assets auf eigene Urheberschaft oder Lizenz prüfen. Nintendo weist auf mögliche Schutzrechte an Namen, Logos, Figuren, Produktnamen, Spielen, Grafiken und Webinhalten hin: [Nintendo Intellectual Property](https://www.nintendo.com/au/legal/nintendo-intellectual-property/). Das ist keine Rechtsberatung. Bis zum vollständigen IP- und Datenschutzreview bleibt die Kachel nicht klickbar. Die zuvor festgelegte Betriebsgrenze bleibt bestehen: nur lokale/private Integration, kein Push, kein öffentlicher Host und keine Veröffentlichung; Multiplayer/Freunde nur mit eigenständigem, explizitem Einladungs- und Datenfreigabekonzept.
- [ ] **ABNAHME VOR RELEASE:** Hub und kompletter Umbau bei 320/390 CSS-Pixeln sowie Desktop, mit Safe Areas, Tastatur, Screenreader und mindestens 44×44-px-nahen Touchflächen prüfen. App-Kacheln müssen echte, verständlich benannte Ziele öffnen; Platzhalter dürfen nicht wie aktive Apps wirken. Zusätzlich vier Navigationstypen, sechs Stile, 13 Farbwelten, klassische Ansicht, Widgets, bestehende Deep Links und vollständigen Training-/Gym-Verlauf regressionsprüfen. Echte Geräte-, Screenreader-, Remote-Datenbank- oder Live-Abnahme nur nach den jeweiligen Release-Gates dokumentieren.

## Empfohlene Reihenfolge und Abhängigkeiten

1. Neue `/ai`-Warnungen bei erneutem Auftreten mit vollständigem, datensparsamem Bericht eingrenzen; bis dahin keine spekulative Auth-Codeänderung.
2. Sicherheitsbefunde mit echtem Daten-/Kostenrisiko (Account-Scope, Provider-SSRF, serverweite Quoten, Watch-Sync-Erfolg/Datum) als eigene, eng umrissene Codeaufträge planen. Erst Tests und konkrete Akzeptanz festlegen; nicht nebenbei ändern.
3. Die übrigen Alo-Bereiche schrittweise an den neuen Home-Einstieg anpassen; dabei bestehende Navigation, Einstellungen, Widgets, Farben, Stile, klassische Ansicht, Trainingsfunktionen und Deep Links regressionsprüfen.
4. Vor sozialen App-Verknüpfungen den offenen Partnerverlaufsbegriff ausdrücklich entscheiden und die Datenflüsse pro Mira-, Nexus-, Gym- und Spielaktion inventarisieren. Freundschaft bedeutet nicht automatisch Freigabe; zuerst vorhandene RLS/RPC- und Cloudgrenzen nachweisen.
5. Spielinhalte unabhängig und original entwickeln sowie Rechte und private/lokale Ausführung prüfen; bis dahin bleibt der Platzhalter deaktiviert.
6. Remote-Gym-/Alo-Migrationen und Fresh-Cutover getrennt vorbereiten. Jede Änderung braucht frische Read-only-Prüfung und die jeweilige Freigabe; Gym-/Cloud-Liveabnahmen hängen von sicher eingerichteter Testumgebung und zwei Konten ab.
7. Nexus-Cloud-/Uploadverträge und zweigerätefähige Sync-Tests abschließen.
8. Mobile-/Screenreader-Abnahme des vollständigen Hubs und der veränderten Bereiche durchführen.
9. Erst nach bestandenen lokalen/CI-, Remote- und manuellen Gates einen Release- bzw. Publish-Schritt dokumentieren. Public publish bleibt nutzerkontrolliert.

## Changelog

- **2026-10-25 – Alo-Home-Bildschirm neu gestaltet.** Cue Coding Assistant; Modell/Provider: unbekannt. `src/routes/_authenticated/index.tsx` macht `/` zum responsiven App-Home mit individuellen inline-SVG-Illustrationen für Mira, Nexus, Alo Health und Einstellungen, Freundes-/Profilzugriff und einem klar deaktivierten privaten Spielplatzhalter. Die bisherige Trainingsübersicht samt Gym-Partnerbereich bleibt vollständig im eingeklappten Abschnitt erhalten; Partnerdaten oder Freigaben wurden nicht verändert. `tests/home-app-hub.test.ts` prüft Ziele, Illustrationen, Spiel-Platzhalter und den erhaltenen Trainingsbereich. `npm test` 300/300 bestanden; `npx tsc --noEmit` erfolgreich; `npm run lint` 0 Fehler/15 bestehende Warnungen; `git diff --check` bestanden. `npm run build` erfolgreich in einem temporären Archiv; die geschützte `src/routeTree.gen.ts` im Arbeitsbaum blieb unangetastet. Geräte-/Screenreader-Vorschau nicht durchgeführt. Kein Datenbankzugriff, keine KI-/Chat-Aktion, kein Push oder Publish zum Zeitpunkt dieses Eintrags. Appweites Redesign, soziale Integrationen, Partnerverlaufsentscheidung und Spiel-IP-Prüfung bleiben offen.
- **2026-10-25 – Lokaler App-Hub-Slice und Folge-Roadmap.** Cue Coding Assistant; Modell/Provider: unbekannt. `src/routes/_authenticated/index.tsx` ergänzt einen mobilen App-Hub mit echten Mira-, Nexus-, Training- und Profilzielen, aktueller Profilabbildung/Initial sowie vorhandener Freundesverwaltung; bestehendes Trainingsdashboard bleibt darunter. Ein Spiel ist nur ein nicht-interaktiver Originalwelt-Platzhalter. `tests/home-app-hub.test.ts` und die veraltete Reihenfolge-Assertion in `tests/gym-partner-ui.test.ts` wurden ergänzt/aktualisiert. Sicherer Testlauf: `npm test` 299/299; `npx tsc --noEmit` erfolgreich; `npm run lint` 0 Fehler, 15 Warnungen; `git diff --check` bestanden. Build absichtlich nicht ausgeführt, um die fremde lokale Änderung `src/routeTree.gen.ts` zu schützen; keine App-Vorschau, Datenbank-, KI-, Chat- oder echte Nutzerdatenaktion. Vollständiger Umbau, Freundeverknüpfungen, Partnerverlaufsentscheidung, Remote-Migration, echte Geräteabnahme und Spiel-IP-Neuentwicklung bleiben offen. Kein Commit, Push oder Publish.
- **2026-10-24 – Erstfassung und Statusabgleich.** Cue Coding Assistant; Modell/Provider: unbekannt. Quellen waren der aktuelle Alo-Arbeitsbaum, `docs/AI-HANDOFF.md`, `docs/AI-TEAM.md`, `docs/ux-40-traceability.md`, `docs/alo-workspace.md`, `docs/gym-partner-setup.md`, `docs/mira-runware.md`, vorhandene `.lovable/plan/`-Notizen, aktuelle Quellpfade und der Testlauf. Zwei Token-Refresh-Warnungen bleiben unbestätigte Beobachtungen. Es wurden keine App-Dateien, Migrationen oder Fresh-Supabase-Artefakte geändert; kein Remote-Datenbankzugriff und kein Publish. Der Roadmap-/Contributor-Dokumentationscommit ist `effc8795e3848130394991b6a5de264cccaee3cf`; der Registerabschluss wird separat dokumentiert.

- **2026-10-24 – Register- und Prüfabschluss.** Eigener Eintrag in `docs/AI-TEAM.md` auf erledigt gesetzt. Roadmap-/Contributor-Dokumentationscommit `effc8795e3848130394991b6a5de264cccaee3cf`; beim Commit war `main` drei Commits vor `origin/main`, deren Remote-SHA read-only `a9de12396c3011e90d1ef49c23b8324212f97c38` entsprach. Fast-forward-Abstammung geprüft; wegen bereits gemeldeter fehlender Push-Authentifizierung kein Push versucht. `npm test` 297/297, TypeScript erfolgreich, Lint 0 Fehler/15 Warnungen; keine Veröffentlichung.
