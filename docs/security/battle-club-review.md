# Sicherheitsfix für Battles und Clubs

**Noch nicht live.** Der Code und das SQL werden getrennt geprüft. Die Live-Datenbank wird erst nach Hendriks Bestätigung der endgültigen, unten verlinkten SQL-Datei geändert. Der bestehende Originalcheckout bleibt unangetastet.

Der [separate Draft-PR #122](https://github.com/Hendrik5000/nose-pushup/pull/122) enthält den geprüften Feature-Code-Commit `e8e8893c7222b43ca86076742a0bd6b2b8fc53bb`, das vollständige SQL und die Tests. Der jeweils aktuelle GitHub-CI-Status steht dort; der PR bleibt vor der gesonderten DB-Freigabe unge-mergt.

## Was sich für dich ändert

Private Battles und Clubs bekommen **32-stellige, kryptografisch zufällige Einladungscodes** statt kurzer, mit `Math.random()` erzeugter Codes. Die App zeigt sie in lesbaren Gruppen und bietet „Code kopieren“. Ein eingefügter Code darf Leerzeichen oder Bindestriche enthalten. Wer einen solchen Code bewusst erhält, kann weiterhin beitreten; es wird kein neuer Genehmigungs- oder Kontaktzwang eingeführt. Codes bleiben vertrauliche, weitergebbare Einladungen. Persönliche Freundes-Battle-Einladungen bleiben dagegen an ihren bisherigen Empfänger gebunden.

Die Datenbank zählt selbst höchstens **acht Beitrittsversuche pro Nutzer und Bereich innerhalb von 60 Sekunden**. Das gilt auch für direkte API-Aufrufe und den alten Club-Endpunkt. Gleichzeitige Aufrufe können das Limit nicht umgehen. Zwei gleichzeitige Gäste können nicht denselben Battle-Platz beanspruchen; ein Club wird bei gleichzeitigem Beitritt nicht über seine bisherige Grenze von 30 Mitgliedern gefüllt.

Öffentliche Gegnersuche und private Einladungen werden getrennt. Alte Battles gelten zunächst als privat. Die öffentliche Suche vermittelt ausschließlich ausdrücklich öffentliche, wartende Nicht-Bot-Battles. Wiederholte Suchanfragen verwenden denselben eigenen Warteeintrag; ein Abbruch betrifft nur den eigenen öffentlichen Eintrag. Ist gerade schon ein Gegner hinzugekommen, wird das Match nicht gelöscht.

**Wichtige Folge:** Alle bisherigen Club-Codes und Codes noch wartender Battles werden ungültig und müssen neu geteilt werden. Bestehende Mitgliedschaften, Beiträge, Trainingsergebnisse und aktive beziehungsweise abgeschlossene Battle-Verläufe werden nicht gelöscht. Deren bisherige Codes werden nicht rotiert. Wartende, bereits persönlich zugewiesene Freunde behalten ihren Zugriff über die Battle-ID.

## Was tatsächlich geändert werden soll

Der vollständige ausführbare Review-Kandidat steht in [`battle-club-invite-payload.sql`](./battle-club-invite-payload.sql). Er ist **keine bereits angewandte Migration**. Er beginnt mit `BEGIN`, bricht bei unbekannten Tabellen-/Policy-/Grant-/Signaturzuständen ab und prüft vor `COMMIT` seine Sicherheitsbedingungen.

SHA-256 dieser endgültig lokal geprüften Fassung: `e0ebb59b2ca602084c94b31cbaa1add8acd0e44f334aea23da52715ea1638bb3`. Eine abweichende Fassung ist nicht von einer Freigabe dieses Payloads umfasst.

| Bereich | Konkrete Änderung |
| --- | --- |
| `public.battles` | Neue Spalte `is_private boolean NOT NULL DEFAULT true`. Nur Codes mit `status = 'waiting'` rotieren. Direkte Gast-Update-Policy `battles join as guest` entfernen und `UPDATE(guest_id)` für `authenticated` entziehen. |
| `battles insert as host` | Neue Einträge über normale Nutzerrechte nur mit eigenem `host_id`, ohne vorab eingetragenen Gast, im Zustand `waiting` und privat. Öffentliche Zuordnung nur über die geprüfte RPC. Die bestehende Teilnehmer-SELECT-Policy wird nicht erweitert. |
| `public.clubs` | Alle Einladungscodes rotieren; bestehende Club-Zeilen und ihre Mitglieder bleiben erhalten. Keine neue öffentliche Leseberechtigung. |
| `public.club_members` | Keine Tabellen-, Policy- oder Bestandsdatenänderung. Die vorhandene Owner-Selbstaufnahme bleibt; normale Beitritte erfolgen ausschließlich über die autorisierte RPC. |
| `public.join_attempt_ratelimit` | Neue interne Tabelle mit `user_id`, `scope`, höchstens acht Zeitstempeln und `updated_at`; höchstens zwei Bereichszeilen pro Nutzer. Nutzer, anonyme Besucher und `service_role` erhalten keinen direkten Tabellenzugriff. Löschung des zugehörigen Auth-Nutzers räumt die internen Zähler per Fremdschlüssel auf. `auth.users` selbst wird nicht verändert. |
| Vier Code-Trigger | Je ein `BEFORE INSERT`- und `BEFORE UPDATE OF code`-Trigger auf `battles` und `clubs`. Neue beziehungsweise tatsächlich geänderte Codes werden in der DB mit `gen_random_bytes(16)` erzeugt. Damit bleibt auch die vorhandene Freundes-RPC kompatibel, die intern noch einen kurzen Code übergibt. |

Die neuen öffentlichen RPCs leiten den handelnden Nutzer ausschließlich aus der überprüften Sitzung (`auth.uid()`) ab. Sie sperren anonyme Auth-Konten sowohl anhand des signierten JWT als auch anhand des vorhandenen, nicht anonymen `auth.users`-Eintrags, bevor ein Versuch gezählt wird. Es gibt keinen frei übergebbaren Nutzer-/Admin-Parameter und keinen Admin-Sonderweg. Sie sind nur für `authenticated` ausführbar und verwenden einen leeren `search_path` mit qualifizierten Objektverweisen:

- `join_battle_by_code(p_code text) → jsonb`: Code prüfen, Battle-Zeile sperren und genau einen freien Platz zuweisen. Liefert `battle_id`, `host_id` und `joined`; nur eine neue Zuweisung löst die optionale Gegnerbenachrichtigung aus.
- `find_public_battle_match(p_mode text, p_duration_s integer, p_target_reps integer) → jsonb`: ausschließlich öffentliche Gegnersuche; vorhandenen Warte-/Matchzustand des Nutzers wiederverwenden.
- `leave_public_battle_queue(p_battle_id uuid) → jsonb`: nur eigenen öffentlichen, nicht-Bot-Warteeintrag abbrechen oder ein inzwischen entstandenes Match bestätigen. Fremde/private IDs werden gleichförmig abgewiesen.
- `join_club_by_invite_code(p_code text) → jsonb`: Code und Kapazität unter Club-Zeilensperre prüfen; bereits bestehende Mitgliedschaft idempotent bestätigen.
- `join_club_by_code(_code text) → uuid`: vorhandene Signatur und Rückgabetyp erhalten. Sicherer Wrapper um denselben neuen Club-Beitritt; erwartete Fehler liefern `NULL`, damit gezählte Versuche nicht durch eine Exception zurückgerollt werden.

Interne Funktionen: `check_and_record_join_attempt(p_scope text) → boolean`, `trg_generate_secure_code_insert() → trigger`, `trg_generate_secure_code_update() → trigger`. Sie sind für normale, anonyme und Service-Rollen nicht direkt ausführbar. Der Zähler sperrt seine Nutzer-/Bereichszeile und ermittelt die Zeit erst nach Erhalt der Sperre. Die API liefert erwartete Fehler als normale Ergebnisse zurück; ausdrücklich zurückgerollte privilegierte SQL-Transaktionen werden dadurch nicht „rollbackfest“.

## Was geprüft ist – und was nicht

Ausgang ist [`main` nach PR #121, Commit `10de1488ab8fa6aa35d2926b2799640526bf4a4b`](https://github.com/Hendrik5000/nose-pushup/commit/10de1488ab8fa6aa35d2926b2799640526bf4a4b). [Lovable-Projekt Alo](https://lovable.dev/projects/40995ef3-9b15-4ba7-9ebb-89713e15105b) ist mit `Hendrik5000/nose-pushup`, Branch `main`, verbunden. Das Ziel ist ausschließlich das in `supabase/config.toml` festgeschriebene Supabase-Projekt **`dbnlybjlswuvxrccgqah`**, das auch Lovables Nur-Lese-Review nennt. Die verfügbaren Credits wurden vor der Vorbereitung nur lesend mit **5** angezeigt; vor einer tatsächlichen Anwendung müssen Zielprojekt, Commit und Credits erneut geprüft werden.

Die alten Lovable-Warnungen passen weiterhin zu den kurzen Codes und dem nur pro App-Prozess gespeicherten Versuchszähler. Lovable hat außerdem die Teilnehmer-SELECT-Policy und die Guest-Update-Policy berichtet. Ein erfolgreicher direkter Fremd-UPDATE ist damit **nicht automatisch bewiesen**: PostgreSQL wendet bei üblichen UPDATE-Abfragen zusätzlich die SELECT-Policy an ([offizielle PostgreSQL-16-Dokumentation](https://www.postgresql.org/docs/16/sql-createpolicy.html)). Das Entfernen der zu weit gefassten Guest-Policy ist zusätzliche Absicherung; die eigentlichen Code-/RPC-Pfade werden gesondert getestet.

**Bisherige lokale App-Prüfung:** Nach dem Produktionsbuild bestehen alle **599 Tests ohne Auslassung**, TypeScript und der synthetische Produktionsbuild. ESLint meldet null Fehler und 18 bereits vorhandene Warnungen. Es wurden keine echten Nutzer-/Provider-/Push-Aktionen ausgeführt. Abhängigkeiten stammen aus einem vorhandenen Paketbaum mit identischer Lockfile-Prüfsumme; der saubere GitHub-CI-Installationslauf bleibt ein Pflicht-Gate.

**Echte lokale PostgreSQL-16-Prüfung bestanden:** Der Runner erzeugt ausschließlich einen frischen temporären Cluster ohne TCP-Listener und verwendet einen privaten Unix-Socket. Geprüft sind getrennte Eigentümer, eingeladene Nutzer, Fremdnutzer, ein mit der unveränderten bestehenden Rollen-Migration ausgestatteter globaler App-Admin und anonyme Auth-Konten. Direkte Fremd-INSERTs und Guest-UPDATEs werden abgewiesen; Fremde können Club-Codes nicht auslesen. JWT- und Datenbank-Gastflags werden unabhängig geprüft. Bestehende empfängergebundene Freundeseinladungen und Mitgliedschaften bleiben erhalten; aktive und abgeschlossene Battle-Codes bleiben unverändert.

Unabhängige Verbindungen beweisen: genau ein Gastplatz bei doppeltem Battle-Beitritt, genau ein 30. Club-Mitglied, **acht gezählte Versuche und genau eine Sperre bei neun parallelen Anfragen**. Acht alte Club-RPC-Aufrufe sperren auch den neunten Aufruf der neuen API. Bereichs-/Kontotrennung und Ablauf des 60-Sekunden-Fensters bestehen. Öffentliche Suche, wiederholtes Polling, fremde/private Abbruch-IDs und beide kontrollierten Match-/Abbruch-Reihenfolgen bestehen. Befehl: `bash tests/invite-security-local-db.sh docs/security/battle-club-invite-payload.sql`.

Der unabhängige erste Gesamtreview fand eine Gastkonto-Lücke im Entwurf; sie wurde geschlossen und durch diese Datenbanktests nachgewiesen. Der gesonderte abschließende Nur-Lese-Review der Auth-Gates, Policy-Vorabprüfungen und Test-Races fand keinen bestätigten Blocker. Ein synthetisches lokales Fixture ersetzt weiterhin **keine Live-Katalog-, Produktions- oder Geräteabnahme**. Es gibt noch keine angewandte Migration und keinen aktuellen Scan, der die alten Warnungen als behoben bestätigt.

## Freigabe und sicherer Ablauf

1. Code, vollständiges SQL-Artefakt, Tests und genauer Diff kommen in **einen eigenen Security-PR**. Keine Responsive- oder Spielefreigabe darin.
2. Erst nach lokalem SQL-Nachweis, unabhängigem Review und grünen GitHub-Prüfungen wird Hendrik **dieser konkrete endgültige Payload mit Datei-Prüfsumme** zur einmaligen Live-Freigabe vorgelegt. Diese Fassung ist noch nicht freigegeben.
3. Nur Lovable darf daraus die append-only Migration anlegen und den bestätigten Payload anwenden. Bei abweichendem Projekt, Repository, Commit, SQL-Hash oder Vorabprüfung stoppen; keine automatische Anpassung des freigegebenen Payloads.
4. Abhängiger App-Code wird erst zusammen mit der bestätigten DB-Umstellung regulär gemergt. Der akzeptierte automatische Vercel-Produktionsdeploy wird am exakten Merge-Commit überprüft. Beim Wechsel können alte Clients kurzzeitig nicht mehr mit den alten Codes beitreten; sie müssen die aktualisierte App laden.
5. Lovable-Publish bleibt gesperrt, bis Projekt/Repo/`main`/Commit exakt stimmen und keine ungelösten Sicherheitshinweise mehr vorliegen. Kein „Fix all“ und kein ungeprüfter Publish.

Falls die SQL-Transaktion vor ihrem Commit scheitert, bleiben ihre Änderungen vollständig aus. Nach erfolgreichem Commit wird **kein unsicherer Zustand wiederhergestellt**: alte kurze Codes, die alte Guest-Policy oder der ungeschützte Club-Endpunkt werden nicht reaktiviert. Bei Problemen bleiben Beitritte lieber vorübergehend gesperrt; korrigierter Code beziehungsweise eine gesondert geprüfte Vorwärtsmigration stellen die Funktion wieder her. Bereits rotierte Codes werden nicht zurückgedreht.

Danach folgen separat die bereits beauftragte Tablet-/Desktop-Anpassung mit unveränderter Mobil-Baseline und erst anschließend die öffentliche Freigabe ausschließlich der beiden Spiele. Bis zu ihrem eigenen Auftrag bleibt deren Admin-Sperre unverändert.
