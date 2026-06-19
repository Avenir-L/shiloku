$ErrorActionPreference = 'SilentlyContinue'

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -match 'sync-status\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

$task = Get-ScheduledTask -TaskName 'ShilokuStatusSync' -ErrorAction SilentlyContinue
if ($task -and $task.State -eq 'Running') {
    Stop-ScheduledTask -TaskName 'ShilokuStatusSync' -ErrorAction SilentlyContinue
}

Write-Host 'All status sync processes stopped.'
