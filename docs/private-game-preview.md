# Private Spielvorschauen lokal starten

Der authentifizierte Alo-Spielebereich enthält zwei getrennte, standardmäßig gesperrte Vorschauen: **Grid Defense**, ein neu geschriebener klassischer Tower-Defense-Prototyp mit Rasterkarte, automatisch feuernden Türmen und Wellen, sowie **Kupferkern**, ein eigenständiges Energiepfad-Puzzle. Beide sind nur während der lokalen Entwicklung und nach ausdrücklichem Öffnen verfügbar.

## Starten

Starte Alo mit `npm run dev`. In einem zweiten Terminal startest du `npm run dev:private-game`. Der Spielserver bindet fest an `127.0.0.1` und Port `8787`, liefert ausschließlich die lokale HTML-Seite aus und setzt eine Content-Security-Policy, die externe Netzwerk-, Medien- und Frame-Zugriffe blockiert. Öffne Alo lokal, melde dich an und wähle auf Home die gewünschte private Spielkachel. Auf der Sperrseite musst du anschließend ausdrücklich **Lokale Vorschau öffnen** wählen.

Falls Alo über `127.0.0.1` statt `localhost` läuft, bleibt der Standard korrekt. Für einen anderen lokalen Port setzt du `ALO_PRIVATE_GAME_PORT` beim Start des Spielservers und passt `VITE_PRIVATE_GAME_PREVIEW_URL` vor dem Start von Vite auf dieselbe lokale URL an. Die Spiel-Origin muss eine Loopback-Adresse und von der Alo-Origin verschieden sein; ein gleich-originiges oder nicht-lokales Ziel wird nicht eingebettet.

## Grenzen und Freigabe

`private-game-preview/grid-defense.html` ist eine eigenständige, selbst enthaltene HTML-/Canvas-Implementierung. Sie lädt keine externen Grafiken, Fonts, Sounds oder Skripte, spricht kein Netzwerk an und speichert keinen Spielstand. Die Datei liegt außerhalb von `public/` und `src/` und wird nicht in den Alo-Produktionsbuild importiert. Der Zusatzserver startet nicht beim normalen Alo-Start und lauscht nicht auf einer LAN- oder öffentlichen Schnittstelle. Das Spiel läuft mit Sandbox-Attributen in einem Iframe auf einer getrennten lokalen Origin.

Die zweite Kachel öffnet nur das lokale Kupferkern-Puzzle. `?preview=local` reicht in einem Produktionsbuild nicht zum Freischalten. Dies ist ausschließlich eine lokale Entwicklungsvorschau, keine öffentliche Bereitstellung.

Die Neufassung und ihre Gestaltung stellen **keine rechtliche Freigabe** dar. Rechte-, Marken-, Text- und Gestaltungsprüfungen bleiben vor jeder Weitergabe oder Veröffentlichung offen. Nicht veröffentlichen, deployen, mergen oder pushen.
