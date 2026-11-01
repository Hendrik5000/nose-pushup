# Freunde, Postfach, Nexus Chat und Anrufe – Einrichtung

Stand: 2026-10-30. Alle Migrationen sind lokale Kandidaten. Sie wurden auf keiner Remote-Datenbank angewendet. Das Anwenden erfolgt nur nach ausdrücklicher Freigabe durch Hendrik.

## Was die Funktion tut

- Freunde werden über einen Freundescode (8 Zeichen, Anzeige `XXXX-XXXX`) hinzugefügt. Die Einladung landet im Postfach der anderen Person und muss dort angenommen werden.
- Das Postfach (`/postfach`, Glocke in Home und Nexus) enthält Freundesanfragen, Annahmen, Battle-Einladungen, Battle-Annahmen und verpasste Anrufe.
- Battle: Im Liegestütz-Battle genügt ein Klick auf den Freund. Die eingeladene Person erhält ein Popup mit Annehmen oder Ablehnen.
- Nexus Chat: Direktnachrichten gibt es nur mit angenommenen Freunden. Bilder (JPEG, PNG, WebP, GIF, bis 5 MB) und Audio-/Videoanrufe nur im Cloud-Modus.
- Die frühere Namenssuche nach Fremden wurde durch den Code-Ablauf ersetzt.

## Voraussetzung: Nexus-Basisschema

Am 2026-10-30 antwortete die Datenbank `dbnlybjlswuvxrccgqah` (per öffentlichem REST-Endpunkt mit dem Publishable Key geprüft) für `rooms`, `messages` und `friend_codes` mit PGRST205 (Tabelle nicht im Schema-Cache). Deshalb bleibt Nexus Chat im lokalen Modus („Nur auf diesem Gerät gespeichert“), bis mindestens `20261019010000_nexus_chat_schema.sql` angewendet ist. Alle neueren Migrationen (ab `20261019013000`) prüfen, ob sie bereits live vorhanden sind.

## Migrationsreihenfolge

0. `20261019010000_nexus_chat_schema.sql` (Basis: `rooms`, `messages`, Reaktionen; Voraussetzung für 3 bis 6)
1. `20261026090000_friendships_unordered_pair_index.sql`
2. `20261026093000_friend_battle_invitations.sql` (bestehend)
3. `20261030100000_friend_codes_postfach.sql`
4. `20261030110000_nexus_friend_chat_images.sql`
5. `20261030120000_friend_calls.sql`
6. `20261030130000_friend_public_profiles.sql`

Wird die Battle-Migration erst nach der Postfach-Migration angewendet, danach einmal ausführen: `SELECT public.postfach_install_battle_bridge();`

## Prüfung

- `tests/friends-chat-calls-local.sql` (Abschnitte 1 bis 10) lief gegen ein lokales PostgreSQL 17 mit der Migrationskette; Ergebnis: alle Assertions bestanden. Die Kette meldet einen bereits vorhandenen Fehler in `20260808165102` (doppelte `push_subscriptions`-Migration), der nicht aus dieser Arbeit stammt.
- `tests/friends-chat-calls-local-db.sh` ist eine psql-Variante (`PG_BIN` überschreibbar). Sie wurde nicht ausgeführt, weil psql in der Entwicklungsumgebung fehlte.
- Clientlogik ist mit Unit-Tests und Fakes abgedeckt (`tests/friend-code.test.ts`, `friends-client.test.ts`, `postfach.test.ts`, `nexus-images.test.ts`, `calls.test.ts`).
- Echte Geräte, echte Anrufe und echte Bild-Uploads wurden nicht getestet.

## Umgebungsvariablen für Anrufe und Cloud-Push

- `VITE_STUN_URLS` – kommagetrennte STUN-Server (Standard vorhanden).
- `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` – alle drei nötig, damit TURN genutzt wird. Ohne TURN können Anrufe in manchen Mobilfunknetzen scheitern.
- `VITE_VAPID_PUBLIC_KEY` – gültiger, base64url-kodierter, unkomprimierter P-256-Public-Key für den Browser-Build. In Lovable sind `VITE_`-Namen im Secret-Speicher nicht erlaubt; der ausschließlich öffentliche Wert liegt deshalb in `.env.production`. Diese Datei darf niemals einen Private-Key enthalten.
- Serverseitig müssen `VAPID_PUBLIC_KEY` (derselbe Public-Key) und das passende `VAPID_PRIVATE_KEY` gesetzt sein. Der Private-Key bleibt ausschließlich serverseitig und darf nie als `VITE_`-Variable veröffentlicht werden.
- Fehlt der Public-Key oder ist er kein gültiger P-256-Punkt, stoppt die App vor `PushManager.subscribe()` und zeigt einen Konfigurationshinweis. Cloud-Push wird erst mit einem zusammengehörigen Schlüssel-Paar ausgeliefert.

## Grenzen

- **Codepfad für Nexus-Cloud-DMs/Gruppen:** Push geht an aktuelle Gesprächsmitglieder mit aktivem Cloud-Push-Abo. Die Serverfunktion prüft Absender und Mitgliedschaft; die Push-Mitteilung enthält keinen Nachrichtentext.
- Öffentliche Räume haben keine eigene Mitgliedschafts- oder Abo-Funktion. Dort gibt es Realtime-Toasts/Browserbenachrichtigungen nur solange die App geöffnet ist; bei geschlossener App keinen Raum-Push.
- Cloud-Push setzt ein aktives Browser-Abo, passende serverseitige VAPID-Schlüssel und ein remote angewendetes Nexus-Schema voraus. Diese Remote-/Geräteabnahme wurde nicht durchgeführt; laut Stand 2026-10-30 fehlen die Nexus-Migrationen remote.
- Solange die Migrationen fehlen, zeigt die App Hinweise wie „noch nicht eingerichtet“, statt zu scheitern.
- Zusätzlich fehlte die RPC `get_friend_public_profiles` (vom Battle-Client genutzt) in allen Migrationen; sie ist in Migration 6 enthalten.

## Einspielen ohne Lovable-Chat

Die Datei `docs/lovable/nexus-freunde-komplett.sql` enthält die Migrationen 20261019010000, 20261020210000 und alle neuen in der richtigen Reihenfolge. Sie läuft im Lovable-SQL-Editor (Mehr, Database, Manage, SQL editor) und braucht keinen Chat. Auf einer lokalen PostgreSQL-17-Kopie ohne die Nexus-Tabellen lief sie einmal fehlerfrei durch. Ein zweiter Lauf scheitert an der bestehenden Battle-Migration (Tabelle existiert schon); sie also nur einmal ausführen. Migrationsdateien, die per Git ins Repo kommen, führt Lovable nicht selbst aus.
