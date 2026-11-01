# Die 40 Verbesserungen: Was bereits vorhanden war und was ergänzt wurde

Ausgangspunkt ist [Commit 4afedc9](https://github.com/Hendrik5000/nose-pushup/commit/4afedc9347f50851f3bca15f2fb19eaa3364c386). Die ursprünglichen Nummern stehen in Issues #6–#12. **Bereits vorhanden** bedeutet: im Ausgangscommit anhand des Implementierungspfads und vorhandener Tests nachweisbar, nicht bloß aus seinem Titel abgeleitet. **Ergänzt** bezeichnet die Folgeänderungen dieser Aufgabe. Die Zuordnung nennt absichtlich Funktionen und Dateien statt kurzlebiger Zeilennummern.

Die Folgeänderungen sind getrennt nachvollziehbar: [ebbbff5 – KI-Kontext und Rückmeldungen](https://github.com/Hendrik5000/nose-pushup/commit/ebbbff5) für #9 und [1fadb17 – Entwurfsschutz, Training, Sprache und Bedienbarkeit](https://github.com/Hendrik5000/nose-pushup/commit/1fadb17) für #6, #7, #8, #10 und #11. Die Lockfile-Regel steht in [acad0e4](https://github.com/Hendrik5000/nose-pushup/commit/acad0e4). Die Tests und dokumentierte Browserabnahme sind #12 zugeordnet.

## Dashboard, Trainingslogik und Einstieg

| Nr. | Issue | Anforderung und genauer Bezug | Stand |
|---|---|---|---|
| 1 | #6 | Ein konsistenter Tagesformzustand: `src/lib/readiness.ts:computeReadiness`, `ReadinessCard` und Dashboard verwenden denselben Zustand für Kennzahl und Empfehlung. | Bereits vorhanden. |
| 2 | #6 | Bei fehlenden Daten kein erfundener Score: `computeReadiness.available`, Anzeige „Nicht berechnet“, allgemeiner Einstiegsplan aus `getQuickStartPlan`. | Bereits vorhanden. |
| 3 | #6 | Allgemeiner Plan statt vermeintlich persönlicher Beispieldaten: `src/lib/workout-plans.ts:getQuickStartPlan` kennzeichnet den Einstieg ausdrücklich ohne Leistungsprognose. | Bereits vorhanden; kein neuer Demodatensatz erzeugt. |
| 4 | #6 | Kennzahl erläutern: `ReadinessCard` zeigt `detail`, Quellen und Datenabdeckung aus `computeReadiness`. | Bereits vorhanden. |
| 5 | #6 | Fehlende Quellen benennen: `sources`, `missingSources` und die Anzeige im Readiness-Bereich. Schlaf und gespeicherte Trainings sind erforderlich; Schritte oder lokale Check-ins ersetzen sie nicht. | Bereits vorhanden. |
| 6 | #6 | Erholung verständlich einordnen: Readiness-Erklärung und `RecoveryCalendar` behandeln die Anzeige als trainingsbasierte Einschätzung, nicht als physiologischen Messwert. | Bereits vorhanden; kein neues medizinisches Modell eingeführt. |
| 7 | #6 | Wochenfortschritt mit Zahl, Ziel und Prozent: `workout-plans.ts:getWeeklyProgress`, Dashboard. | Bereits vorhanden; „Reps“ durch „Wiederholungen“ ersetzt. |
| 8 | #6 | Klare Zeitgrenzen: `training-dates.ts:getTrainingWeekBounds`, `localDateKey`, `sumTrainingWeekReps`; Montag 00:00 in lokaler Zeitzone, gespeicherte tatsächliche Wiederholungen. | Bereits vorhanden; Readiness-Abfrage schließt zusätzlich zukünftige Trainingszeitstempel aus. |
| 9 | #8 | Empfehlung als strukturierter Plan: `getDashboardRecommendation`, Dashboard und `CoachPanel`. | Bereits vorhanden. |
| 10 | #8 | Zahlen unverändert in die Trainingsroute übernehmen: `WeekPlanCard`, Dashboard-Link und `workout-session.ts:validateWorkoutSearch`. | Bereits vorhanden; KI-Planübergabe ebenfalls im Browser geprüft. |
| 11 | #8 | Satznummer und Ziel anzeigen: `WorkoutScreen` rendert `WorkoutSession.currentSet` und `plan`. | Bereits vorhanden. |
| 12 | #8 | Pause mit Countdown und Verlängerung: `finishWorkoutSet`, `extendWorkoutRest`, Trainingsroute. | Ergänzt: manuelle Countdown-Anzeige aktualisiert auch beim Eintritt in die Pause. |
| 13 | #8 | Vorbereitung, aktiver Satz, Pause, Pausiert und Abschluss unterscheiden: `WorkoutPhase` und `WorkoutScreen`. | Bereits vorhanden; doppelte deaktivierte Speicheraktion in der Vorbereitung entfernt. |
| 14 | #8 | Wiederholungen korrigieren: `recordWorkoutRep`, `undoWorkoutRep` und manuelles Eingabefeld. | Bereits vorhanden; deutsches, verknüpftes Eingabelabel ergänzt. |
| 15 | #8 | Unterbrechen, verwerfen oder Teiltraining speichern: `pauseWorkout`, `discardWorkout`, `summarizeWorkout`, Trainingsroute. | Ergänzt: Teiltraining erhält keine widersprüchliche Überschrift „Session abgeschlossen“ mehr. |
| 16 | #8 | Plan und tatsächliches Ergebnis gegenüberstellen: `summarizeWorkout` und Abschlussansicht mit Sätzen, Wiederholungen und Dauer. | Bereits vorhanden; deutsche Formulierungen und Satz/Sätze korrigiert. |
| 17 | #7 | Trainingsstart als wichtigste Aktion: primärer Empfehlungsbereich im Dashboard. | Bereits vorhanden; deutsche Modusbeschriftung vereinheitlicht. |
| 18 | #7 | Empfehlung/Fortschritt zuerst, weitere Widgets nachgeordnet: Dashboard und `components/dashboard/DashboardGrid.tsx`. | Bereits vorhanden. |
| 19 | #7 | Neue Gäste zum ersten gespeicherten Training führen: `WelcomeTour` erklärt Empfehlung → Training → Speichern → Fortschritt. | Bereits vorhanden; frischen Gast-Durchlauf im Browser geprüft. |
| 20 | #6 | Aus der Tagesform eine Aktion ableiten: `getDashboardRecommendation`, `CoachPanel`, `QuickActionsBar`. | Bereits vorhanden; geringe verfügbare Readiness bewirkt tatsächlich einen leichteren Plan. |
| 21 | #6 | Leerzustände mit nächstem Schritt: Dashboard unterscheidet fehlende Einträge, Lade-/Abfragefehler und gespeicherten Fortschritt; Readiness benennt fehlende Daten. | Bereits vorhanden; Copy vereinheitlicht. |
| 22 | #7 | Mobile Bedienbarkeit und Priorisierung: responsives Dashboard und Trainingsansicht. | Ergänzt und geprüft: deutsche Umbrüche, sichtbare Auswahltexte und 44px-Ziele; Browser-Viewports 1280px und 390px ohne horizontales Überlaufen im geprüften Ablauf. |

## KI-Coach, Sprache, Bedienbarkeit und Kamera

| Nr. | Issue | Anforderung und genauer Bezug | Stand |
|---|---|---|---|
| 23 | #9 | KI-Eingabe sofort sichtbar: `src/routes/_authenticated/ai.tsx:SuperAiPage` platziert den Composer direkt nach dem Kopfbereich. | Bereits vorhanden; aussagekräftige Labels für Frage und Senden ergänzt. Sichtbarkeit im Desktop-Viewport geprüft. |
| 24 | #9 | Wenige sinnvolle Startvorschläge: zunächst drei Werkzeuge, weitere erst über „Mehr Vorschläge“. | Bereits vorhanden; Werkzeugnamen ins Deutsche übertragen. |
| 25 | #9 | Vor dem Senden tatsächliche Datengrundlage erklären: `describeContext`, `ai-context.ts:buildAppContext` und `contextToSystemBlock`. | Ergänzt: verständliche Profilfeldnamen und Datenabdeckung, Rohtrainings und aktuelle Wochensumme. Wegen #13 werden widersprüchliche Tagesaggregatsummen ausdrücklich nicht als Wiederholungsgrundlage verwendet. |
| 26 | #9 | Bei fehlendem Kontext nachfragen statt erfinden: Systeminstruktion im KI-Dialog; fehlende Trainings-/Gesundheitswerte bleiben unbekannt. | Bereits vorhanden; „Passt nicht“ fordert zusätzlich gezielte Klärung des ungeeigneten Vorschlags. |
| 27 | #9 | Plan zuerst zeigen und bewusst übernehmen: `ai-plan.ts:parseAiResponse`, `validateAiWorkoutPlan` und Vorschau-Link in `ai.tsx`; keine Zahlensuche in freiem Text. | Ergänzt: verständlicher Vorschaulink und ausdrücklicher Hinweis, dass noch kein Training absolviert oder automatisch gestartet wurde. |
| 28 | #9 | Rückmeldung zum konkreten Vorschlag: KI-Nachricht mit `plan` und `feedback`, `getMostRecentPlanFeedback`, `applyPlanFeedback`. | Ergänzt: statt eines globalen Einzelwerts mit jeder Empfehlung im Gespräch gespeichert; „Zu schwer“, „Zu leicht“, „Passt nicht“, „Passt“, sichtbare Bewertung und `aria-pressed`. Neu laden erhält die Auswahl. |
| 29 | #10 | Größen verständlich beschriften: `dashboard-layout.ts:getSizeLabel` und Dashboard-Editor verwenden Klein/Mittel/Groß. | Bereits vorhanden; weitere Abkürzungen im Trainings-/Dashboardtext ausgeschrieben. |
| 30 | #10 | Verständliche, lesbare Plannamen: Wochenplan mit Umbruch und Silbentrennung. | Ergänzt: ausgeschriebene Routinenamen und „Heute“-Markierung; Namen werden nicht nur abgeschnitten dargestellt. |
| 31 | #10 | Unverständliches „Mausig“ ersetzen. | In den geprüften Dashboard-, KI-, Trainings- und Wochenplandateien nicht vorhanden; kein erfundener Fix behauptet. |
| 32 | #10 | Einheitliche deutsche Sprache in den betroffenen Abläufen: Dashboard, Training, KI-Werkzeuge, `TopNav`, Root-/404-/Fehlertexte. | Ergänzt: unter anderem Wiederholungen, Training, Gesundheitsdaten, Zugangsdaten, Gespräche und deutsche Fehlermeldungen; `html lang="de"`. Technische Modell-/Anbieternamen bleiben Eigennamen. |
| 33 | #10 | Bedienziele und Fokus: `src/styles.css`, semantische Eingaben und Links. | Ergänzt: mindestens 44px Blockhöhe, Fokus-Token und kontrastabhebender Fokusrand. Mobile Belastungs-Buttons gemessen: ca. 55×44px. Kein vollständiger WCAG-AA-Konformitätsnachweis. |
| 34 | #10 | Zustände nicht nur über Farbe: sichtbare „Ausgewählt“-Texte, Phasenbezeichnungen, gespeicherte Bewertungsbeschriftung und `aria-pressed`; Kamera-Livestatus mit Text. | Ergänzt bzw. vereinheitlicht. |
| 35 | #11 | Vor Kamerazugriff Positionierung und Grenzen erklären: `WorkoutScreen`, `useCameraDetection`. | Präzisiert: seitlich, gutes Licht, sichtbare Gelenke; Erkennung kann Wiederholungen übersehen oder falsch zählen. |
| 36 | #11 | Nach Ablehnung/Fehler manuell weitertrainieren: direkte Aktion „Ohne Kamera manuell trainieren“ und verständlicher Fehlertext. | Ergänzt: Berechtigungs-, Geräte- und Modellfehler verständlich; mobiler Ablehnungs-/Fallback-Durchlauf erhält die Planwerte. |
| 37 | #7 | Grenzen des Gastfortschritts erläutern: `auth.tsx`, `WelcomeTour` und lokale Metadatenhinweise. | Bereits vorhanden: Wiederzugriff hängt vom Gastkonto/Browser ab; lokale Entwürfe und Zusatzmetadaten sind gerätegebunden. |
| 38 | #11 | Verarbeitung transparent machen: Kamerahinweis vor Start, `useCameraDetection` mit lokalem Videostream und `detectForVideo`. | Präzisiert: Erkennungssoftware vom jsDelivr-CDN und Modell von Google Cloud werden nach Start geladen; Poseverarbeitung lokal, Video/Einzelbilder nicht gespeichert oder übertragen. Keine Behauptung „gar kein Netzwerk“. |

## Tests und Schutz vor Planverlust

| Nr. | Issue | Anforderung und genauer Bezug | Stand |
|---|---|---|---|
| 39 | #12 | Zentrale Zustände automatisiert prüfen: `tests/readiness.test.ts`, `workout-plans.test.ts`, `workout-session.test.ts`, `training-dates.test.ts`, `ai-plan.test.ts`, `user-flow.test.ts`. | Ergänzt: `ai-coach-feedback.test.ts`, `ai-feedback-persistence.test.ts`, `workout-plan-copy.test.ts`, `workout-session-validation.test.ts`. Insgesamt 31 Tests erfolgreich. Ungültige gespeicherte Pläne/Zustände werden verworfen, gültige Unterbrechungen erhalten. |
| 40 | #12 | Durchlauf von Gaststart bis gespeichertem Fortschritt und mobile Unterbrechungen prüfen. | Im Browser durchgeführt: Desktop-Gastplan 3×3 übernommen, manuell gespeichert, Reload und Wochenfortschritt 9; danach mobile Kameraablehnung → manueller Wechsel → 1 Satz/3 Wiederholungen → Reload/pausierter Entwurf → Teiltraining → Wochensumme 12. Zusätzlich KI-Testvorschau/Rückmeldung und Planwechselkonflikt geprüft. |

**Zusätzlicher Schutz in #8/#12:** Bei einem geöffneten neuen Plan überschreibt die Trainingsroute keinen unvollendeten Entwurf. Sie bietet ausdrücklich „Bisherigen Entwurf fortsetzen“ oder „Entwurf verwerfen und neuen Plan starten“. Fortsetzen ersetzt die URL mit dem gespeicherten Plan und erhält Wiederholungen; Speicherung ist an den hydratisierten Benutzer-/Übungsschlüssel gebunden. Im Browser wurde ein begonnener 3×2-Plan mit zwei Wiederholungen gegen einen neuen 2×4-Plan geprüft und unverändert fortgesetzt.

## Was tatsächlich geprüft wurde

`npm ci`, `npm test` (31/31), `npx tsc --noEmit`, `npm run lint` und `npm run build` waren erfolgreich. Lint enthält weiterhin bestehende Warnungen, aber keine Fehler. GitHub-CI-Nachweise und genaue Commitverweise stehen zusätzlich an den jeweiligen Issues.

Die Browserprüfung nutzte einen eigenen frischen Gast auf einem getrennten Testursprung, Desktop mit 1280px Breite und einen gleichursprünglichen iframe mit 390px Breite (600–844px Höhe). Die Kamera wurde im iframe absichtlich nicht freigegeben. Das ist **keine Prüfung auf einem physischen Smartphone**, keine Messung realer Kameraerkennungsqualität, keine vollständige Screenreader-/WCAG-Abnahme und kein Live-KI-Aufruf. Die KI-Vorschau war klar als Testdatensatz markiert, nicht als echte Modellantwort.

**Verbleibende Abnahme in #12:** Der ausdrücklich verlangte Durchlauf auf einem echten Mobilgerät ist hier nicht nachgewiesen. #12 bleibt dafür offen, erhält aber den vollständigen Test-/Commitnachweis; der vorhandene mobile Viewport-Test wird nicht als Hardwaretest ausgegeben.

## Zusätzlich gefunden: Datenbankproblem #13

Zwei gespeicherte Testtrainings mit 9 und 3 Wiederholungen ergaben korrekt 12 in den Rohtrainings, aber 24 in `daily_stats`. Der Migrationsverlauf enthält doppelte Trigger für denselben Workout-Handler. Dieser zusätzliche Backendbefund ist mit Reproduktion und Migrationsnamen in [Issue #13](https://github.com/Hendrik5000/nose-pushup/issues/13) dokumentiert. Der Dashboard-Wochenfortschritt und KI-Trainingsumfang verwenden deshalb Rohtrainings, nicht die abweichende Aggregatsumme. Bestehende Nutzerdaten und Live-Datenbanktrigger wurden in dieser Aufgabe nicht rückwirkend verändert.

## Lockfile und Issue #3

Der ursprüngliche Lockfile-Fix war schon im Ausgangscommit vorhanden. Der zusätzliche Commit `acad0e45b318b87bd93b2a3427e722034b23aba6` ergänzt die verbindliche Projektregel: Bei Dependency-Änderungen `package-lock.json` synchron halten und einen sauberen `npm ci`-Durchlauf prüfen. Installation, Lint und Build sowie die GitHub-CI für diesen Commit waren erfolgreich; #3 enthält den zugehörigen Abschlussnachweis.
