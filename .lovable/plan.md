# Vollbild-App, Android-Paket, Theme-Fix & nächste 5 Updates

## 1. Schwarze Balken oben/unten entfernen (Chrome Web-App)

Aktuell startet die installierte App im Standalone-Modus, zeichnet aber nicht hinter Status- und Navigationsleiste. Dadurch bleiben schwarze Streifen stehen.

- Viewport auf randlose Darstellung umstellen (`viewport-fit=cover`), damit die App bis in die Systemleisten zeichnet.
- Statusleisten-Farbe dynamisch an das aktive Theme koppeln, statt fest `#0b0b0f`; die Leisten verschmelzen dann mit dem Hintergrund.
- Manifest auf randlose Anzeige mit Fallback umstellen und die Hintergrundfarbe an das Standard-Theme angleichen.
- Sichere Ränder überall respektieren: oberer Abstand für Kopfbereiche, unterer bereits vorhandener Abstand der Tab-Leiste bleibt erhalten, damit nichts unter der Gestensteuerung verschwindet.
- Zusätzlich passende Icon-Größen (192/512, maskable) bereitstellen, damit Android das Icon nicht beschneidet.

## 2. Theme wird erst nach Profilbesuch übernommen – Fix

Ursache: Beim App-Start wird nur das lokal gespeicherte Theme angewendet. Das im Konto gespeicherte Theme wird erst geladen, wenn die Profilseite die Auswahl-Komponente rendert. Auf einem neuen Gerät (oder nach dem Installieren als App) sieht man daher zuerst das Standard-Design.

- Beim App-Start nach dem Anmelden das Theme des Kontos laden und sofort anwenden, ohne dass die Profilseite geöffnet werden muss.
- Nach Anmeldung/Kontowechsel erneut abgleichen, damit ein Gerätewechsel dieselben Farben zeigt.
- Lokaler Speicher bleibt als Sofort-Anzeige beim ersten Frame erhalten (kein Aufblitzen).

## 3. Vorbereitung für eine .aab-Datei über das Windows-Terminal

Die App wird als vertrauenswürdige Web-App (TWA) verpackt – Google Bubblewrap erzeugt daraus ein Android-App-Bundle.

- Digital-Asset-Links-Datei unter `/.well-known/assetlinks.json` als öffentliche Route bereitstellen, damit Android die Domain der App zuordnet und keine Browserleiste anzeigt.
- Manifest so ergänzen, dass Bubblewrap alles findet: eindeutige ID, Sprache, Kategorien, Screenshots-Feld, `prefer_related_applications: false`.
- Eine kurze Anleitung als `ANDROID.md` im Projekt: Node installieren, `npm i -g @bubblewrap/cli`, `bubblewrap init --manifest https://<domain>/manifest.webmanifest`, `bubblewrap build` → `app-release-bundle.aab`, plus wo der SHA-256-Fingerprint des Keystores herkommt und wie er in die Asset-Links kommt.
- Hinweis: Der Fingerprint entsteht erst beim Erstellen des Keystores auf deinem PC; ich hinterlege ihn als Platzhalter, den du einmalig einträgst (oder du nennst ihn mir, dann trage ich ihn ein).

## 4. Die nächsten 5 großen Updates

1. **Engagement-Loop**: 3-Schritt-Onboarding beim ersten Start, Streak-Erinnerung am Abend, sichtbare Streak-Rettung, Wochenrückblick als teilbare Karte, Ladeskelette statt leerer Listen.
2. **Battles 2.0**: Revanche-Button, Bilanz pro Gegner, öffentliche Lobby mit Zufalls-Matchmaking, neue Modi („Erster auf 30", Ausdauer-Duell).
3. **Coach als Trainingsbegleiter**: Wochenplan aus Level, Streak und Körperdaten, Tagesziel-Karte auf der Startseite, automatische Anpassung bei Pausen, „Wie war meine Woche?" mit echten Zahlen.
4. **Offline & Sync**: App startet ohne Verbindung, Trainings landen in einer Warteschlange und werden nachgesendet, klarer Offline-Hinweis in der Oberfläche.
5. **Clubs & Saisons**: Gruppen mit gemeinsamem Wochenziel, Saison-Ranglisten mit Auf-/Abstieg, Club-Chat-Feed und exklusive Saison-Badges.

## Technische Hinweise

- Statusleisten-Farbe über ein dynamisches `theme-color`-Meta, das beim Theme-Wechsel mitgeschrieben wird; Werte aus den bestehenden `[data-theme]`-Tokens in `src/styles.css`.
- Theme-Laden beim Start über einen kleinen Effekt in `src/routes/__root.tsx`, der nach Session-Abruf `profiles.theme` liest und `applyTheme` aufruft.
- Asset-Links als statische Route unter `src/routes/[.well-known]/assetlinks.ts` (öffentlich, kein Auth).
- Offline-Support (Update 4) über `vite-plugin-pwa` mit Netzwerk-zuerst für Seiten und Registrierung nur in der veröffentlichten App – nicht in der Vorschau.
