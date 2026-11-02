# Admin-only-Spiele — lokaler Änderungsvorschlag

Dieser Branch enthält einen **nicht veröffentlichten lokalen Vorschlag** für Grid Defense und Kupferkern. Die Spiele sind ausschließlich für Konten mit `has_global_role('admin')` gedacht.

## Schutzmodell

Die Startseitenkacheln erscheinen nur nach `getAdminAreaAccess()`. Die direkte `/games`-Route wiederholt die serverseitige Prüfung. Unabhängig davon verlangt die POST-Serverfunktion für jedes Spiel ein durch `requireSupabaseAuth` geprüftes JWT, lehnt anonyme Nutzer ab und fragt `has_global_role('admin')` in genau diesem authentifizierten Supabase-Kontext ab. Bei fehlender Rolle, RPC-Fehlern oder Netzwerkfehlern wird kein Spielinhalt geladen.

Die HTML-Dateien liegen in `private-game-preview/` außerhalb von `public/`. Nur die serverseitige Funktion importiert sie als Raw-Text; nach erfolgreicher Rollenprüfung liefert sie den Inhalt in ein `sandbox="allow-scripts"`-`srcDoc`-Iframe. Beide Dokumente besitzen eine restriktive CSP-Meta-Policy und nutzen keine externen Ressourcen oder Netzwerkverbindungen. Der bisherige ungeschützte Loopback-Server und sein Startskript sind aus diesem Vorschlag entfernt.

## Lokale Prüfungen

`npm test` prüft Admin-, Nicht-Admin- und anonymen Zugriff, den direkten Route- und Serverfunktionsschutz sowie das Fehlen der Dokumente im öffentlichen Ordner. Nach `npm run build` durchsucht `tests/private-games-build.test.ts` zusätzlich `.output/public` nach eindeutigen Markern beider Spiel-Payloads; derselbe Test ist Teil von `npm test`.

## Vor jeder Live-Freigabe

Die read-only Prüfung des exakten Lovable-Projekts `40995ef3-9b15-4ba7-9ebb-89713e15105b` bestätigte die zugehörige Datenbank `dbnlybjlswuvxrccgqah`, `public.global_role_assignments`, `public.has_global_role(text)` und mindestens eine Admin-Zuweisung. Dieser Vorschlag ändert keine Datenbank, Rolle oder Zuweisung.

Bei Logout oder erkanntem Kontowechsel wird die Spielansicht fail-closed geleert. Die Home-Admin-Kacheln und die geöffnete Spielseite prüfen die Rolle alle fünf Sekunden; auf der Spielseite wird zusätzlich bei Rückkehr in den Vordergrund neu geprüft. Ein negatives oder fehlerhaftes Ergebnis entfernt das iframe sofort. Die aktuelle Architektur liefert kein Push-Ereignis für eine Datenbank-Rollenentziehung: bis zur nächsten erfolgreichen Prüfung kann deshalb ein bereits angezeigtes Spiel noch sichtbar sein. Bereits an einen berechtigten Browser ausgelieferter Inhalt kann außerdem nicht nachträglich aus dessen Speicher zurückgerufen werden.

Vor einer Veröffentlichung muss der konkrete Commit samt Payload geprüft werden. Rechte-, Marken-, Text- und Gestaltungsprüfungen bleiben offen. Es wurde nichts gepusht, gemergt, veröffentlicht oder live aktiviert.
