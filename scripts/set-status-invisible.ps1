param(
    [ValidateSet('on', 'off', 'toggle')]
    [string]$Mode = 'toggle'
)

$ErrorActionPreference = 'Stop'
$flagFile = Join-Path $PSScriptRoot '.status-invisible'
$syncScript = Join-Path $PSScriptRoot 'sync-status.ps1'

$wasOn = Test-Path $flagFile
$turnOn = switch ($Mode) {
    'on' { $true }
    'off' { $false }
    default { -not $wasOn }
}

if ($turnOn) {
    New-Item -ItemType File -Path $flagFile -Force | Out-Null
    Write-Host '[status] invisible ON'
} else {
    if (Test-Path $flagFile) { Remove-Item $flagFile -Force }
    Write-Host '[status] invisible OFF'
}

& $syncScript -Post
if ($turnOn) {
    Write-Host '[status] site shows invisible'
} else {
    Write-Host '[status] auto detect restored'
}
