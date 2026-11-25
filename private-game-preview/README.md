# Alo-Spiele: geschützter Zugriff für angemeldete Nutzer

## Zugriff und Auslieferung

Die Route `/games` liegt im authentifizierten App-Bereich. Die vier Spiele und ihre Home-Kacheln sind für angemeldete, nicht-anonyme Alo-Nutzer verfügbar; eine Admin-Rolle ist dafür nicht erforderlich. Andere Admin-Funktionen bleiben geschützt. Serverseitig wird jedes Spieldokument über die vorhandene geschützte Serverfunktion mit `requireSupabaseAuth` und `withAuthenticatedGameAccess` abgerufen. Die Prüfung verweigert Zugriff bei fehlender Authentifizierung oder anonymer Sitzung.

Die private Serverfunktion akzeptiert ausschließlich die vier festgelegten IDs `grid-defense`, `kupferkern`, `neon-starfighter` und `chess`. Der strikte Validator verwirft unbekannte Werte; es gibt keine dynamische Dateipfadauswahl. Antworten sind `private, no-store` und setzen `X-Content-Type-Options: nosniff`.

Die eigenständigen HTML-Quellen liegen in `private-game-preview/`, nicht in `public/`. Build-Ausgaben sollen keine dieser Spieldateien als statische öffentliche Website-Assets ausliefern. Jede HTML-Datei wird ausschließlich nach erfolgreicher Authentifizierung und Ablehnung anonymer Sitzungen von der Serverfunktion geladen.

Die Dokumente laufen als `srcDoc` in einem `sandbox="allow-scripts"`-Iframe ohne `allow-same-origin`. Die bestehenden Content-Security-Policies und Sandbox-Grenzen bleiben erhalten. Diese Änderung nimmt keine Datenbank-, Migration-, RLS-/Policy-, Secret- oder geschützte Supabase-Konfigurationsänderung vor.

## Grenzen und Status

Die Home-Kacheln sind eine Komfortmaßnahme und ersetzen keine Serverprüfung. Auch ein direkter Aufruf der URL oder der Serverfunktion darf ohne gültige, nicht-anonyme Anmeldung keinen Zugriff gewähren. Bereits in einem aktiven Tab geladener Inhalt kann erst bei einer erneuten Zugriffsprüfung verborgen werden; ein sofortiger Widerruf auf dem Gerät wird nicht behauptet.

Ein Merge, eine Produktionsveröffentlichung und ein Lovable-Publish sind getrennte Schritte. Diese Dokumentation behauptet keinen dieser Schritte; der tatsächliche PR-, CI-, Merge- und Live-Status wird im Projektregister und in der Roadmap nachgetragen.
