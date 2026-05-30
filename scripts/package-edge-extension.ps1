$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$stage = Join-Path $dist "banshi-edge-extension"
$zip = Join-Path $dist "banshi-edge-extension.zip"

if (Test-Path $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stage | Out-Null

$files = @(
  "manifest.json",
  "background/service_worker.js",
  "content_scripts/profile_collector.js",
  "popup/popup.html",
  "popup/popup.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png"
)

foreach ($file in $files) {
  $source = Join-Path $root $file
  if (!(Test-Path $source)) {
    throw "Missing extension file: $file"
  }

  $destination = Join-Path $stage $file
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}

if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Write-Host "Created $zip"
