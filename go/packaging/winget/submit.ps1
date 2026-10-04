#Requires -Version 7.0

param(
  [Parameter(Mandatory)]
  [string]$Tag
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$version = $Tag -replace '^v', ''
foreach ($kind in @('CLI', 'GUI')) {
  $packageId = "the1812.TouhouTagger.$kind"
  $title = "$packageId version $version"
  $pullRequestsJson = gh pr list --repo microsoft/winget-pkgs --state all --search "`"$title`" in:title" --json title,url,state,mergedAt
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to check existing WinGet submissions for $packageId."
  }
  $existing = $pullRequestsJson | ConvertFrom-Json | Where-Object {
    $_.title -eq $title -and ($_.state -eq 'OPEN' -or $_.mergedAt)
  }
  if ($existing) {
    $existing | ForEach-Object {
      "${packageId}: $($_.url) (already submitted)" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
    }
    continue
  }
  ./wingetcreate.exe submit --no-open --prtitle $title "manifests/t/the1812/TouhouTagger/$kind/$version"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to submit $packageId $version to WinGet."
  }
}
