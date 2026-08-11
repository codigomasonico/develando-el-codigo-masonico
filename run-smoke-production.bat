@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not exist reports mkdir reports

set "PRODUCTION_URL=https://develandoelcodigomasonico.com"

echo ========================================
echo CARTES - PRODUCTION SMOKE TESTS
echo ========================================
echo URL: %PRODUCTION_URL%
echo.

node scripts\smoke-draft.mjs "%PRODUCTION_URL%" > reports\smoke-production-result.txt 2>&1
set RC=%ERRORLEVEL%

type reports\smoke-production-result.txt
echo.
if "%RC%"=="0" (
  echo SMOKE GATE: PASS
) else (
  echo SMOKE GATE: FAIL
)

echo.
echo Reporte TXT: reports\smoke-production-result.txt

exit /b %RC%
