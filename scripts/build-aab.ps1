# Nosy Push-Up -> Android App Bundle (.aab)
# Verwendung (Windows PowerShell, im Projektordner):
#   powershell -ExecutionPolicy Bypass -File scripts\build-aab.ps1
#
# Erzeugt/aktualisiert ein Bubblewrap-TWA-Projekt in .\android-build
# und baut daraus app-release-bundle.aab.

param(
  [string]$SiteUrl = "https://nose-pushup.lovable.app",
  [string]$WorkDir = "android-build"
)

$ErrorActionPreference = "Stop"

function Require-Cmd($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "'$name' nicht gefunden. $hint"
  }
}

Require-Cmd "node" "Node.js LTS installieren: https://nodejs.org"
Require-Cmd "npm"  "Node.js LTS installieren: https://nodejs.org"

if (-not (Get-Command bubblewrap -ErrorAction SilentlyContinue)) {
  Write-Host "Installiere @bubblewrap/cli global ..." -ForegroundColor Cyan
  npm install -g @bubblewrap/cli
}

$manifestUrl = "$SiteUrl/manifest.webmanifest"
$template = Join-Path $PSScriptRoot "..\android\twa-manifest.template.json"

if (-not (Test-Path $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir | Out-Null }
Push-Location $WorkDir

try {
  if (Test-Path "twa-manifest.json") {
    Write-Host "Vorhandenes TWA-Projekt gefunden -> update" -ForegroundColor Cyan
    bubblewrap update --skipVersionUpgrade=false
  }
  else {
    Write-Host "Neues TWA-Projekt aus Vorlage anlegen" -ForegroundColor Cyan
    Copy-Item $template "twa-manifest.json"
    # Host/URLs an die gewaehlte Domain anpassen
    $host = ([System.Uri]$SiteUrl).Host
    (Get-Content "twa-manifest.json") `
      -replace "nose-pushup\.lovable\.app", $host |
      Set-Content "twa-manifest.json"
    bubblewrap init --manifest $manifestUrl --directory .
  }

  Write-Host "Baue App Bundle ..." -ForegroundColor Cyan
  bubblewrap build

  Write-Host ""
  Write-Host "Fertig. Artefakte in $((Get-Location).Path):" -ForegroundColor Green
  Get-ChildItem -Filter "app-release*" | ForEach-Object { Write-Host " - $($_.Name)" }
  Write-Host ""
  Write-Host "SHA-256 Fingerprint fuer assetlinks.json:" -ForegroundColor Yellow
  bubblewrap fingerprint list
}
finally {
  Pop-Location
}
