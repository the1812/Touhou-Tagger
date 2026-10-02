$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sourceRoot = $PSScriptRoot
$assetRoot = Join-Path (Split-Path -Parent $sourceRoot) 'internal/imagecodec/assets'
$versions = Get-Content -LiteralPath (Join-Path $sourceRoot 'versions.json') -Raw | ConvertFrom-Json
$tempParent = Join-Path $sourceRoot 'target'
$temporaryRoot = Join-Path $tempParent "touhou-tagger-wasm-$([guid]::NewGuid())"
$outputRoot = Join-Path $temporaryRoot 'output'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

try {
  $archivePath = Join-Path $temporaryRoot 'mozjpeg.tar.gz'
  Invoke-WebRequest -Uri $versions.mozjpeg.sourceUrl -OutFile $archivePath
  $sourceHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sourceHash -ne $versions.mozjpeg.sourceSha256) {
    throw "MozJPEG source hash mismatch: expected $($versions.mozjpeg.sourceSha256), got $sourceHash"
  }

  docker buildx build `
    --build-context "mozjpeg=$temporaryRoot" `
    --output "type=local,dest=$outputRoot" `
    $sourceRoot
  if ($LASTEXITCODE -ne 0) {
    throw 'imagecodec.wasm build failed'
  }

  Copy-Item -LiteralPath (Join-Path $outputRoot 'imagecodec.wasm') -Destination (Join-Path $assetRoot 'imagecodec.wasm')
  Write-Output 'imagecodec.wasm rebuilt'
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}
