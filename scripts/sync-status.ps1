param(
    [switch]$Loop,
    [switch]$Push,
    [int]$IntervalSeconds = 15
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$statusFile = Join-Path $repoRoot "status.json"
$configFile = Join-Path $PSScriptRoot "status-config.json"
$config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json

$script:MediaReady = $false
$script:AwaitMethod = $null
$script:ForegroundApiReady = $false

function Initialize-ForegroundApi {
    if ($script:ForegroundApiReady) { return $true }
    try {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ShilokuForeground {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
        $script:ForegroundApiReady = $true
        return $true
    } catch {
        return $false
    }
}

function Get-ForegroundProcessName {
    if (-not (Initialize-ForegroundApi)) { return $null }
    try {
        $hwnd = [ShilokuForeground]::GetForegroundWindow()
        if ($hwnd -eq [IntPtr]::Zero) { return $null }
        [uint32]$processId = 0
        [void][ShilokuForeground]::GetWindowThreadProcessId($hwnd, [ref]$processId)
        if ($processId -eq 0) { return $null }
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc) { return $proc.ProcessName }
    } catch {}
    return $null
}

$script:MusicProcessNames = @{
    cloudmusic = @("cloudmusic", "CloudMusic")
    QQMusic    = @("QQMusic", "QQMusicLite")
    Spotify    = @("Spotify")
}

function Get-ForegroundMusicAppKey {
    $fg = Get-ForegroundProcessName
    if (-not $fg) { return $null }
    foreach ($entry in $script:MusicProcessNames.GetEnumerator()) {
        foreach ($name in $entry.Value) {
            if ($fg -ieq $name) { return $entry.Key }
        }
    }
    return $null
}

function Initialize-MediaControls {
    if ($script:MediaReady) { return $true }
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $script:AwaitMethod = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq "AsTask" -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation`1"
        })[0]
        [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
        [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus, Windows.Media.Control, ContentType = WindowsRuntime]
        $script:MediaReady = $true
        return $true
    } catch {
        return $false
    }
}

function Await-WinRTTask {
    param($Task, [Type]$ResultType)
    $netTask = $script:AwaitMethod.MakeGenericMethod($ResultType).Invoke($null, @($Task))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

function Test-AppMatch {
    param([string]$AppId, [string[]]$Patterns)
    foreach ($pat in $Patterns) {
        if ($AppId -match $pat) { return $true }
    }
    return $false
}

function Get-MediaPlayingStatus {
    param($Meta, [string[]]$AppPatterns)

    if (-not (Initialize-MediaControls)) { return $null }

    try {
        $manager = Await-WinRTTask `
            ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
            ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

        $session = $null
        foreach ($s in $manager.GetSessions()) {
            if (Test-AppMatch $s.SourceAppUserModelId $AppPatterns) {
                $session = $s
                break
            }
        }

        if (-not $session) {
            $current = $manager.GetCurrentSession()
            if ($current -and (Test-AppMatch $current.SourceAppUserModelId $AppPatterns)) {
                $session = $current
            }
        }

        if (-not $session) { return $null }

        $status = $session.GetPlaybackInfo().PlaybackStatus
        $playing = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing

        # 暂停 / 停止时不显示歌名，返回 null 继续检测其他状态
        if ($status -ne $playing) { return $null }

        $props = Await-WinRTTask ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.MediaProperties.MusicDisplayProperties])
        $icon = $Meta.icon
        $title = $props.Title
        $artist = $props.Artist

        if ($title -and $artist) { return "$icon $title - $artist" }
        if ($title) { return "$icon $title" }
        return "$icon $($Meta.fallback)"
    } catch {
        return $null
    }
}

function Get-AnyPlayingMusicStatus {
    foreach ($prop in $config.musicApps.PSObject.Properties) {
        $patterns = $script:MusicProcessNames[$prop.Name]
        if (-not $patterns) { $patterns = @($prop.Name) }
        $status = Get-MediaPlayingStatus -Meta $prop.Value -AppPatterns $patterns
        if ($status) { return $status }
    }
    return $null
}

function Get-ForegroundProcessStatus {
    $fg = Get-ForegroundProcessName
    if (-not $fg) { return $null }
    foreach ($prop in $config.processes.PSObject.Properties) {
        if ($fg -ieq $prop.Name) {
            return $prop.Value
        }
    }
    return $null
}

function Get-StatusText {
    $parts = @()

    $musicStatus = Get-AnyPlayingMusicStatus
    if ($musicStatus) { $parts += $musicStatus }

    $fgStatus = Get-ForegroundProcessStatus
    if ($fgStatus -and -not (Get-ForegroundMusicAppKey)) {
        $parts += $fgStatus
    }

    if ($parts.Count -eq 0) { return $config.default }
    return ($parts -join " · ")
}

$script:LastPushTime = [datetime]::MinValue
$script:PushHeartbeatSeconds = 60

function Update-StatusFile {
    $text = Get-StatusText
    $payload = @{
        text      = $text
        updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    } | ConvertTo-Json -Compress

    $prev = $null
    if (Test-Path $statusFile) {
        try { $prev = (Get-Content $statusFile -Raw -Encoding UTF8 | ConvertFrom-Json).text } catch {}
    }

    [System.IO.File]::WriteAllText($statusFile, $payload, [System.Text.UTF8Encoding]::new($false))
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $text"

    if ($Push) {
        $elapsed = ((Get-Date) - $script:LastPushTime).TotalSeconds
        $textChanged = ($prev -ne $text)
        if ($textChanged -or $elapsed -ge $script:PushHeartbeatSeconds) {
            if (Push-StatusToGit) {
                $script:LastPushTime = Get-Date
            }
        }
    }
}

function Push-StatusToGit {
    Push-Location $repoRoot
    try {
        git pull --rebase --autostash origin main 2>&1 | Out-Host
        $dirty = git status --porcelain status.json 2>$null
        if (-not $dirty) { return $true }
        git add status.json
        git commit -m "chore: update live status [skip vercel]"
        git push origin main 2>&1 | Out-Host
        Write-Host "  pushed to GitHub"
        return $true
    } catch {
        Write-Host "  push failed: $_"
        return $false
    } finally {
        Pop-Location
    }
}

Update-StatusFile

if ($Loop) {
    Write-Host "Loop every ${IntervalSeconds}s. Ctrl+C to stop."
    if ($Push) { Write-Host "Auto-push enabled." }
    while ($true) {
        Start-Sleep -Seconds $IntervalSeconds
        Update-StatusFile
    }
}
