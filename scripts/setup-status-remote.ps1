# Setup remote status sync: GitHub secret Gist + Vercel env (no Git push)
$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$statusFile = Join-Path $repoRoot 'status.json'
$secretsFile = Join-Path $PSScriptRoot 'secrets.local.json'
$remoteMetaFile = Join-Path $PSScriptRoot '.status-remote.json'
$tokenFile = Join-Path $PSScriptRoot '.vercel-token'

function Get-GhToken {
    $t = & gh auth token 2>$null
    if (-not $t) { throw 'Run gh auth login first (gist scope required)' }
    return $t.Trim()
}

function New-RandomSecret {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $raw = [Convert]::ToBase64String($bytes)
    return ($raw -replace '\+', '-' -replace '/', '_' -replace '=', '')
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    return (Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Write-JsonFile {
    param([string]$Path, $Object)
    $json = $Object | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($Path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Ensure-SecretGist {
    param([string]$GhToken)
    $meta = Read-JsonFile $remoteMetaFile
    if ($meta -and $meta.gistId) {
        try {
            $check = Invoke-RestMethod -Uri "https://api.github.com/gists/$($meta.gistId)" -Headers @{
                Authorization = "Bearer $GhToken"
                'User-Agent'  = 'shiloku-setup'
                Accept        = 'application/vnd.github+json'
            }
            if ($check.id) {
                Write-Host "Reuse gist: $($meta.gistId)"
                return [string]$meta.gistId
            }
        } catch {
            Write-Host 'Old gist missing, creating new one...'
        }
    }

    $inputPath = $statusFile
    if (-not (Test-Path $inputPath)) {
        $inputPath = Join-Path $env:TEMP 'shiloku-status-seed.json'
        [System.IO.File]::WriteAllText($inputPath, '{"text":"online","updatedAt":null,"mode":"online"}', [System.Text.UTF8Encoding]::new($false))
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $gistLines = & gh gist create $inputPath --desc 'Shiloku live status (auto-sync, do not delete)' 2>&1
    $ErrorActionPreference = $prevEap
    $gistUrl = ($gistLines | Where-Object { "$_" -match 'gist\.github\.com/.+/[a-f0-9]{32}' } | Select-Object -Last 1)
    if (-not $gistUrl) { $gistUrl = ($gistLines | Select-Object -Last 1) }
    $gistUrl = "$gistUrl".Trim()
    if ($gistUrl -notmatch '/([a-f0-9]{32})$') { throw "Unexpected gist output: $gistLines" }
    $gistId = $Matches[1]
    Write-Host "Created secret gist: $gistId"
    return $gistId
}

function Get-VercelToken {
    if ($env:VERCEL_TOKEN) { return $env:VERCEL_TOKEN.Trim() }
    if (Test-Path $tokenFile) { return (Get-Content $tokenFile -Raw -Encoding UTF8).Trim() }
    return $null
}

function Get-VercelHeaders {
    param([string]$Token, [string]$TeamId)
    $h = @{ Authorization = "Bearer $Token" }
    if ($TeamId) { $h['x-vercel-team-id'] = $TeamId }
    return $h
}

function Find-ShilokuProject {
    param([string]$Token, [string]$TeamId)
    $headers = Get-VercelHeaders -Token $Token -TeamId $TeamId
    $uri = 'https://api.vercel.com/v9/projects?limit=50'
    if ($TeamId) { $uri = "${uri}&teamId=$TeamId" }
    $projects = Invoke-RestMethod -Uri $uri -Headers $headers
    foreach ($p in @($projects.projects)) {
        if ($p.name -eq 'shiloku') { return $p }
        if ($p.link -and ($p.link.repo -match 'shiloku')) { return $p }
    }
    if ($projects.projects -and $projects.projects.Count -gt 0) {
        Write-Host "Projects found: $(($projects.projects | ForEach-Object { $_.name }) -join ', ')"
        return $projects.projects[0]
    }
    throw 'Vercel project not found'
}

function Trigger-Redeploy {
    param([string]$Token, [string]$TeamId, [string]$ProjectId)
    $headers = Get-VercelHeaders -Token $Token -TeamId $TeamId
    try {
        $deployBody = @{
            name    = 'shiloku'
            project = $ProjectId
            target  = 'production'
            gitSource = @{
                type = 'github'
                repo = 'shiloku'
                ref  = 'main'
                org  = 'Avenir-L'
            }
        } | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Method Post -Uri 'https://api.vercel.com/v13/deployments' -Headers $headers -ContentType 'application/json' -Body $deployBody | Out-Null
        Write-Host 'Redeploy triggered.'
    } catch {
        Write-Host 'Env updated. Redeploy from Vercel dashboard if needed.'
    }
}

function Upsert-VercelEnv {
    param(
        [string]$Token,
        [string]$TeamId,
        [string]$ProjectId,
        [string]$Key,
        [string]$Value
    )
    $headers = Get-VercelHeaders -Token $Token -TeamId $TeamId
    $envUri = "https://api.vercel.com/v10/projects/$ProjectId/env"
    $existing = Invoke-RestMethod -Uri $envUri -Headers $headers
    $match = @($existing.envs) | Where-Object { $_.key -eq $Key } | Select-Object -First 1
    $body = @{
        key    = $Key
        value  = $Value
        type   = 'encrypted'
        target = @('production', 'preview', 'development')
    } | ConvertTo-Json -Depth 3
    if ($match) {
        Invoke-RestMethod -Method Delete -Uri "$envUri/$($match.id)" -Headers $headers | Out-Null
    }
    Invoke-RestMethod -Method Post -Uri $envUri -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
    Write-Host "  Vercel env set: $Key"
}

$ghToken = Get-GhToken
$gistId = Ensure-SecretGist -GhToken $ghToken

$secretsObj = Read-JsonFile $secretsFile
$secretsHash = @{}
if ($secretsObj) {
    $secretsObj.PSObject.Properties | ForEach-Object { $secretsHash[$_.Name] = $_.Value }
}
$syncSecret = if ($secretsHash['statusSyncSecret']) { [string]$secretsHash['statusSyncSecret'] } else { New-RandomSecret }
$secretsHash['statusSyncSecret'] = $syncSecret
Write-JsonFile $secretsFile $secretsHash
Write-Host 'Updated scripts/secrets.local.json'

Write-JsonFile $remoteMetaFile @{ gistId = $gistId; configuredAt = (Get-Date).ToUniversalTime().ToString('o') }

$vercelToken = Get-VercelToken
if ($vercelToken) {
    try {
        $user = Invoke-RestMethod -Uri 'https://api.vercel.com/v2/user' -Headers @{ Authorization = "Bearer $vercelToken" }
        $teamId = $user.user.defaultTeamId
        $project = Find-ShilokuProject -Token $vercelToken -TeamId $teamId
        Upsert-VercelEnv -Token $vercelToken -TeamId $teamId -ProjectId $project.id -Key 'STATUS_SYNC_SECRET' -Value $syncSecret
        Upsert-VercelEnv -Token $vercelToken -TeamId $teamId -ProjectId $project.id -Key 'STATUS_GIST_ID' -Value $gistId
        Upsert-VercelEnv -Token $vercelToken -TeamId $teamId -ProjectId $project.id -Key 'GITHUB_TOKEN' -Value $ghToken
        Write-Host 'Vercel env updated.'
        Trigger-Redeploy -Token $vercelToken -TeamId $teamId -ProjectId $project.id
    } catch {
        Write-Host "Vercel setup failed: $_"
        Write-Host 'Add STATUS_SYNC_SECRET, STATUS_GIST_ID, GITHUB_TOKEN manually in Vercel.'
    }
} else {
    Write-Host 'No .vercel-token found, skipped Vercel auto setup.'
    Write-Host "STATUS_GIST_ID=$gistId"
    Write-Host "STATUS_SYNC_SECRET=$syncSecret"
}

Write-Host 'Done.'
