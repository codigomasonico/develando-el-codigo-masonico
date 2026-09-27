$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$TestFile = Join-Path $Root "tests\admin\cartes-admin-v4.test.mjs"
$IndexFile = Join-Path $Root "channels\web\public\admin\cartes\index.html"
$StatsFile = Join-Path $Root "netlify\lib\cartes-admin-stats.js"

function Fail([string]$Message) {
    Write-Progress -Activity "Validando Cartes Admin V4" -Completed
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

Write-Progress -Activity "Validando Cartes Admin V4" -Status "Archivos" -PercentComplete 10
$Required = @(
    "channels\web\public\admin\cartes\index.html",
    "channels\web\public\admin\cartes\admin.css",
    "netlify\lib\cartes-admin-auth.js",
    "netlify\lib\cartes-admin-stats.js",
    "netlify\functions\cartes-admin-login.js",
    "netlify\functions\cartes-admin-logout.js",
    "netlify\functions\cartes-admin-stats.js",
    "tests\admin\cartes-admin-v4.test.mjs",
    "scripts\start-cartes-admin-local.ps1"
)
foreach ($Relative in $Required) {
    if (-not (Test-Path (Join-Path $Root $Relative))) { Fail "Falta $Relative" }
}

Write-Progress -Activity "Validando Cartes Admin V4" -Status "Frontend" -PercentComplete 30
$html = Get-Content $IndexFile -Raw
if ($html -match '<script\s+src=' -or $html -match 'admin\.js' -or $html -match 'dashboard\.js') {
    Fail "index.html todavía depende de JavaScript externo viejo."
}

Write-Progress -Activity "Validando Cartes Admin V4" -Status "Netlify Blobs" -PercentComplete 45
$stats = Get-Content $StatsFile -Raw
if ($stats -match 'consistency\s*:\s*["'']strong["'']') {
    Fail "El dashboard sigue forzando strong consistency."
}
if ($stats -notmatch 'getStore\(STORE_NAME\)') {
    Fail "El dashboard no usa el acceso estándar a cartes-core."
}
if ($stats -notmatch 'channelQueryMatch' -or $stats -notmatch 'channelsTotal30 === queries30') {
    Fail "Falta la validación de consistencia Canal 30d = Consultas 30d."
}

Write-Progress -Activity "Validando Cartes Admin V4" -Status "Pruebas automatizadas" -PercentComplete 70
Push-Location $Root
try {
    & node --test $TestFile
    if ($LASTEXITCODE -ne 0) { Fail "Fallaron las pruebas automatizadas." }
}
finally { Pop-Location }

Write-Progress -Activity "Validando Cartes Admin V4" -Completed
Write-Host ""
Write-Host "CARTES ADMIN V4: VALIDACION CORRECTA" -ForegroundColor Green
Write-Host "Pruebas: OK"
Write-Host "Blobs: modo compatible con Netlify Dev y producción"
Write-Host "Frontend: OK"
exit 0
