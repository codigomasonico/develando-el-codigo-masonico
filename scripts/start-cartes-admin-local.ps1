$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env"

if (-not (Test-Path $EnvFile)) {
    Write-Host "ERROR: No existe $EnvFile" -ForegroundColor Red
    exit 1
}

$values = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $pos = $line.IndexOf("=")
    if ($pos -le 0) { return }
    $name = $line.Substring(0, $pos).Trim()
    $value = $line.Substring($pos + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
}

$password = $values["CARTES_ADMIN_PASSWORD"]
$secret = $values["CARTES_ADMIN_SESSION_SECRET"]

if (-not $password) {
    Write-Host "ERROR: Falta CARTES_ADMIN_PASSWORD en .env" -ForegroundColor Red
    exit 1
}

if (-not $secret -or $secret.Length -lt 32) {
    Write-Host "ERROR: CARTES_ADMIN_SESSION_SECRET debe tener al menos 32 caracteres en .env" -ForegroundColor Red
    exit 1
}

$env:CARTES_ADMIN_LOCAL_PASSWORD = $password
$env:CARTES_ADMIN_LOCAL_SESSION_SECRET = $secret

Write-Host "Cartes Admin local configurado." -ForegroundColor Green
Write-Host "Abre: http://localhost:8888/admin/cartes/"
Write-Host "Detener servidor: Ctrl+C"
Write-Host ""

Set-Location $Root
npx netlify dev
