param(
    [switch]$Loop,
    [switch]$Push,
    [int]$IntervalSeconds = 15
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$statusFile = Join-Path $repoRoot "status.json"
$configFile = Join-Path $PSScriptRoot "status-config.json"
$config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-WindowTitleStatus {
    param([string]$ProcessName, $Meta)

    $proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim() -ne "" } |
        Select-Object -First 1

    if (-not $proc) { return $null }

    $title = $proc.MainWindowTitle.Trim()
    $icon = $Meta.icon
    $fallback = "$icon $($Meta.fallback)"

    if ($title -match " - ") {
        $parts = $title -split " - ", 2
        $song = $parts[0].Trim()
        $artist = $parts[1].Trim()
        if ($song -and $artist) {
            return "$icon $song - $artist"
        }
    }

    if ($title.Length -gt 1) {
        return "$icon $title"
    }

    return $fallback
}

function Get-StatusText {
    foreach ($prop in $config.musicApps.PSObject.Properties) {
        $status = Get-WindowTitleStatus -ProcessName $prop.Name -Meta $prop.Value
        if ($status) { return $status }
    }

    $running = @(Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $_.ProcessName } | Select-Object -Unique)
    foreach ($prop in $config.processes.PSObject.Properties) {
        if ($running -contains $prop.Name) {
            return $prop.Value
        }
    }

    return $config.default
}

$script:LastPushTime = [datetime]::MinValue

function Update-StatusFile {
    $text = Get-StatusText
    $payload = @{
        text      = $text
        updatedAt = (Get-Date).ToUniversalTime().ToString("o")
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
        # 状态变了立刻推；没变也每 90 秒推一次心跳，让网站知道电脑还在线
        if ($textChanged -or $elapsed -gt 90) {
            Push-StatusToGit
            $script:LastPushTime = Get-Date
        }
    }
}

function Push-StatusToGit {
    Push-Location $repoRoot
    try {
        $dirty = git status --porcelain status.json 2>$null
        if (-not $dirty) { return }
        git add status.json
        git commit -m "chore: update live status"
        git push origin main
        Write-Host "  pushed to GitHub"
    } catch {
        Write-Host "  push failed: $_"
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
