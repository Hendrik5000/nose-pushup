# Figma-Integration einrichten

Diese App kann optional direkt mit einer Figma-Datei verbunden werden.

## 1. Zugriffsdaten holen

1. Öffne Figma und gehe zu der Datei, die du verbinden willst.
2. Erstelle ein Personal Access Token in deinem Figma-Account.
3. Notiere die File-Key aus der Datei-URL:
   - Beispiel: https://www.figma.com/file/ABC123/Mein-Design
   - Der File-Key ist: ABC123

## 2. Umgebungsvariablen ergänzen

In der Datei .env ergänze:

```env
VITE_FIGMA_ACCESS_TOKEN="dein-token"
VITE_FIGMA_FILE_KEY="dein-file-key"
```

Optional funktionieren auch die nicht-vite-Varianten:

```env
FIGMA_ACCESS_TOKEN="dein-token"
FIGMA_FILE_KEY="dein-file-key"
```

## 3. Starten

```bash
npm run dev
```

Wenn die Werte korrekt sind, erscheint im Dashboard ein Figma-Card mit dem Dateinamen, Thumbnail und einem Link zur Datei.
