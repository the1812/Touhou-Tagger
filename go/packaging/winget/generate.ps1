#Requires -Version 7.0

param(
  [Parameter(Mandatory)]
  [string]$Tag,
  [string]$OutputDirectory = "$PSScriptRoot/../../bin/winget"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$releaseJson = gh release view $Tag --repo the1812/Touhou-Tagger --json tagName,isDraft,isPrerelease,url,assets,publishedAt
if ($LASTEXITCODE -ne 0) {
  throw "Failed to read release $Tag."
}
$release = $releaseJson | ConvertFrom-Json
if ($release.isDraft -or $release.isPrerelease) {
  throw 'WinGet manifests require a published stable release.'
}

$version = $release.tagName -replace '^v', ''
$releaseDate = ([DateTimeOffset]$release.publishedAt).UtcDateTime.ToString('yyyy-MM-dd')
$licenseUrl = "https://github.com/the1812/Touhou-Tagger/blob/$($release.tagName)/LICENCE"
$products = @(
  @{ Kind = 'CLI'; Asset = 'thtag.exe' },
  @{ Kind = 'GUI'; Asset = 'TouhouTagger.exe' }
)
$downloadDirectory = Join-Path $OutputDirectory "downloads/$version"
New-Item -ItemType Directory -Force -Path $downloadDirectory | Out-Null

foreach ($product in $products) {
  $asset = $release.assets | Where-Object name -EQ $product.Asset
  if (!$asset) {
    throw "Release $Tag must contain $($product.Asset)."
  }

  $installerPath = Join-Path $downloadDirectory $product.Asset
  Invoke-WebRequest -Uri $asset.url -OutFile $installerPath
  $hash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash

  $manifestDirectory = Join-Path $OutputDirectory "manifests/t/the1812/TouhouTagger/$($product.Kind)/$version"
  New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null
  $templateDirectory = Join-Path $PSScriptRoot $product.Kind.ToLowerInvariant()
  foreach ($template in Get-ChildItem -LiteralPath $templateDirectory -Filter '*.template.yaml') {
    $content = (Get-Content -LiteralPath $template.FullName -Raw).
      Replace('@VERSION@', $version).
      Replace('@INSTALLER_URL@', $asset.url).
      Replace('@SHA256@', $hash).
      Replace('@RELEASE_URL@', $release.url).
      Replace('@RELEASE_DATE@', $releaseDate).
      Replace('@LICENSE_URL@', $licenseUrl)
    $manifestPath = Join-Path $manifestDirectory ($template.Name -replace '\.template\.yaml$', '.yaml')
    Set-Content -LiteralPath $manifestPath -Value $content -Encoding utf8NoBOM -NoNewline
  }

  winget validate --manifest $manifestDirectory --disable-interactivity
  if ($LASTEXITCODE -ne 0) {
    throw "WinGet validation failed for the1812.TouhouTagger.$($product.Kind)."
  }
  Write-Output "Validated manifests: $manifestDirectory"
}
