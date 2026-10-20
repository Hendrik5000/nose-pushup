# Gym zu zweit: Einrichtung und Datenschutz

## Noch nicht auf Produktion aktiviert

Die Erweiterung liegt in `supabase/migrations/20261020200000_gym_partner.sql`. Sie wird in diesem Änderungssatz **nicht auf die Remote-/Produktionsdatenbank angewendet**. Vor dem produktiven Einsatz muss diese Migration nach gesonderter Prüfung über den üblichen Deployment-Prozess eingerichtet werden. Nur die Oberfläche in Lovable zu veröffentlichen reicht dafür nicht aus. Bis dahin zeigt die App einen verständlichen Einrichtungshinweis statt Testdaten.

Nose-Pushup, Mira, Nexus Chat, Navigation und Designoptionen bleiben bestehen. Der neue Bereich „Gym · Zu zweit“ ist in die bestehende Trainingsstartseite integriert. Es gibt keine neue Route und keine Änderungen an generierten Supabase-Typen.

## Gemeinsam trainieren

Beide Personen brauchen ein eigenes registriertes Konto; Gastkonten sind ausgeschlossen. Einer erstellt eine Einheit und gibt den zufälligen Einladungscode persönlich weiter. Der Code gilt 15 Minuten und ist nach dem Beitritt verbraucht. Genau zwei Konten können teilnehmen. Pro Konto ist nur eine offene Einheit möglich.

Nach dem Beitritt erfasst jeder seine eigenen Übungen, Sätze, Wiederholungen und Gewichte. Unterstützt werden 1–1000 Wiederholungen, 0–1000 kg in 0,25-kg-Schritten und maximal 500 Sätze pro Person und Einheit. Ohne Zusatzgewicht werden 0 kg eingetragen. Das Volumen ist das eingetragene Gewicht mal Wiederholungen, nicht das Körpergewicht.

Jede Person kann nur eigene Sätze einer offenen Einheit entfernen. Beenden gilt für beide und beendet sämtliche Freigaben. Die privaten Verläufe bleiben erhalten. Der Verlauf zeigt die letzten 500 eigenen Sätze aus beendeten Einheiten; bestehende Nose-Pushup-Verläufe bleiben getrennt und unverändert. Die Partneransicht wird bei geöffneter, sichtbarer Seite ungefähr alle fünf Sekunden aktualisiert; sie ist kein latenzfreier Echtzeitstream. Ein Widerruf sperrt weitere Serverabrufe sofort, bereits sichtbare Angaben verschwinden beim nächsten erfolgreichen Abgleich.

## Konto löschen: Partnerverlauf behalten und trennen

Beim tatsächlichen Löschen eines Kontos aus `auth.users` werden alle betroffenen Gym-Einheiten beendet, ihre Einladungscodes entfernt, sämtliche Freigaben ausgeschaltet und die aktiven Mitgliedschaften beider Personen freigegeben. Das gilt auch dann, wenn das gelöschte Konto die Einheit erstellt hat. Bereits beendete Einheiten behalten ihren ursprünglichen Abschlusszeitpunkt.

Die Mitgliedschaften, Aliasse, Sätze und Besuchstage des gelöschten Kontos werden über Fremdschlüssel entfernt. War es der Host, wird zusätzlich die Host-Konto-ID auf `NULL` gesetzt. Es wird kein Ersatzkonto eingesetzt; weder Konto-ID noch Alias des gelöschten Kontos werden in den Verlauf kopiert. Die verbleibende Person behält ihre eigenen Sätze mit unveränderten IDs, Werten, Zeitstempeln und Einheiten-Zuordnung sowie ihren eigenen Besuchskalender. Ihr Verlauf bleibt ausschließlich über die bestehende private Verlaufs-RPC abrufbar (höchstens 500 Sätze); eine neue Einheit kann unmittelbar erstellt werden. Werden später beide Konten gelöscht, bleiben keine ihrer Mitgliedschaften, Sätze oder Besuchstage zurück; ein geschlossener Einheiten-Datensatz ohne Host und Mitglieder kann bestehen bleiben.

Die Bereinigung läuft als interner `BEFORE DELETE`-Trigger mit festem `search_path` in derselben Transaktion wie die Kontolöschung. Fehler oder ein Rollback setzen auch die Bereinigung zurück. Browserrollen dürfen weder den Trigger direkt ausführen noch Konten löschen; bestehende RLS- und RPC-Grenzen bleiben erhalten. Gleichzeitige Gym-RPCs und die Bereinigung sperren die betroffenen Einheiten. Bei einem Datenbankfehler oder Deadlock muss der aufrufende Löschdienst die gesamte fehlgeschlagene Transaktion behandeln; Teilbereinigungen werden nicht bestätigt. Die Migration muss mit einer Rolle eingerichtet werden, die insbesondere den Trigger auf `auth.users` anlegen darf. Der Eigentümer der Definer-Funktion benötigt außerdem die nötigen Gym-Tabellenrechte und muss deren RLS umgehen können (wie der Tabelleneigentümer ohne erzwungene RLS). Diese lokale Prüfung ersetzt keinen späteren, gesondert freizugebenden Test mit der echten Supabase-Auth-Umgebung und deren weiteren Triggern. Soft-Delete oder bloßes Sperren eines Kontos löst diesen SQL-Delete-Trigger nicht aus.

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

`tests/gym-account-deletion.sql` wird dabei zusätzlich ausgeführt: Host- und Partnerlöschung, aktive und abgeschlossene Einheiten, abgelaufene oder offene Einladungen, unveränderter privater Partnerverlauf und Kalender, erneute Einheit, Rechte/RLS sowie atomare Rücknahme bei Rollback und Fehlern. Die Auth-Tabellen und JWT-Helfer sind im temporären Cluster minimale lokale Testnachbildungen, kein vollständiger Supabase-Stack.

`tests/gym-account-deletion-concurrency.sh` prüft zusätzlich zwei überlappende Transaktionen: Ein vor der Hostlöschung gespeicherter Partnersatz bleibt erhalten; ein nach der Hostlöschung wartender Speicherversuch wird ohne Teilschreibvorgang abgelehnt. Das Testskript prüft außerdem den vollständigen Rollback der Migrations-DDL einschließlich Auth-Trigger und installiert sie anschließend in einer einzigen lokalen Transaktion.

Der zur Freigabe maßgebliche Inhalt ist die vollständige SQL-Datei, nicht nur ein Diff. Ihre exakte SHA-256-Prüfsumme lässt sich mit `sha256sum supabase/migrations/20261020200000_gym_partner.sql` ermitteln. Eine spätere Änderung der Datei erfordert eine neue Prüfsumme und Freigabe. Es wird hier weder eine Remote-Migration ausgeführt noch eine Website veröffentlicht.

Nach gesonderter Migration sind zusätzlich zwei echte Konten in getrennten Browserprofilen zu prüfen: Einladung und Kapazität; getrennte Sätze/Verläufe; standardmäßig leere Partner-Stats; jede der drei Freigaben einzeln, unabhängig und widerrufbar; kein Zugriff auf Partner-Einzelwerte; private Kalender und Besuchszählung; doppelte Sätze am selben Tag zählen einen Besuch; Beenden entfernt alle Freigaben; Dritte und Gastkonten erhalten keinen Zugriff. Die Website und lokale Vorschau werden in diesem Arbeitsauftrag ausdrücklich nicht gestartet oder bedient.
