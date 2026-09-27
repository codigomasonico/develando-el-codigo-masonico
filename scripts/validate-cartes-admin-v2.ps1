$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env"
$TestFile = Join-Path $Root "tests\admin\cartes-admin-v2.test.mjs"
$IndexFile = Join-Path $Root "channels\web\public\admin\cartes\index.html"

function Fail([string]$Message) {
    Write-Progress -Activity "Validando Cartes Admin V2" -Completed
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

Write-Progress -Activity "Validando Cartes Admin V2" -Status "Archivos" -PercentComplete 10

$Required = @(
    "channels\web\public\admin\cartes\index.html",
    "channels\web\public\admin\cartes\admin.css",
    "netlify\lib\cartes-admin-auth.js",
    "netlify\lib\cartes-admin-stats.js",
    "netlify\functions\cartes-admin-login.js",
    "netlify\functions\cartes-admin-logout.js",
    "netlify\functions\cartes-admin-stats.js",
    "tests\admin\cartes-admin-v2.test.mjs"
)

foreach ($Relative in $Required) {
    if (-not (Test-Path (Join-Path $Root $Relative))) {
        Fail "Falta $Relative"
    }
}

Write-Progress -Activity "Validando Cartes Admin V2" -Status "Frontend" -PercentComplete 25
$html = Get-Content $IndexFile -Raw
if ($html -match '<script\s+src=' -or $html -match 'admin\.js' -or $html -match 'dashboard\.js') {
    Fail "index.html todavía referencia JavaScript externo de la versión anterior."
}

Write-Progress -Activity "Validando Cartes Admin V2" -Status "Credenciales locales" -PercentComplete 40
if (-not (Test-Path $EnvFile)) {
    Fail "No existe .env en la raíz de web2."
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
if (-not $password) { Fail "Falta CARTES_ADMIN_PASSWORD en .env." }
if (-not $secret -or $secret.Length -lt 32) { Fail "CARTES_ADMIN_SESSION_SECRET debe tener al menos 32 caracteres en .env." }

$env:CARTES_ADMIN_LOCAL_PASSWORD = $password
$env:CARTES_ADMIN_LOCAL_SESSION_SECRET = $secret

Write-Progress -Activity "Validando Cartes Admin V2" -Status "Pruebas automatizadas" -PercentComplete 60
Push-Location $Root
try {
    & node --test $TestFile
    if ($LASTEXITCODE -ne 0) { Fail "Fallaron las pruebas automatizadas." }

    Write-Progress -Activity "Validando Cartes Admin V2" -Status "Login local" -PercentComplete 85
    $loginTest = @'
import("./netlify/functions/cartes-admin-login.js").then(async ({handler}) => {
  const result = await handler({
    httpMethod: "POST",
    headers: { host: "localhost:8888" },
    body: JSON.stringify({ password: process.env.CARTES_ADMIN_LOCAL_PASSWORD })
  });
  const body = JSON.parse(result.body || "{}");
  if (result.statusCode !== 200 || body.ok !== true || !body.token) process.exit(2);
  console.log("LOGIN_LOCAL_OK");
}).catch(() => process.exit(3));
'@
    & node --input-type=module -e $loginTest
    if ($LASTEXITCODE -ne 0) { Fail "El login local no pudo generar una sesión válida." }
}
finally {
    Pop-Location
}

Write-Progress -Activity "Validando Cartes Admin V2" -Completed
Write-Host ""
Write-Host "CARTES ADMIN V2: VALIDACION CORRECTA" -ForegroundColor Green
Write-Host "Pruebas: OK"
Write-Host "Login local: OK"
exit 0
