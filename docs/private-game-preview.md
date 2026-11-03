# Grid Defense und Kupferkern: öffentlicher Spielezugang

## Zugriff und Auslieferung

Die Route `/games` liegt außerhalb des angemeldeten Layouts und ist direkt ohne Alo-Konto erreichbar. Im angemeldeten Home erscheinen beide Spielkacheln für alle Nutzer; der separate Admin-Einstieg bleibt weiterhin von der vorhandenen serverbestätigten Adminprüfung abhängig.

Die öffentliche Serverfunktion akzeptiert ausschließlich die beiden festgelegten IDs `grid-defense` und `kupferkern`. Der strikte Validator verwirft unbekannte Werte; es gibt keine dynamische Dateipfadauswahl. Diese bewusst öffentliche Auslieferung enthält keine Nutzer-, Rollen- oder Kontodaten und ruft weder Supabase Auth noch eine Datenbank oder Rollen-RPC auf. Antworten werden nicht gespeichert und erhalten `X-Content-Type-Options: nosniff`.

Die eigenständigen HTML-Quellen liegen weiter in `private-game-preview/`, nicht in `public/`. Der Build soll sie nicht als statische Website-Assets ausliefern; nur die öffentliche, allowlistgebundene Serverfunktion liefert die Spiele an Besucher aus. Das ist beabsichtigte öffentliche Spielauslieferung, kein Schutz vor Kopieren oder Herunterladen.

Beide Dokumente laufen als `srcDoc` in einem `sandbox="allow-scripts"`-Iframe ohne `allow-same-origin`. Ihre Content-Security-Policy blockiert Netzwerkverbindungen und externe Assets. Datenbank, Auth-Provider-Konfiguration, Rollen, RLS und die vorhandene Admin-Serverfunktion wurden nicht geändert; diese bleibt für ihre eigenen Aufrufer fail-closed.

## Grenzen und Veröffentlichung

Die zwei Spiele laufen im Browser und verwenden für die Darstellung keine Anmeldung. Weil der Spielcode an öffentliche Besucher ausgeliefert wird, kann ein bereits geladener Spielinhalt nicht zurückgerufen werden. Die öffentliche Zusage gilt ausschließlich für Grid Defense und Kupferkern, nicht für andere Admin-Apps oder Bereiche.

Vor Merge oder Lovable-Veröffentlichung müssen die bestehenden ungeklärten Sicherheitsbefunde und die unerwartete „Veröffentlicht“-Anzeige separat geklärt werden. Dieser Feature-Branch wird nicht nach `main` gemergt und nicht veröffentlicht.

Diese Neufassungen sind keine rechtliche Freigabe. Vor einer Weitergabe oder Veröffentlichung sind eigenständige Rechte-, Marken-, Text- und Gestaltungsprüfungen erforderlich.
