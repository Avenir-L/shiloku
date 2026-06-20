param([switch]$NoAutostart)

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ps1 = Join-Path $PSScriptRoot "sync-status.ps1"
$bat = Join-Path $PSScriptRoot "start-status-sync.bat"
$hiddenBat = Join-Path $PSScriptRoot "start-status-sync-hidden.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$startup = [Environment]::GetFolderPath("Startup")
$wsh = New-Object -ComObject WScript.Shell
$taskName = "ShilokuStatusSync"

$deskLnk = Join-Path $desktop "Shiloku Status Sync.lnk"
$desk = $wsh.CreateShortcut($deskLnk)
$desk.TargetPath = $bat
$desk.WorkingDirectory = $repo
$desk.Description = "Shiloku status sync"
$desk.Save()

Get-ChildItem $startup -Filter "*Shiloku*" -ErrorAction SilentlyContinue | Remove-Item -Force

function Register-StatusAutostartTask {
    $action = New-ScheduledTaskAction -Execute $hiddenBat -WorkingDirectory $repo
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $trigger.Delay = 'PT20S'
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    Enable-ScheduledTask -TaskName $taskName | Out-Null
}

if (-not $NoAutostart) {
    Register-StatusAutostartTask
    Write-Host "Autostart ON: Task Scheduler -> $taskName (20s after login, hidden)"
    Write-Host "Manual window: desktop shortcut or start-status-sync.bat"
} else {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Autostart OFF."
}

Write-Host "Desktop: $deskLnk"
