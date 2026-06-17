$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ps1 = Join-Path $PSScriptRoot "sync-status.ps1"
$bat = Join-Path $PSScriptRoot "start-status-sync.bat"
$hiddenBat = Join-Path $PSScriptRoot "start-status-sync-hidden.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$startup = [Environment]::GetFolderPath("Startup")
$wsh = New-Object -ComObject WScript.Shell
$taskName = "ShilokuStatusSync"

# Desktop shortcut (visible window)
$deskLnk = Join-Path $desktop "Shiloku Status Sync.lnk"
$desk = $wsh.CreateShortcut($deskLnk)
$desk.TargetPath = $bat
$desk.WorkingDirectory = $repo
$desk.Description = "Shiloku status sync"
$desk.Save()

# Remove old startup shortcut if exists
Get-ChildItem $startup -Filter "*Shiloku*" -ErrorAction SilentlyContinue | Remove-Item -Force

# Scheduled task for autostart (no VBS)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ps1`" -Loop -Push" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "Desktop: $deskLnk"
Write-Host "Autostart: Task Scheduler -> $taskName"
