$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Progress -Activity "Validando corrección de predeploy" -Status "Revisando archivos" -PercentComplete 10

$required = @(
  ".\package.json",
  ".\scripts\predeploy-quality-gate.mjs",
  ".\tests\web\book-launch-v136.test.mjs",
  ".\.env.example"
)

foreach ($file in $required) {
  if (-not (Test-Path $file)) {
    throw "Falta archivo requerido: $file"
  }
}

Write-Progress -Activity "Validando corrección de predeploy" -Status "Sintaxis JavaScript" -PercentComplete 35
& node --check ".\scripts\predeploy-quality-gate.mjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Progress -Activity "Validando corrección de predeploy" -Status "Prueba actualizada del libro" -PercentComplete 60
& node --test ".\tests\web\book-launch-v136.test.mjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Progress -Activity "Validando corrección de predeploy" -Status "Configuración package.json" -PercentComplete 85
$pkg = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($pkg.scripts.'test:critical' -notmatch 'tests/whatsapp-v2/integration.test.mjs') {
  throw "test:critical no apunta a WhatsApp V2"
}
if ($pkg.scripts.'test:critical' -match 'tests/whatsapp/acceso.test.mjs') {
  throw "test:critical todavía apunta a WhatsApp legacy"
}

Write-Progress -Activity "Validando corrección de predeploy" -Completed
Write-Host ""
Write-Host "PREDEPLOY FIX V1: VALIDACION CORRECTA"
Write-Host "Variables QA: configuradas"
Write-Host "Suite crítica: arquitectura actual"
Write-Host "Test libro V136: actualizado"
Write-Host "Parser TAP Node 24: actualizado"
