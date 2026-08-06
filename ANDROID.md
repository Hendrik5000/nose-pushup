# Nosy Push-Up als Android-App (.aab) bauen

Die Web-App wird als **Trusted Web Activity (TWA)** verpackt. Google Bubblewrap
erzeugt daraus ein Android App Bundle (`.aab`) für den Play Store.

## Voraussetzungen (Windows)

1. [Node.js LTS](https://nodejs.org) installieren.
2. JDK 17 und Android SDK – Bubblewrap lädt beides beim ersten Lauf selbst herunter.
3. Bubblewrap installieren:
   ```
   npm i -g @bubblewrap/cli
   ```

## Projekt anlegen

```
mkdir nosy-android && cd nosy-android
bubblewrap init --manifest https://nose-pushup.lovable.app/manifest.webmanifest
```

Beim Init abgefragt:
- **Package name**: `app.lovable.nosypushup` (muss mit `src/routes/[.well-known]/assetlinks[.]json.ts` übereinstimmen)
- **Display mode**: `standalone`
- **Status bar / Navigation bar color**: `#0b1017`
- **Keystore**: neu erstellen lassen, Passwörter sicher notieren

## Fingerprint eintragen

```
bubblewrap fingerprint list
```

Den **SHA-256**-Wert kopieren und in
`src/routes/[.well-known]/assetlinks[.]json.ts` in `SHA256_FINGERPRINTS`
eintragen, dann die Web-App neu veröffentlichen. Prüfen mit:

```
curl https://nose-pushup.lovable.app/.well-known/assetlinks.json
```

Ohne korrekten Fingerprint zeigt Android eine Browser-Adressleiste an.

## Benachrichtigungen (Samsung & Android)

Die App nutzt **Web Push**. Damit Benachrichtigungen auch bei geschlossener App auf Samsung-Geräten zuverlässig ankommen:
1. Die App muss über den Browser (Chrome/Samsung Internet) zum Homescreen hinzugefügt werden.
2. In den Einstellungen der App (in der App selbst) muss "Cloud Push" aktiviert werden.
3. In den Android-Systemeinstellungen muss die Benachrichtigungsberechtigung für die installierte PWA erteilt sein.

## Bundle bauen

```
bubblewrap build
```

Ergebnis: `app-release-bundle.aab` (Play Store) und `app-release-signed.apk`
(direkte Installation zum Testen).

## Aktualisieren

Web-Änderungen sind sofort in der App sichtbar – ein neues Bundle ist nur bei
Änderungen an Manifest, Icon, Name oder Versionsnummer nötig:

```
bubblewrap update && bubblewrap build
```
