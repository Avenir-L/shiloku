param(
    [switch]$Loop,
    [switch]$Push,
    [int]$IntervalSeconds = 15
)

$ErrorActionPreference = 'Continue'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$statusFile = Join-Path $repoRoot "status.json"
$configFile = Join-Path $PSScriptRoot "status-config.json"
$config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json

$script:MediaReady = $false
$script:AwaitMethod = $null
$script:ForegroundApiReady = $false
$script:MusicExeNames = @('cloudmusic', 'CloudMusic', 'NeteaseCloudMusic', 'QQMusic', 'QQMusicLite', 'Spotify')

function Initialize-ForegroundApi {
    if ($script:ForegroundApiReady) { return $true }
    try {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]
public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
public class ShilokuForeground {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
}
"@
        $script:ForegroundApiReady = $true
        return $true
    } catch { return $false }
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

function Get-IdleSeconds {
    if (-not (Initialize-ForegroundApi)) { return 0 }
    try {
        $info = New-Object ShilokuForeground+LASTINPUTINFO
        $info.cbSize = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($info)
        if (-not [ShilokuForeground]::GetLastInputInfo([ref]$info)) { return 0 }
        $idleMs = [Environment]::TickCount - [int]$info.dwTime
        if ($idleMs -lt 0) { $idleMs += [uint32]::MaxValue + 1 }
        return $idleMs / 1000.0
    } catch { return 0 }
}

function Get-MusicProcessNamesFromConfig {
    $map = @{}
    foreach ($prop in $config.musicApps.PSObject.Properties) {
        $names = @()
        if ($prop.Value.match) { $names = @($prop.Value.match) }
        if ($names.Count -eq 0) { $names = @($prop.Name) }
        $map[$prop.Name] = $names
    }
    return $map
}

function Get-ForegroundMusicAppKey {
    $fg = Get-ForegroundProcessName
    if (-not $fg) { return $null }
    $musicMap = Get-MusicProcessNamesFromConfig
    foreach ($entry in $musicMap.GetEnumerator()) {
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
            $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation`1"
        })[0]
        [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
        [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus, Windows.Media.Control, ContentType = WindowsRuntime]
        [void][Windows.Media.MediaProperties.MusicDisplayProperties, Windows.Media, ContentType = WindowsRuntime]
        $script:MediaReady = $true
        return $true
    } catch { return $false }
}

function Await-WinRTTask {
    param($Task, [Type]$ResultType)
    $netTask = $script:AwaitMethod.MakeGenericMethod($ResultType).Invoke($null, @($Task))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

function Test-AppMatch {
    param([string]$AppId, [string[]]$Patterns)
    if (-not $AppId) { return $false }
    foreach ($pat in $Patterns) {
        if ($AppId -match $pat) { return $true }
    }
    return $false
}

function Get-AllMusicAppPatterns {
    $patterns = @()
    foreach ($prop in $config.musicApps.PSObject.Properties) {
        if ($prop.Value.match) { $patterns += @($prop.Value.match) }
    }
    return ($patterns | Select-Object -Unique)
}

function Get-MediaManager {
    if (-not (Initialize-MediaControls)) { return $null }
    try {
        return Await-WinRTTask `
            ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
            ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    } catch { return $null }
}

function Get-SessionPlaybackInfo {
    param($Session)
    if (-not $Session) { return $null }
    try {
        $playing = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing
        if ($Session.GetPlaybackInfo().PlaybackStatus -ne $playing) { return $null }
        $props = Await-WinRTTask ($Session.TryGetMediaPropertiesAsync()) ([Windows.Media.MediaProperties.MusicDisplayProperties])
        return @{
            Title  = [string]$props.Title
            Artist = [string]$props.Artist
            AppId  = [string]$Session.SourceAppUserModelId
        }
    } catch { return $null }
}

function Get-AnyPlayingMusicInfo {
    $manager = Get-MediaManager
    if (-not $manager) { return $null }

    $knownPatterns = Get-AllMusicAppPatterns
    $genericMatch = $null
    $seen = @{}

    try {
        foreach ($s in $manager.GetSessions()) {
            $info = Get-SessionPlaybackInfo $s
            if (-not $info) { continue }
            if ($seen[$info.AppId]) { continue }
            $seen[$info.AppId] = $true
            if (Test-AppMatch $info.AppId $knownPatterns) { return $info }
            if (-not $genericMatch -and ($info.Title -or $info.Artist)) { $genericMatch = $info }
        }

        $current = $manager.GetCurrentSession()
        $currentInfo = Get-SessionPlaybackInfo $current
        if ($currentInfo) {
            if (Test-AppMatch $currentInfo.AppId $knownPatterns) { return $currentInfo }
            if (-not $genericMatch) { $genericMatch = $currentInfo }
        }
    } catch {}

    return $genericMatch
}

function Test-MusicPlayerRunning {
    foreach ($name in $script:MusicExeNames) {
        if (Get-Process -Name $name -ErrorAction SilentlyContinue) { return $true }
    }
    return $false
}

function Get-MusicInfoFromWindowTitle {
    foreach ($name in $script:MusicExeNames) {
        $proc = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
        if (-not $proc) { continue }

        $title = [string]$proc.MainWindowTitle.Trim()
        if (-not $title) { continue }

        foreach ($suffix in @($config.windowTitleSuffixes)) {
            if ($suffix -and $title.Contains($suffix)) {
                $title = ($title -split [regex]::Escape($suffix))[0].Trim()
                $title = $title.TrimEnd('-').Trim()
            }
        }
        if (-not $title) { continue }

        if ($title -match '^(?<song>.+?)\s*-\s*(?<artist>.+)$') {
            return @{ Title = $matches.song.Trim(); Artist = $matches.artist.Trim(); AppId = $name }
        }
        return @{ Title = $title; Artist = ''; AppId = $name }
    }
    return $null
}

function Get-MusicAppLabel {
    param([string]$Key)
    if (-not $Key) { return $null }
    if ($config.musicApps.PSObject.Properties.Name -contains $Key) {
        return [string]$config.musicApps.$Key.name
    }
    return $null
}

function Format-ListeningLine {
    param($Info, [string]$FallbackName = '')
    $pfx = [string]$config.listeningPrefix
    if (-not $pfx) { $pfx = 'listening' }

    if ($Info -and $Info.Title) {
        if ($Info.Artist) { return "$pfx $($Info.Title) - $($Info.Artist)" }
        return "$pfx $($Info.Title)"
    }
    if ($FallbackName) { return "$pfx $FallbackName" }
    return $null
}

function Get-ForegroundProcessStatus {
    $fg = Get-ForegroundProcessName
    if (-not $fg) { return $null }
    foreach ($prop in $config.processes.PSObject.Properties) {
        if ($fg -ieq $prop.Name) { return $prop.Value }
    }
    $skip = @('explorer','SearchHost','ShellExperienceHost','ApplicationFrameHost','SystemSettings',
        'powershell','pwsh','cmd','WindowsTerminal','python','TextInputHost','StartMenuExperienceHost','msedgewebview2')
    if ($skip -notcontains $fg) {
        $pfx = [string]$config.unknownProcessPrefix
        if (-not $pfx) { $pfx = 'using' }
        return "$pfx $fg"
    }
    return $null
}

function Get-StatusText {
    $idleThreshold = if ($config.idleSeconds) { [int]$config.idleSeconds } else { 300 }
    if ((Get-IdleSeconds) -ge $idleThreshold) {
        if ($config.idle) { return [string]$config.idle }
        return 'zzz'
    }

    $fgMusicKey = Get-ForegroundMusicAppKey
    $musicInfo = Get-AnyPlayingMusicInfo
    if (-not $musicInfo) { $musicInfo = Get-MusicInfoFromWindowTitle }
    $fgStatus = Get-ForegroundProcessStatus
    $sep = [string]$config.statusSeparator
    if (-not $sep) { $sep = ' | ' }

    $listenLine = $null
    if ($musicInfo) {
        $listenLine = Format-ListeningLine $musicInfo
    } elseif ($fgMusicKey) {
        $listenLine = Format-ListeningLine $null (Get-MusicAppLabel $fgMusicKey)
    } elseif (Test-MusicPlayerRunning) {
        $listenLine = Format-ListeningLine $null (Get-MusicAppLabel 'cloudmusic')
    }

    if ($listenLine -and $fgStatus -and -not $fgMusicKey) {
        return "$listenLine$sep$fgStatus"
    }
    if ($listenLine) { return $listenLine }
    if ($fgStatus) { return $fgStatus }
    return $config.default
}

function Invoke-GitStep {
    param([string[]]$Args)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & git @Args 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    foreach ($line in $output) { if ($line) { Write-Host "  $line" } }
    return ($code -eq 0)
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
            if (Push-StatusToGit) { $script:LastPushTime = Get-Date }
        }
    }
}

function Push-StatusToGit {
    Push-Location $repoRoot
    try {
        [void](Invoke-GitStep -Args @('pull','--rebase','--autostash','origin','main'))
        $dirty = git status --porcelain status.json 2>$null
        if (-not $dirty) { return $true }
        if (-not (Invoke-GitStep -Args @('add','status.json'))) { return $false }
        if (-not (Invoke-GitStep -Args @('commit','-m','chore: update live status [skip vercel]'))) { return $false }
        if (-not (Invoke-GitStep -Args @('push','origin','main'))) { return $false }
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
