# Nosy Push-Up als Android-App (.aab) bauen

Die Web-App ist eine PWA und wird als **Trusted Web Activity (TWA)** verpackt.
Google **Bubblewrap** erzeugt daraus ein Android App Bundle (`.aab`) für den
Play Store. Es gibt keinen Export „Lovable-Datei → .aab“ – der Weg ist immer:
**veröffentlichte PWA → Bubblewrap → .aab**.

## Kurzfassung (Windows, ein Befehl)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-aab.ps1
```

Das Skript installiert Bubblewrap bei Bedarf, legt das TWA-Projekt in
`android-build\` an (Vorlage: `android/twa-manifest.template.json`), baut das
Bundle und zeigt am Ende den SHA-256-Fingerprint an.

## Voraussetzungen

1. [Node.js LTS](https://nodejs.org) (Node 18+).
2. JDK 17 + Android SDK – Bubblewrap lädt beides beim ersten Lauf selbst herunter
   (Speicherort wird abgefragt, Standard `%USERPROFILE%\.bubblewrap`).
3. Die App muss **öffentlich erreichbar über HTTPS** sein
   (Lovable Publish → `https://nose-pushup.lovable.app`).
4. `manifest.webmanifest` muss erreichbar sein:
   `curl https://nose-pushup.lovable.app/manifest.webmanifest`

## Manueller Weg (statt Skript)

```powershell
npm i -g @bubblewrap/cli
mkdir nosy-android; cd nosy-android
bubblewrap init --manifest https://nose-pushup.lovable.app/manifest.webmanifest
bubblewrap build
```

Beim Init abgefragt:

- **Package name**: `app.lovable.nosypushup` (muss mit
  `src/routes/[.well-known]/assetlinks[.]json.ts` übereinstimmen)
- **Display mode**: `standalone` (Fullscreen-Look kommt über Safe-Area-CSS)
- **Status bar / Navigation bar color**: `#0b1017`
- **Notification delegation**: **ja** (Web Push in der App)
- **Keystore**: neu erstellen lassen, Passwörter sicher notieren
  (geht der Keystore verloren, ist kein Play-Store-Update mehr möglich)

## Fingerprint eintragen (Pflicht)

```powershell
bubblewrap fingerprint list
```

Den **SHA-256**-Wert in `src/routes/[.well-known]/assetlinks[.]json.ts` bei
`SHA256_FINGERPRINTS` eintragen und die Web-App neu veröffentlichen. Prüfen:

```powershell
curl https://nose-pushup.lovable.app/.well-known/assetlinks.json
```

Ohne korrekten Fingerprint zeigt Android eine Browser-Adressleiste.
Nach dem Play-Store-Upload zusätzlich den Fingerprint aus
**Play Console → Setup → App signing** (App signing key certificate) eintragen –
Play signiert das Bundle neu.

## Bundle & Test

```powershell
bubblewrap build          # -> app-release-bundle.aab + app-release-signed.apk
bubblewrap install        # APK auf angeschlossenem Gerät installieren
```

- `.aab` → Play Console Upload
- `.apk` → direktes Testen per USB / ADB

## Versionen erhöhen

Vor jedem neuen Play-Upload in `android-build\twa-manifest.json`:

```json
"appVersionName": "1.1.0",
"appVersionCode": 2
```

`appVersionCode` muss bei jedem Upload streng steigen.

## Aktualisieren

Web-Änderungen sind sofort in der App sichtbar. Ein neues Bundle ist nur nötig
bei Änderungen an Manifest, Icon, Name, Berechtigungen oder Version:

```powershell
bubblewrap update
bubblewrap build
```

## Benachrichtigungen (Samsung & Android)

Die App nutzt **Web Push**. Damit Benachrichtigungen auch bei geschlossener App ankommen:

1. In `twa-manifest.json` muss `"enableNotifications": true` stehen (in der Vorlage bereits gesetzt).
2. In der App unter Profil → Benachrichtigungen „Cloud Push“ aktivieren.
3. Android-Systemeinstellungen: Benachrichtigungsberechtigung für die App erteilen.

## Häufige Stolpersteine

| Problem | Ursache / Lösung |
| --- | --- |
| Adressleiste sichtbar | assetlinks.json fehlt/falscher SHA-256 – auch den Play-App-Signing-Key eintragen |
| Play lehnt Upload ab („version code already used“) | `appVersionCode` erhöhen |
| Splash/Icon unscharf | Maskable-Icon in 512×512 im Manifest hinterlegen |
| Build bricht bei JDK ab | `bubblewrap doctor` ausführen, danach `bubblewrap updateConfig --jdkPath …` |
| Offline weiße Seite | Service Worker (`public/sw.js`) muss ausgeliefert werden, kein Cache-Header `no-store` auf `/` |
