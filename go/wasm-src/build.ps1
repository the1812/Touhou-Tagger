param(
  [switch]$UpdateHashes
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sourceRoot = $PSScriptRoot
$goRoot = Split-Path -Parent $sourceRoot
$assetRoot = Join-Path $goRoot 'internal/imagecodec/assets'
$versionsPath = Join-Path $sourceRoot 'versions.json'
$versions = Get-Content -LiteralPath $versionsPath -Raw | ConvertFrom-Json
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "touhou-tagger-wasm-$PID"
$outputRoot = Join-Path $temporaryRoot 'output'

New-Item -ItemType Directory -Force -Path $assetRoot, $outputRoot | Out-Null

try {
  $resizeRoot = Join-Path $sourceRoot 'resize'
  $resizeDockerTag = "touhou-tagger-resize-wasm:$($versions.resize.rust)"
  docker build --tag $resizeDockerTag $resizeRoot
  if ($LASTEXITCODE -ne 0) {
    throw 'Resize build image creation failed'
  }

  $resizeProject = $resizeRoot.Replace('\', '/')
  $resizeOutputVolume = $outputRoot.Replace('\', '/')
  docker run --rm `
    --volume "${resizeProject}:/src:ro" `
    --volume "${resizeOutputVolume}:/out" `
    $resizeDockerTag
  if ($LASTEXITCODE -ne 0) {
    throw 'resize.wasm build failed'
  }

  $archivePath = Join-Path $temporaryRoot 'mozjpeg.tar.gz'
  Invoke-WebRequest -Uri $versions.mozjpeg.sourceUrl -OutFile $archivePath
  $sourceHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sourceHash -ne $versions.mozjpeg.sourceSha256) {
    throw "MozJPEG source hash mismatch: expected $($versions.mozjpeg.sourceSha256), got $sourceHash"
  }

  $mozjpegRoot = Join-Path $temporaryRoot 'mozjpeg'
  New-Item -ItemType Directory -Path $mozjpegRoot | Out-Null
  tar -xzf $archivePath --strip-components=1 -C $mozjpegRoot
  if ($LASTEXITCODE -ne 0) {
    throw 'MozJPEG source extraction failed'
  }

  $dockerTag = "touhou-tagger-mozjpeg-wasm:$($versions.mozjpeg.emscripten)"
  docker build --tag $dockerTag (Join-Path $sourceRoot 'mozjpeg')
  if ($LASTEXITCODE -ne 0) {
    throw 'MozJPEG build image creation failed'
  }

  $mozjpegProject = (Join-Path $sourceRoot 'mozjpeg').Replace('\', '/')
  $mozjpegSource = $mozjpegRoot.Replace('\', '/')
  $mozjpegOutput = $outputRoot.Replace('\', '/')
  docker run --rm `
    --volume "${mozjpegProject}:/project:ro" `
    --volume "${mozjpegSource}:/source:ro" `
    --volume "${mozjpegOutput}:/out" `
    $dockerTag
  if ($LASTEXITCODE -ne 0) {
    throw 'mozjpeg.wasm build failed'
  }

  $hashes = @{}
  foreach ($name in @('resize', 'mozjpeg')) {
    $wasmPath = Join-Path $outputRoot "$name.wasm"
    $hash = (Get-FileHash -LiteralPath $wasmPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $hashes[$name] = $hash
    $expected = $versions.$name.sha256
    if (-not $UpdateHashes -and $expected -and $hash -ne $expected) {
      throw "$name.wasm hash mismatch: expected $expected, got $hash"
    }
    Copy-Item -LiteralPath $wasmPath -Destination (Join-Path $assetRoot "$name.wasm")
  }

  if ($UpdateHashes) {
    $versions.resize.sha256 = $hashes.resize
    $versions.mozjpeg.sha256 = $hashes.mozjpeg
    $versions | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $versionsPath -Encoding utf8
  }

  Write-Output "resize.wasm $($hashes.resize)"
  Write-Output "mozjpeg.wasm $($hashes.mozjpeg)"
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}
