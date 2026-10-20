# Gym zu zweit: Einrichtung und Datenschutz

## Noch nicht auf Produktion aktiviert

Die Erweiterung liegt in `supabase/migrations/20261020200000_gym_partner.sql`. Sie wird in diesem Änderungssatz **nicht auf die Remote-/Produktionsdatenbank angewendet**. Vor dem produktiven Einsatz muss diese Migration nach gesonderter Prüfung über den üblichen Deployment-Prozess eingerichtet werden. Nur die Oberfläche in Lovable zu veröffentlichen reicht dafür nicht aus. Bis dahin zeigt die App einen verständlichen Einrichtungshinweis statt Testdaten.

Nose-Pushup, Mira, Nexus Chat, Navigation und Designoptionen bleiben bestehen. Der neue Bereich „Gym · Zu zweit“ ist in die bestehende Trainingsstartseite integriert. Es gibt keine neue Route und keine Änderungen an generierten Supabase-Typen.

## Gemeinsam trainieren

Beide Personen brauchen ein eigenes registriertes Konto; Gastkonten sind ausgeschlossen. Einer erstellt eine Einheit und gibt den zufälligen Einladungscode persönlich weiter. Der Code gilt 15 Minuten und ist nach dem Beitritt verbraucht. Genau zwei Konten können teilnehmen. Pro Konto ist nur eine offene Einheit möglich.

Nach dem Beitritt erfasst jeder seine eigenen Übungen, Sätze, Wiederholungen und Gewichte. Unterstützt werden 1–1000 Wiederholungen, 0–1000 kg in 0,25-kg-Schritten und maximal 500 Sätze pro Person und Einheit. Ohne Zusatzgewicht werden 0 kg eingetragen. Das Volumen ist das eingetragene Gewicht mal Wiederholungen, nicht das Körpergewicht.

Jede Person kann nur eigene Sätze einer offenen Einheit entfernen. Beenden gilt für beide und beendet sämtliche Freigaben. Die privaten Verläufe bleiben erhalten. Der Verlauf zeigt die letzten 500 eigenen Sätze aus beendeten Einheiten; bestehende Nose-Pushup-Verläufe bleiben getrennt und unverändert. Die Partneransicht wird bei geöffneter, sichtbarer Seite ungefähr alle fünf Sekunden aktualisiert; sie ist kein latenzfreier Echtzeitstream. Ein Widerruf sperrt weitere Serverabrufe sofort, bereits sichtbare Angaben verschwinden beim nächsten erfolgreichen Abgleich.

## Besuchskalender und Häufigkeit

Jedes Konto hat einen eigenen Kalender. Ein Gym-Tag zählt einmal, unabhängig von der Zahl der Sätze oder Einheiten. Ein erfolgreich gespeicherter Gym-Satz trägt den lokalen Besuchstag in derselben Datenbanktransaktion ein. Besuche können auch ohne Trainingspartner von Hand nachgetragen oder aus dem Kalender entfernt werden. Das Entfernen eines Besuchseintrags löscht keine Sätze oder Trainingshistorie.

Die Kalenderansicht markiert Besuchstage und zählt die aktuelle Woche (Montag bis Sonntag) sowie den angezeigten Monat. Datumsschlüssel sind lokale Kalendertage ohne UTC-Umdatierung. Die Datenbank erlaubt bei aktuellen Datumsangaben eine Tagesabweichung für Zeitzonen; die Oberfläche bietet keine zukünftigen Besuche an. Private Kalenderabfragen sind auf höchstens 366 Tage je Abruf begrenzt.

## Drei unabhängige Freigaben je Person

Alle Freigaben sind standardmäßig **aus**, gelten nur für die aktuelle gemeinsame Einheit und sind einzeln widerrufbar:

1. **Einheiten-Stats:** Nur Summen der aktuellen Einheit – Sätze, Wiederholungen und Volumen. Keine Übungsnamen, einzelnen Sätze oder früheren Trainings.
2. **Wochen-/Monatszahlen:** Nur die Zahl der Gym-Tage der aktuellen Woche und des aktuellen Monats. Keine Datumsliste.
3. **Konkrete Besuchstage:** Nur die Besuchstage des aktuellen Monats. Daraus lässt sich die Anzahl zwangsläufig auch dann ableiten, wenn die Zahlenfreigabe aus ist; die Oberfläche erklärt das ausdrücklich.

Eine Freigabe der einen Person schaltet keine Freigabe der anderen Person ein. Kalender, frühere Trainings und Gesundheitsdaten werden nicht automatisch geteilt. Gym-Daten werden nicht automatisch an Mira, KI-Kontext oder KI-Werkzeuge übergeben. Die neue Implementierung ergänzt diese Kontextquellen nicht.

## Technische Sicherheitsgrenzen

Alle fünf neuen Tabellen haben RLS und keine direkten Lese- oder Schreibrechte für Browserrollen. Die vorgesehenen Zugriffe laufen ausschließlich über klar begrenzte, authentifizierte RPCs. Diese prüfen `auth.uid()`, schließen anonyme Konten aus und verwenden einen festen `search_path`. Der interne Snapshot-Serializer ist für Browserrollen nicht ausführbar.

Sitzungs-Row-Locks, kontobezogene Advisory-Locks und eine eindeutige aktive Mitgliedschaft verhindern konkurrierende dritte Teilnehmer und mehrere offene Einheiten pro Konto. Partner-Snapshots enthalten weder die Partner-Konto-ID noch einzelne Partner-Sätze. Besuchsfreigaben sind unabhängig von Satzfreigaben. Referenzdatum und freigegebener Monat können nicht beliebig in die Vergangenheit verschoben werden. Browser-Storage wird für die neuen privaten Gym-Daten nicht verwendet; ein Kontowechsel verwirft den UI-Zustand.

## Prüfung vor einer Freigabe

Automatische Prüfungen ohne App-Start:

```sh
npm test
npx tsc --noEmit
npm run lint
bash tests/gym-partner-local-db.sh
npm run build
```

Der Datenbanktest erzeugt einen eigenen temporären PostgreSQL-Cluster über einen lokalen Socket, wendet ausschließlich diese neue Migration an und entfernt den Cluster anschließend. Er verwendet keine Remote-Datenbank und keine bestehenden Fresh-Supabase-Artefakte. Voraussetzung sind lokale PostgreSQL-16-Werkzeuge unter `/usr/lib/postgresql/16/bin`.

Nach gesonderter Migration sind zusätzlich zwei echte Konten in getrennten Browserprofilen zu prüfen: Einladung und Kapazität; getrennte Sätze/Verläufe; standardmäßig leere Partner-Stats; jede der drei Freigaben einzeln, unabhängig und widerrufbar; kein Zugriff auf Partner-Einzelwerte; private Kalender und Besuchszählung; doppelte Sätze am selben Tag zählen einen Besuch; Beenden entfernt alle Freigaben; Dritte und Gastkonten erhalten keinen Zugriff. Die Website und lokale Vorschau werden in diesem Arbeitsauftrag ausdrücklich nicht gestartet oder bedient.
