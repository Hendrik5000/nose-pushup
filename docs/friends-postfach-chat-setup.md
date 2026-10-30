# Freunde, Postfach, Nexus Chat und Anrufe – Einrichtung

Stand: 2026-10-30. Alle Migrationen sind lokale Kandidaten. Sie wurden auf keiner Remote-Datenbank angewendet. Das Anwenden erfolgt nur nach ausdrücklicher Freigabe durch Hendrik.

## Was die Funktion tut

- Freunde werden über einen Freundescode (8 Zeichen, Anzeige `XXXX-XXXX`) hinzugefügt. Die Einladung landet im Postfach der anderen Person und muss dort angenommen werden.
- Das Postfach (`/postfach`, Glocke in Home und Nexus) enthält Freundesanfragen, Annahmen, Battle-Einladungen, Battle-Annahmen und verpasste Anrufe.
- Battle: Im Liegestütz-Battle genügt ein Klick auf den Freund. Die eingeladene Person erhält ein Popup mit Annehmen oder Ablehnen.
- Nexus Chat: Direktnachrichten gibt es nur mit angenommenen Freunden. Bilder (JPEG, PNG, WebP, GIF, bis 5 MB) und Audio-/Videoanrufe nur im Cloud-Modus.
- Die frühere Namenssuche nach Fremden wurde durch den Code-Ablauf ersetzt.

## Migrationsreihenfolge

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

## Optionale Umgebungsvariablen für Anrufe

- `VITE_STUN_URLS` – kommagetrennte STUN-Server (Standard vorhanden).
- `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` – alle drei nötig, damit TURN genutzt wird. Ohne TURN können Anrufe in manchen Mobilfunknetzen scheitern.

## Grenzen

- Kein Push, wenn die App geschlossen ist. Einladungen und Anrufe erscheinen nur bei geöffneter App (Realtime, 30-Sekunden-Abfrage, Fokus-Aktualisierung).
- Solange die Migrationen fehlen, zeigt die App Hinweise wie „noch nicht eingerichtet“, statt zu scheitern.
- Zusätzlich fehlte die RPC `get_friend_public_profiles` (vom Battle-Client genutzt) in allen Migrationen; sie ist in Migration 6 enthalten.
