# 把 scripts/netease.cookies.txt 同步到 Vercel 环境变量 NETEASE_COOKIE（不会提交到 Git）
$ErrorActionPreference = 'Stop'
$cookieFile = Join-Path $PSScriptRoot 'netease.cookies.txt'
if (-not (Test-Path $cookieFile)) {
    Write-Host '找不到 netease.cookies.txt，请先放到 scripts 目录。'
    exit 1

}

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

$raw = Get-Content $cookieFile -Raw -Encoding UTF8
$header = Convert-NetscapeCookiesToHeader $raw
if (-not $header) {
    Write-Host 'Cookie 文件是空的或格式不对。'
    exit 1
}

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host '未安装 Vercel CLI。请先安装：npm i -g vercel'
    Write-Host '或在 Vercel 控制台手动添加环境变量 NETEASE_COOKIE。'
    exit 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repoRoot
try {
    Write-Host '正在更新 Vercel 环境变量 NETEASE_COOKIE（生产环境）...'
    $header | vercel env add NETEASE_COOKIE production --force
    Write-Host '完成。请在 Vercel 控制台触发一次重新部署。'
} finally {
    Pop-Location
}
