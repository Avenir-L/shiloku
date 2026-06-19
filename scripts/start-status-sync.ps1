$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

Write-Host '========================================'
Write-Host '  Shiloku status sync (one window only)'
Write-Host '  Close this window to stop'
Write-Host '========================================'
Write-Host ''

& (Join-Path $PSScriptRoot 'stop-status-sync.ps1')

Write-Host ''
Write-Host 'Starting sync (check every 5s, upload within ~8s after change)...'
Write-Host ''

& (Join-Path $PSScriptRoot 'sync-status.ps1') -Loop -Post -IntervalSeconds 5
