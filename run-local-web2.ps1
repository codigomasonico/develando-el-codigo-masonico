$ErrorActionPreference = "Stop"
$P = Split-Path -Parent $MyInvocation.MyCommand.Path
$Reports = Join-Path $P "reports"
New-Item -ItemType Directory -Force $Reports | Out-Null
$R = Join-Path $Reports "$(Get-Date -Format 'yyMMdd-HHmm')-DEV-WEB2-pruebas-locales.txt"

Set-Location $P

& npm run test:local-web2 *> $R
$Code = $LASTEXITCODE
"EXIT_CODE=$Code" | Out-File -LiteralPath $R -Append -Encoding utf8
exit $Code
