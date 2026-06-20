# Push scripts/netease.cookies.txt to Vercel NETEASE_COOKIE
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'netease-cookie-vercel.ps1')

$cookieFile = Join-Path $PSScriptRoot 'netease.cookies.txt'
if (-not (Test-Path $cookieFile)) {
    Write-Host 'Missing scripts/netease.cookies.txt'
    exit 1
}

if (Push-NeteaseCookieToVercel -CookieFile $cookieFile) {
    Write-Host 'Done.'
    exit 0
}
exit 1
