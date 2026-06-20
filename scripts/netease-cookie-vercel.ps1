function Convert-NetscapeCookiesToHeader {
    param([string]$Raw)
    $parts = @()
    foreach ($line in ($Raw -split "`r?`n")) {
        $line = $line.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $cols = $line -split "`t"
        if ($cols.Length -ge 7 -and $cols[5]) {
            $parts += "$($cols[5])=$($cols[6])"
        }
    }
    return ($parts -join '; ')
}

function Get-NeteaseSyncConfig {
    $configFile = Join-Path $PSScriptRoot 'netease-sync-config.json'
    $config = @{
        vercelProjectId = 'prj_2U1vvvwX0I4sftAHbh1tJ2m3iHo8'
        vercelProjectName = 'avenir'
        pushToVercel = $true
    }
    if (Test-Path $configFile) {
        try {
            $loaded = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($prop in $loaded.PSObject.Properties) {
                $config[$prop.Name] = $prop.Value
            }
        } catch {}
    }
    return $config
}

function Get-VercelTokenFromFile {
    $tokenFile = Join-Path $PSScriptRoot '.vercel-token'
    if ($env:VERCEL_TOKEN) { return $env:VERCEL_TOKEN.Trim() }
    if (Test-Path $tokenFile) { return (Get-Content $tokenFile -Raw -Encoding UTF8).Trim() }
    return $null
}

function Get-VercelApiHeaders {
    param([string]$Token, [string]$TeamId)
    $headers = @{ Authorization = "Bearer $Token" }
    if ($TeamId) { $headers['x-vercel-team-id'] = $TeamId }
    return $headers
}

function Get-VercelTeamId {
    param([string]$Token)
    try {
        $user = Invoke-RestMethod -Uri 'https://api.vercel.com/v2/user' -Headers @{ Authorization = "Bearer $Token" }
        return [string]$user.user.defaultTeamId
    } catch {
        return $null
    }
}

function Push-NeteaseCookieToVercel {
    param(
        [string]$CookieFile = (Join-Path $PSScriptRoot 'netease.cookies.txt'),
        [switch]$Force
    )

    $config = Get-NeteaseSyncConfig
    if (-not $config.pushToVercel) {
        Write-Host 'Skip Vercel push (pushToVercel=false).'
        return $false
    }
    if (-not (Test-Path $CookieFile)) {
        Write-Host 'Cookie file missing.'
        return $false
    }

    $header = Convert-NetscapeCookiesToHeader (Get-Content $CookieFile -Raw -Encoding UTF8)
    if (-not $header) {
        Write-Host 'Cookie file invalid.'
        return $false
    }

    $hash = [BitConverter]::ToString(
        [System.Security.Cryptography.SHA256]::Create().ComputeHash(
            [System.Text.UTF8Encoding]::new($false).GetBytes($header)
        )
    ).Replace('-', '').ToLowerInvariant()

    $stateFile = Join-Path $PSScriptRoot '.netease-cookie-push-state.json'
    $minHours = 24
    if ($config.pushMinIntervalHours) { $minHours = [int]$config.pushMinIntervalHours }
    if ($minHours -lt 1) { $minHours = 1 }

    if (-not $Force -and (Test-Path $stateFile)) {
        try {
            $state = Get-Content $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($state.hash -eq $hash) {
                Write-Host 'Skip Vercel push (cookie unchanged).'
                return $false
            }
            if ($state.pushedAt) {
                $last = [datetime]::Parse($state.pushedAt)
                if (((Get-Date) - $last).TotalHours -lt $minHours) {
                    Write-Host "Skip Vercel push (min interval ${minHours}h)."
                    return $false
                }
            }
        } catch {}
    }

    $token = Get-VercelTokenFromFile
    if (-not $token) {
        Write-Host 'No Vercel token. Run setup-vercel-netease-cookie.ps1 once.'
        return $false
    }

    $teamId = Get-VercelTeamId -Token $token
    $headers = Get-VercelApiHeaders -Token $token -TeamId $teamId
    $projectId = [string]$config.vercelProjectId
    if (-not $projectId) {
        Write-Host 'Missing vercelProjectId in netease-sync-config.json'
        return $false
    }

    $envUri = "https://api.vercel.com/v10/projects/$projectId/env"
    $existing = Invoke-RestMethod -Uri $envUri -Headers $headers
    $match = @($existing.envs) | Where-Object { $_.key -eq 'NETEASE_COOKIE' } | Select-Object -First 1
    $body = @{
        key = 'NETEASE_COOKIE'
        value = $header
        type = 'encrypted'
        target = @('production', 'preview', 'development')
    } | ConvertTo-Json -Depth 3

    if ($match) {
        $delUri = "https://api.vercel.com/v10/projects/$projectId/env/$($match.id)"
        Invoke-RestMethod -Method Delete -Uri $delUri -Headers $headers | Out-Null
    }
    Invoke-RestMethod -Method Post -Uri $envUri -Headers $headers -ContentType 'application/json' -Body $body | Out-Null

    $statePayload = @{
        hash = $hash
        pushedAt = (Get-Date).ToString('o')
    } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($stateFile, $statePayload, [System.Text.UTF8Encoding]::new($false))

    Write-Host "NETEASE_COOKIE updated on Vercel project $($config.vercelProjectName) ($projectId)."
    return $true
}
