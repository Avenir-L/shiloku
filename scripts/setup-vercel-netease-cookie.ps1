# Login Vercel, set NETEASE_COOKIE env var, trigger redeploy
$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$cookieFile = Join-Path $PSScriptRoot 'netease.cookies.txt'
$tokenFile = Join-Path $PSScriptRoot '.vercel-token'
$clientId = 'cl_HYyOPBNtFMfHhaUn9L4QPfTZz6TP47bp'

function Convert-NetscapeCookiesToHeader {
    param([string]$Raw)
    $parts = @()
    foreach ($line in ($Raw -split "`r?`n")) {
        $line = $line.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $cols = $line -split "`t"
        if ($cols.Length -ge 7 -and $cols[5]) { $parts += "$($cols[5])=$($cols[6])" }
    }
    return ($parts -join '; ')
}

function Get-VercelToken {
    if ($env:VERCEL_TOKEN) { return $env:VERCEL_TOKEN.Trim() }
    if (Test-Path $tokenFile) { return (Get-Content $tokenFile -Raw -Encoding UTF8).Trim() }
    return $null
}

function Save-VercelToken {
    param([string]$Token)
    [System.IO.File]::WriteAllText($tokenFile, $Token.Trim(), [System.Text.UTF8Encoding]::new($false))
}

function Invoke-VercelDeviceLogin {
    Write-Host 'Opening browser - please click Authorize on the Vercel page...'
    $dev = Invoke-RestMethod -Method Post -Uri 'https://api.vercel.com/login/oauth/device-authorization' `
        -ContentType 'application/x-www-form-urlencoded' `
        -Body "client_id=$clientId&scope=openid offline_access"
    Start-Process $dev.verification_uri_complete
    $deadline = (Get-Date).AddSeconds([int]$dev.expires_in)
    $interval = [Math]::Max(3, [int]$dev.interval)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $interval
        try {
            $tokenRes = Invoke-RestMethod -Method Post -Uri 'https://api.vercel.com/login/oauth/token' `
                -ContentType 'application/x-www-form-urlencoded' `
                -Body "client_id=$clientId&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=$($dev.device_code)"
            if ($tokenRes.access_token) {
                Write-Host 'Vercel login OK.'
                return $tokenRes.access_token
            }
        } catch {
            $err = $_.ErrorDetails.Message
            if ($err -and $err -notmatch 'authorization_pending|slow_down') { throw }
        }
    }
    throw 'Login timed out. Complete browser authorization and run this script again.'
}

function Get-VercelApiToken {
    param([string]$OAuthAccessToken)
    try {
        $body = '{"name":"shiloku-netease-cookie","slug":"shiloku-netease-cookie"}'
        $created = Invoke-RestMethod -Method Post -Uri 'https://api.vercel.com/v3/user/tokens' `
            -Headers @{ Authorization = "Bearer $OAuthAccessToken" } `
            -ContentType 'application/json' `
            -Body $body
        if ($created.bearerToken) { return $created.bearerToken }
    } catch {
        Write-Host 'Using OAuth access token directly.'
    }
    return $OAuthAccessToken
}

function Get-VercelHeaders {
    param([string]$Token, [string]$TeamId)
    $h = @{ Authorization = "Bearer $Token" }
    if ($TeamId) { $h['x-vercel-team-id'] = $TeamId }
    return $h
}

function Get-DefaultTeamId {
    param([string]$Token)
    $user = Invoke-RestMethod -Uri 'https://api.vercel.com/v2/user' -Headers (Get-VercelHeaders -Token $Token)
    return $user.user.defaultTeamId
}

function Find-ShilokuProject {
    param([string]$Token, [string]$TeamId)
    $headers = Get-VercelHeaders -Token $Token -TeamId $TeamId
    $uri = 'https://api.vercel.com/v9/projects?limit=50'
    if ($TeamId) { $uri += "&teamId=$TeamId" }
    $projects = Invoke-RestMethod -Uri $uri -Headers $headers
    foreach ($p in @($projects.projects)) {
        if ($p.name -eq 'shiloku') { return $p }
        if ($p.link -and $p.link.repo -eq 'shiloku') { return $p }
    }
    if ($projects.projects -and $projects.projects.Count -gt 0) { return $projects.projects[0] }
    throw 'Vercel project for shiloku repo not found'
}

function Upsert-NeteaseCookieEnv {
    param([string]$Token, [string]$TeamId, [string]$ProjectId, [string]$CookieValue)
    $headers = Get-VercelHeaders -Token $Token -TeamId $TeamId
    $targets = @('production', 'preview', 'development')
    $envUri = "https://api.vercel.com/v10/projects/$ProjectId/env"
    $existing = Invoke-RestMethod -Uri $envUri -Headers $headers
    $match = @($existing.envs) | Where-Object { $_.key -eq 'NETEASE_COOKIE' } | Select-Object -First 1
    $body = @{
        key = 'NETEASE_COOKIE'
        value = $CookieValue
        type = 'encrypted'
        target = $targets
    } | ConvertTo-Json -Depth 3
    if ($match) {
        $delUri = "https://api.vercel.com/v10/projects/$ProjectId/env/$($match.id)"
        Invoke-RestMethod -Method Delete -Uri $delUri -Headers $headers | Out-Null
    }
    Invoke-RestMethod -Method Post -Uri $envUri `
        -Headers $headers `
        -ContentType 'application/json' `
        -Body $body | Out-Null
}

function Trigger-Redeploy {
    param([string]$Token, [string]$TeamId, [string]$ProjectId)
    $headers = Get-VercelHeaders -Token $Token -TeamId $TeamId
    try {
        $deployBody = @{
            name = 'shiloku'
            project = $ProjectId
            target = 'production'
            gitSource = @{
                type = 'github'
                repo = 'shiloku'
                ref = 'main'
                org = 'Avenir-L'
            }
        } | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Method Post -Uri 'https://api.vercel.com/v13/deployments' `
            -Headers $headers `
            -ContentType 'application/json' `
            -Body $deployBody | Out-Null
        Write-Host 'Redeploy triggered.'
    } catch {
        Write-Host 'Env updated. Redeploy manually in Vercel dashboard if needed.'
    }
}

if (-not (Test-Path $cookieFile)) {
    Write-Host 'Missing scripts/netease.cookies.txt'
    exit 1
}

$cookieHeader = Convert-NetscapeCookiesToHeader (Get-Content $cookieFile -Raw -Encoding UTF8)
if (-not $cookieHeader) {
    Write-Host 'Invalid cookie file.'
    exit 1
}

$token = Get-VercelToken
if (-not $token) {
    $oauth = Invoke-VercelDeviceLogin
    $token = Get-VercelApiToken -OAuthAccessToken $oauth
    Save-VercelToken $token
}

try {
    $user = Invoke-RestMethod -Uri 'https://api.vercel.com/v2/user' -Headers @{ Authorization = "Bearer $token" }
    Write-Host "Vercel user: $($user.user.username)"
} catch {
    Write-Host 'Stored token invalid, logging in again...'
    Remove-Item $tokenFile -ErrorAction SilentlyContinue
    $oauth = Invoke-VercelDeviceLogin
    $token = Get-VercelApiToken -OAuthAccessToken $oauth
    Save-VercelToken $token
}

$teamId = Get-DefaultTeamId -Token $token
$project = Find-ShilokuProject -Token $token -TeamId $teamId
Write-Host "Project: $($project.name) ($($project.id))"
Upsert-NeteaseCookieEnv -Token $token -TeamId $teamId -ProjectId $project.id -CookieValue $cookieHeader
Write-Host 'NETEASE_COOKIE set on Vercel.'
$syncConfigFile = Join-Path $PSScriptRoot 'netease-sync-config.json'
$redeploy = $false
if (Test-Path $syncConfigFile) {
    try {
        $syncCfg = Get-Content $syncConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($syncCfg.redeployOnCookieUpdate) { $redeploy = $true }
    } catch {}
}
if ($redeploy) {
    Trigger-Redeploy -Token $token -TeamId $teamId -ProjectId $project.id
} else {
    Write-Host 'Skip redeploy (redeployOnCookieUpdate=false). New cookie applies on next normal deploy.'
}
