@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not exist reports mkdir reports

if not exist reports\draft-url.txt (
  echo ERROR: no existe reports\draft-url.txt
  echo Ejecuta primero deploy-draft.bat
  exit /b 2
)

set /p DRAFT_URL=<reports\draft-url.txt

echo ========================================
echo CARTES - DRAFT SMOKE TESTS
echo ========================================
echo URL: %DRAFT_URL%
echo.

node scripts\smoke-draft.mjs "%DRAFT_URL%" > reports\smoke-draft-result.txt 2>&1
set RC=%ERRORLEVEL%

type reports\smoke-draft-result.txt
echo.
if "%RC%"=="0" (
  echo SMOKE GATE: PASS
) else (
  echo SMOKE GATE: FAIL
)

exit /b %RC%
