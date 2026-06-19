param(
    [switch]$Loop,
    [switch]$Push,
    [int]$IntervalSeconds = 15
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
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

function Get-NeteaseProcessNames {
    $names = @()
    if ($config.musicApps.PSObject.Properties.Name -contains 'cloudmusic') {
        if ($config.musicApps.cloudmusic.match) {
            $names = @($config.musicApps.cloudmusic.match)
        }
    }
    if ($names.Count -eq 0) {
        $names = @('cloudmusic', 'CloudMusic', 'NeteaseCloudMusic')
    }
    return $names
}

function Get-AllMusicProcessExeNames {
    $names = @()
    foreach ($prop in $config.musicApps.PSObject.Properties) {
        if ($prop.Value.match) { $names += @($prop.Value.match) }
    }
    foreach ($name in $script:MusicExeNames) {
        if ($names -notcontains $name) { $names += $name }
    }
    return ($names | Select-Object -Unique)
}

function Parse-NeteaseWindowTitle {
    param([string]$RawTitle)
    $title = [string]$RawTitle.Trim()
    if (-not $title) { return $null }

    foreach ($suffix in @($config.windowTitleSuffixes)) {
        if (-not $suffix) { continue }
        if ($title -ieq $suffix) { return $null }
        if ($title.Contains($suffix)) {
            $title = ($title -split [regex]::Escape($suffix))[0].Trim()
            $title = $title.TrimEnd('-').Trim()
        }
    }
    if (-not $title) { return $null }

    if ($config.neteaseIdleWindowTitles) {
        foreach ($idle in @($config.neteaseIdleWindowTitles)) {
            if ($idle -and $title -ieq [string]$idle) { return $null }
        }
    }

    if ($title -match '^(?<song>.+?)\s*-\s*(?<artist>.+)$') {
        return @{
            Title  = $matches.song.Trim()
            Artist = $matches.artist.Trim()
            AppId  = 'cloudmusic'
        }
    }
    return @{ Title = $title; Artist = ''; AppId = 'cloudmusic' }
}

function Get-NeteaseMusicFromWindow {
    foreach ($name in (Get-NeteaseProcessNames)) {
        $proc = Get-Process -Name $name -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowTitle } |
            Select-Object -First 1
        if (-not $proc) { continue }
        $parsed = Parse-NeteaseWindowTitle ([string]$proc.MainWindowTitle)
        if ($parsed) { return $parsed }
    }
    return $null
}

function Get-NonNeteasePlayingMusicInfo {
    $manager = Get-MediaManager
    if (-not $manager) { return $null }

    $neteasePatterns = @()
    if ($config.musicApps.PSObject.Properties.Name -contains 'cloudmusic') {
        if ($config.musicApps.cloudmusic.match) {
            $neteasePatterns = @($config.musicApps.cloudmusic.match)
        }
    }
    $otherPatterns = Get-AllMusicAppPatterns | Where-Object {
        foreach ($np in $neteasePatterns) { if ($_ -eq $np) { return $false } }
        return $true
    }

    $genericMatch = $null
    $seen = @{}

    try {
        foreach ($s in $manager.GetSessions()) {
            $info = Get-SessionPlaybackInfo $s
            if (-not $info) { continue }
            if ($seen[$info.AppId]) { continue }
            $seen[$info.AppId] = $true
            if (Test-AppMatch $info.AppId $neteasePatterns) { continue }
            if (Test-AppMatch $info.AppId $otherPatterns) { return $info }
            if (-not $genericMatch -and ($info.Title -or $info.Artist)) { $genericMatch = $info }
        }

        $current = $manager.GetCurrentSession()
        $currentInfo = Get-SessionPlaybackInfo $current
        if ($currentInfo) {
            if (Test-AppMatch $currentInfo.AppId $neteasePatterns) { return $null }
            if (Test-AppMatch $currentInfo.AppId $otherPatterns) { return $currentInfo }
            if (-not $genericMatch) { $genericMatch = $currentInfo }
        }
    } catch {}

    return $genericMatch
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

function Get-ProcessDisplayName {
    param([string]$ProcessName)
    if (-not $ProcessName) { return '' }
    if ($config.processDisplayNames -and
        ($config.processDisplayNames.PSObject.Properties.Name -contains $ProcessName)) {
        return [string]$config.processDisplayNames.$ProcessName
    }
    try {
        $proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($proc) {
            try {
                $product = $proc.MainModule.FileVersionInfo.ProductName
                if ($product -and ($product.Trim() -ne '')) {
                    return $product.Trim()
                }
            } catch {}
        }
    } catch {}
    return $ProcessName
}

function Format-ActivityLine {
    param([string]$ProcessName)
    $pfx = [string]$config.activityPrefix
    if (-not $pfx) { $pfx = [string]$config.unknownProcessPrefix }
    if (-not $pfx) { $pfx = 'using' }
    return "$pfx $(Get-ProcessDisplayName $ProcessName)"
}

function Get-SteamInstallPath {
    try {
        $regPath = 'HKCU:\Software\Valve\Steam'
        if (Test-Path $regPath) {
            $p = (Get-ItemProperty -Path $regPath -Name SteamPath -ErrorAction SilentlyContinue).SteamPath
            if ($p -and (Test-Path $p)) { return $p.TrimEnd('\', '/') }
        }
    } catch {}
    $fallback = "${env:ProgramFiles(x86)}\Steam"
    if (Test-Path $fallback) { return $fallback }
    return $null
}

function Get-SteamLibraryPaths {
    param([string]$SteamPath)
    $paths = @($SteamPath)
    if (-not $SteamPath) { return $paths }
    $libVdf = Join-Path $SteamPath 'steamapps\libraryfolders.vdf'
    if (-not (Test-Path $libVdf)) { return $paths }
    try {
        $content = Get-Content $libVdf -Raw -Encoding UTF8
        foreach ($m in [regex]::Matches($content, '"path"\s+"([^"]+)"')) {
            $lib = $m.Groups[1].Value -replace '\\\\', '\'
            if ($lib -and (Test-Path $lib)) { $paths += $lib }
        }
    } catch {}
    return ($paths | Select-Object -Unique)
}

function Get-SteamAppDisplayName {
    param([int]$AppId, [string[]]$LibraryPaths)
    if ($AppId -le 0) { return $null }
    foreach ($lib in $LibraryPaths) {
        $manifest = Join-Path $lib "steamapps\appmanifest_$AppId.acf"
        if (-not (Test-Path $manifest)) { continue }
        try {
            $text = Get-Content $manifest -Raw -Encoding UTF8
            if ($text -match '"name"\s+"([^"]+)"') { return $Matches[1] }
        } catch {}
    }
    return $null
}

function Get-SteamRunningAppId {
    param([string]$SteamPath)
    if (-not $SteamPath) { return 0 }
    if (-not (Get-Process -Name steam -ErrorAction SilentlyContinue)) { return 0 }
    $userRoot = Join-Path $SteamPath 'userdata'
    if (-not (Test-Path $userRoot)) { return 0 }
    foreach ($userDir in Get-ChildItem $userRoot -Directory -ErrorAction SilentlyContinue) {
        $localConfig = Join-Path $userDir.FullName 'config\localconfig.vdf'
        if (-not (Test-Path $localConfig)) { continue }
        try {
            $content = Get-Content $localConfig -Raw -Encoding UTF8
            if ($content -match '"RunningAppID"\s+"(\d+)"') {
                $appId = [int]$Matches[1]
                if ($appId -gt 0) { return $appId }
            }
        } catch {}
    }
    return 0
}

function Test-ProcessTreeHasSteam {
    param([int]$ProcessId, [int]$Depth = 0)
    if ($ProcessId -le 0 -or $Depth -gt 8) { return $false }
    try {
        $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if (-not $proc) { return $false }
        if ($proc.ProcessName -ieq 'steam') { return $true }
        return Test-ProcessTreeHasSteam -ProcessId $proc.Parent.Id -Depth ($Depth + 1)
    } catch { return $false }
}

function Get-SteamGameFromForeground {
    param([string]$SteamPath, [string[]]$LibraryPaths)
    $fg = Get-ForegroundProcessName
    if (-not $fg) { return $null }
    if ($fg -ieq 'steam') { return $null }
    if ((Get-AllMusicProcessExeNames) -icontains $fg) { return $null }
    try {
        $proc = Get-Process -Name $fg -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $proc) { return $null }
        if (-not (Test-ProcessTreeHasSteam -ProcessId $proc.Id)) { return $null }
    } catch { return $null }

    foreach ($lib in $LibraryPaths) {
        $manifestDir = Join-Path $lib 'steamapps'
        if (-not (Test-Path $manifestDir)) { continue }
        foreach ($manifest in Get-ChildItem $manifestDir -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue) {
            try {
                $text = Get-Content $manifest.FullName -Raw -Encoding UTF8
                if ($text -notmatch '"name"\s+"([^"]+)"') { continue }
                $gameName = $Matches[1]
                $exeHit = $false
                foreach ($m in [regex]::Matches($text, '"name"\s+"([^"]+\.exe)"')) {
                    $exeName = [System.IO.Path]::GetFileNameWithoutExtension($m.Groups[1].Value)
                    if ($exeName -ieq $fg) { $exeHit = $true; break }
                }
                if ($exeHit) { return $gameName }
            } catch {}
        }
    }
    return $null
}

function Get-SteamPlayingGameLine {
    $steamEnabled = $true
    if ($config.steam -and $null -ne $config.steam.enabled) {
        $steamEnabled = [bool]$config.steam.enabled
    }
    if (-not $steamEnabled) { return $null }

    $steamPath = Get-SteamInstallPath
    if (-not $steamPath) { return $null }
    if (-not (Get-Process -Name steam -ErrorAction SilentlyContinue)) { return $null }

    $libraries = Get-SteamLibraryPaths -SteamPath $steamPath
    $prefix = '🎮 正在玩'
    if ($config.steam -and $config.steam.gamePrefix) {
        $prefix = [string]$config.steam.gamePrefix
    }

    $appId = Get-SteamRunningAppId -SteamPath $steamPath
    if ($appId -gt 0) {
        $name = Get-SteamAppDisplayName -AppId $appId -LibraryPaths $libraries
        if ($name) { return "$prefix $name" }
    }

    $fgName = Get-SteamGameFromForeground -SteamPath $steamPath -LibraryPaths $libraries
    if ($fgName) { return "$prefix $fgName" }

    return $null
}

function Get-ForegroundProcessStatus {
    $steamLine = Get-SteamPlayingGameLine
    if ($steamLine) { return $steamLine }

    $fg = Get-ForegroundProcessName
    if (-not $fg) { return $null }
    if ((Get-AllMusicProcessExeNames) -icontains $fg) { return $null }
    foreach ($prop in $config.processes.PSObject.Properties) {
        if ($fg -ieq $prop.Name) { return [string]$prop.Value }
    }
    $skip = @('explorer','SearchHost','ShellExperienceHost','ApplicationFrameHost','SystemSettings',
        'powershell','pwsh','cmd','WindowsTerminal','python','TextInputHost','StartMenuExperienceHost','msedgewebview2')
    if ($skip -notcontains $fg) {
        return Format-ActivityLine $fg
    }
    return $null
}

$script:LastPushTime = [datetime]::MinValue
$script:PushHeartbeatSeconds = 120

function Get-ListeningLine {
    $neteaseInfo = Get-NeteaseMusicFromWindow
    if ($neteaseInfo) {
        return Format-ListeningLine $neteaseInfo
    }

    $otherInfo = Get-NonNeteasePlayingMusicInfo
    if ($otherInfo) {
        return Format-ListeningLine $otherInfo
    }

    return $null
}

function Get-StatusPayload {
    $sep = [string]$config.statusSeparator
    if (-not $sep) { $sep = ' · ' }
    $displayMode = [string]$config.displayMode
    if (-not $displayMode) { $displayMode = 'merge' }
    $carouselSeconds = if ($config.carouselSeconds) { [int]$config.carouselSeconds } else { 8 }

    $idleThreshold = if ($config.idleSeconds) { [int]$config.idleSeconds } else { 300 }
    if ((Get-IdleSeconds) -ge $idleThreshold) {
        $idleText = if ($config.idle) { [string]$config.idle } else { 'zzz' }
        return @{
            text           = $idleText
            mode           = 'idle'
            primary        = $idleText
            secondary      = ''
            lines          = @($idleText)
            displayMode    = $displayMode
            carouselSeconds = $carouselSeconds
        }
    }

    $listenLine = Get-ListeningLine
    $activityLine = Get-ForegroundProcessStatus

    $default = [string]$config.default
    if (-not $default) { $default = 'online' }

    $primary = if ($activityLine) { $activityLine } else { $default }
    $secondary = if ($listenLine) { $listenLine } else { '' }

    $lines = @($primary)
    if ($secondary) { $lines += $secondary }

    $text = if ($displayMode -eq 'carousel') { $primary } else { ($lines -join $sep) }

    return @{
        text              = $text
        mode              = 'online'
        primary           = $primary
        secondary         = $secondary
        lines             = $lines
        displayMode       = $displayMode
        carouselSeconds   = $carouselSeconds
    }
}

function Invoke-GitStep {
    param([string[]]$GitArguments)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & git @GitArguments 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    foreach ($line in $output) { if ($line) { Write-Host "  $line" } }
    return ($code -eq 0)
}

function Update-StatusFile {
    $status = Get-StatusPayload
    $text = [string]$status.text

    $prevText = $null
    if (Test-Path $statusFile) {
        try { $prevText = (Get-Content $statusFile -Raw -Encoding UTF8 | ConvertFrom-Json).text } catch {}
    }

    $textChanged = ($prevText -ne $text)
    $payload = @{
        text              = $text
        updatedAt         = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        mode              = $status.mode
        primary           = $status.primary
        secondary         = $status.secondary
        lines             = $status.lines
        displayMode       = $status.displayMode
        carouselSeconds   = $status.carouselSeconds
    }
    $payloadJson = $payload | ConvertTo-Json -Compress -Depth 4

    [System.IO.File]::WriteAllText($statusFile, $payloadJson, [System.Text.UTF8Encoding]::new($false))

    if ($textChanged) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $text"
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] (unchanged) $text"
    }

    if ($Push) {
        $elapsed = ((Get-Date) - $script:LastPushTime).TotalSeconds
        if ($textChanged -or $elapsed -ge $script:PushHeartbeatSeconds) {
            if (Push-StatusToGit -PayloadJson $payloadJson) { $script:LastPushTime = Get-Date }
        }
    }
}

function Push-StatusToGit {
    param([string]$PayloadJson)
    Push-Location $repoRoot
    try {
        [void](Invoke-GitStep -GitArguments @('pull','--rebase','--autostash','origin','main'))
        [System.IO.File]::WriteAllText($statusFile, $PayloadJson, [System.Text.UTF8Encoding]::new($false))
        $dirty = git status --porcelain status.json 2>$null
        if (-not $dirty) {
            Write-Host "  (skip push: status.json unchanged on disk)"
            return $false
        }
        if (-not (Invoke-GitStep -GitArguments @('add','status.json'))) { return $false }
        if (-not (Invoke-GitStep -GitArguments @('commit','-m','chore: update live status'))) { return $false }
        if (-not (Invoke-GitStep -GitArguments @('push','origin','main'))) { return $false }
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
