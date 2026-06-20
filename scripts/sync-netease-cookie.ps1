param(
    [switch]$Loop,
    [int]$IntervalHours = 0,
    [switch]$SkipVercel
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'netease-cookie-vercel.ps1')

$config = Get-NeteaseSyncConfig
if ($IntervalHours -le 0) {
    $IntervalHours = [int]$config.syncIntervalHours
    if ($IntervalHours -le 0) { $IntervalHours = 6 }
}

function Invoke-NeteaseCookieSyncOnce {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Write-Host 'Python not found.'
        return
    }

    $syncScript = Join-Path $PSScriptRoot 'netease_cookie_sync.py'
    if (-not (Test-Path $syncScript)) {
        Write-Host 'Missing netease_cookie_sync.py'
        return
    }

    $output = & $python.Source $syncScript 2>&1 | Out-String
    $line = ($output -split "`n" | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1)
    if (-not $line) {
        Write-Host $output.Trim()
        return
    }

    try {
        $result = $line | ConvertFrom-Json
    } catch {
        Write-Host $output.Trim()
        return
    }

    if ($result.updated) {
        Write-Host "Cookie updated from $($result.source) (user $($result.userId))."
        if (-not $SkipVercel) {
            Push-NeteaseCookieToVercel | Out-Null
        }
        return
    }

    if ($result.valid -and -not $SkipVercel) {
        Push-NeteaseCookieToVercel | Out-Null
    }

    if ($result.valid) {
        Write-Host "Cookie still valid (source: $($result.source))."
        return
    }

    if ($result.error) {
        Write-Host "Cookie sync failed: $($result.error)"
    }
}

Invoke-NeteaseCookieSyncOnce

if ($Loop) {
    Write-Host "Auto cookie sync every ${IntervalHours}h. Ctrl+C to stop."
    while ($true) {
        Start-Sleep -Seconds ($IntervalHours * 3600)
        Invoke-NeteaseCookieSyncOnce
    }
}
