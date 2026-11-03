# Admin-only-Spiele: Grid Defense und Kupferkern

## Zugriff und Auslieferung

Die Startseiten-Kachel erscheint erst nach einer erfolgreichen, serverseitigen Adminprüfung. Das ist nur die Navigation, nicht die Sicherheitsgrenze: Die `/games`-Route prüft die Rolle erneut, und der Inhalt jedes Spiels wird ausschließlich über eine authentifizierte Serverfunktion angefordert.

Die Serverfunktion akzeptiert nur die festgelegten Spiel-IDs, verlangt `requireSupabaseAuth`, lehnt fehlende oder anonyme Identitäten ab und prüft `has_global_role('admin')` im authentifizierten Supabase-Kontext. Bei fehlender Rolle, RPC-Fehlern oder einem sonstigen Fehler wird kein Spielinhalt geliefert. Antworten sind `private, no-store`.

Die eigenständigen HTML-Dateien liegen in `private-game-preview/`, nicht in `public/`. Sie werden nur serverseitig importiert und nach erfolgreicher Rollenprüfung als `srcDoc` in einem `sandbox="allow-scripts"`-Iframe ohne `allow-same-origin` angezeigt. Die Dokumente enthalten ihre eigene restriktive Content-Security-Policy und benötigen keine öffentlichen Asset-URLs.

## Revalidierung und Grenze bereits gelieferter Inhalte

Beim Identitätswechsel sowie beim Zurückkehren in den Vordergrund wird die vorhandene Spielansicht sofort geschlossen und die Rolle erneut geprüft. Ein fehlerhafter oder negativer Check bleibt gesperrt. Es gibt bewusst kein periodisches Polling während eines laufenden Spiels, damit die Spielfläche nicht ständig neu geladen wird. Jede erneute Route oder Inhalt-Anforderung wird weiterhin serverseitig autorisiert.

Ein bereits an einen Admin-Browser ausgeliefertes HTML-Dokument kann technisch nicht nachträglich aus dessen Speicher zurückgerufen werden. Ohne ein serverseitiges Push-/Widerrufssystem kann eine Rollenentziehung in einem dauerhaft geöffneten Tab erst bei der nächsten Revalidierung erkannt werden. Die Autorisierung der Auslieferung selbst bleibt serverseitig und fail-closed.

## Spielinhalt und Veröffentlichung

Enthalten sind zwei eigenständige, lokal ausgeführte Spiele: **Grid Defense**, ein Tower-Defense-Spiel, und **Kupferkern**, ein Energiepfad-Puzzle. Es werden keine Datenbank-, Auth-, Rollen- oder Vercel-Einstellungen geändert. Fehlt die bestehende serverseitige Admin-Rollenbasis oder schlägt die Prüfung fehl, bleiben beide Spiele gesperrt; es wird dafür keine Datenbankänderung nachgeschoben.

Vor einer Lovable-Veröffentlichung müssen das Lovable-Projekt `40995ef3-9b15-4ba7-9ebb-89713e15105b`, das Repository `Hendrik5000/nose-pushup`, der Branch `main` und der exakte veröffentlichte Commit eindeutig übereinstimmen. Ein Lovable-Sicherheitsblocker wird nicht umgangen.
