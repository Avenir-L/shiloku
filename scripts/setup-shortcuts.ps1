$bat = Join-Path $PSScriptRoot "start-status-sync.bat"
$vbs = Join-Path $PSScriptRoot "start-status-sync.vbs"
$desktop = [Environment]::GetFolderPath("Desktop")
$startup = [Environment]::GetFolderPath("Startup")
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wsh = New-Object -ComObject WScript.Shell

$deskLnk = Join-Path $desktop "Shiloku Status Sync.lnk"
$desk = $wsh.CreateShortcut($deskLnk)
$desk.TargetPath = $bat
$desk.WorkingDirectory = $repo
$desk.Description = "Shiloku status sync"
$desk.Save()

$startLnk = Join-Path $startup "Shiloku Status Sync.lnk"
$start = $wsh.CreateShortcut($startLnk)
$start.TargetPath = $vbs
$start.WorkingDirectory = $PSScriptRoot
$start.Description = "Shiloku status sync autostart"
$start.Save()

Write-Host "OK: $deskLnk"
Write-Host "OK: $startLnk"
