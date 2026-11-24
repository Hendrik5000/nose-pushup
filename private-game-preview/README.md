# Alo-Spiele: Admin-geschützter Zugriff

## Zugriff und Auslieferung

Die Route `/games` liegt im authentifizierten App-Bereich und ist nur für Konten mit der bestehenden Admin-Rolle verfügbar. Das Home-Raster zeigt Spielkacheln ebenfalls nur nach bestätigter Adminprüfung; Marketplace-Einträge sind als Admin-only gekennzeichnet. Serverseitig wird jedes Spieldokument über die vorhandene geschützte Serverfunktion mit `requireSupabaseAuth`, `withAdminGameAccess` und der Rolle `admin` abgerufen. Die Prüfung verweigert Zugriff bei anonymem Nutzerstatus, Rollenfehlern oder fehlender Adminrolle.

Die private Serverfunktion akzeptiert ausschließlich die vier festgelegten IDs `grid-defense`, `kupferkern`, `neon-starfighter` und `chess`. Der strikte Validator verwirft unbekannte Werte; es gibt keine dynamische Dateipfadauswahl. Antworten sind `private, no-store` und setzen `X-Content-Type-Options: nosniff`.

Die eigenständigen HTML-Quellen liegen in `private-game-preview/`, nicht in `public/`. Build-Ausgaben sollen keine dieser Spieldateien als statische öffentliche Website-Assets ausliefern. Jede HTML-Datei wird ausschließlich nach Authentifizierung und erfolgreicher Adminprüfung von der Serverfunktion geladen.

Die Dokumente laufen als `srcDoc` in einem `sandbox="allow-scripts"`-Iframe ohne `allow-same-origin`. Die bestehenden Content-Security-Policies und Sandbox-Grenzen bleiben erhalten. Diese Änderung nimmt keine Datenbank-, Migration-, RLS-/Policy-, Secret- oder geschützte Supabase-Konfigurationsänderung vor.

## Grenzen und Status

Die Home-Kacheln sind eine Komfortmaßnahme und ersetzen keine Serverprüfung. Auch ein direkter Aufruf der URL oder der Serverfunktion muss an Authentifizierung und Adminrolle scheitern. Bereits in einem aktiven Tab geladener Inhalt kann erst bei einer erneuten Zugriffsprüfung verborgen werden; ein sofortiger Widerruf auf dem Gerät wird nicht behauptet.

Ein Merge, eine Produktionsveröffentlichung und ein Lovable-Publish sind getrennte Schritte. Diese Dokumentation behauptet keinen dieser Schritte; der tatsächliche PR-, CI-, Merge- und Live-Status wird im Projektregister und in der Roadmap nachgetragen.
