@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

if not exist reports mkdir reports

> reports\deploy-draft-result.txt (
  echo ========================================
  echo CARTES - NETLIFY DRAFT DEPLOY
  echo ========================================
  echo Fecha/Hora: %date% %time%
  echo Carpeta: %cd%
  echo.
)

echo ========================================
echo CARTES - NETLIFY DRAFT DEPLOY
echo ========================================
echo.
echo Este comando crea SOLO un Draft Deploy.
echo No utiliza --prod y no modifica produccion.
echo.

where netlify >nul 2>&1
if errorlevel 1 (
  echo ERROR: Netlify CLI no esta disponible en PATH.
  echo ERROR: Netlify CLI no esta disponible en PATH.>> reports\deploy-draft-result.txt
  exit /b 2
)

echo Verificando vinculacion con Netlify...
echo Verificando vinculacion con Netlify...>> reports\deploy-draft-result.txt

call netlify status > reports\netlify-status.txt 2>&1
set STATUS_RC=!ERRORLEVEL!
echo Codigo de salida netlify status: !STATUS_RC!>> reports\deploy-draft-result.txt

findstr /C:"Current project:" reports\netlify-status.txt >nul
if errorlevel 1 (
  type reports\netlify-status.txt
  echo.
  echo ERROR: esta carpeta no aparece vinculada a un proyecto Netlify.
  echo Ejecuta: netlify link
  echo ERROR: carpeta no vinculada.>> reports\deploy-draft-result.txt
  type reports\netlify-status.txt >> reports\deploy-draft-result.txt
  exit /b 3
)

echo OK: proyecto Netlify vinculado.
echo OK: proyecto Netlify vinculado.>> reports\deploy-draft-result.txt

type nul > reports\draft-deploy.json
type nul > reports\draft-deploy-error.txt

echo.
echo Creando Draft Deploy...
echo Creando Draft Deploy...>> reports\deploy-draft-result.txt

call netlify deploy --build --json 1>reports\draft-deploy.json 2>reports\draft-deploy-error.txt
set RC=!ERRORLEVEL!

echo Codigo de salida Netlify deploy: !RC!>> reports\deploy-draft-result.txt

if not "!RC!"=="0" (
  echo.
  echo ERROR: Netlify no pudo crear el Draft Deploy.
  echo.
  if exist reports\draft-deploy-error.txt type reports\draft-deploy-error.txt
  echo.>> reports\deploy-draft-result.txt
  echo ===== STDERR =====>> reports\deploy-draft-result.txt
  if exist reports\draft-deploy-error.txt type reports\draft-deploy-error.txt >> reports\deploy-draft-result.txt
  echo.>> reports\deploy-draft-result.txt
  echo ===== STDOUT =====>> reports\deploy-draft-result.txt
  if exist reports\draft-deploy.json type reports\draft-deploy.json >> reports\deploy-draft-result.txt
  exit /b !RC!
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$raw = Get-Content -Raw -Encoding UTF8 'reports\draft-deploy.json'; " ^
  "try { $j = $raw | ConvertFrom-Json } catch { Write-Error ('JSON invalido de Netlify: ' + $raw); exit 10 }; " ^
  "$u = $j.deploy_url; if (-not $u) { $u = $j.deploy_ssl_url }; if (-not $u) { $u = $j.url }; " ^
  "if (-not $u) { Write-Error ('No se encontro URL en la respuesta: ' + $raw); exit 11 }; " ^
  "[IO.File]::WriteAllText('reports\draft-url.txt', $u, [Text.UTF8Encoding]::new($false)); " ^
  "Write-Host ''; Write-Host 'DRAFT CREADO:'; Write-Host $u"

set PRC=!ERRORLEVEL!
if not "!PRC!"=="0" (
  echo ERROR: el deploy termino, pero no se pudo extraer la URL.
  echo ERROR: no se pudo extraer la URL.>> reports\deploy-draft-result.txt
  echo ===== RESPUESTA NETLIFY =====>> reports\deploy-draft-result.txt
  type reports\draft-deploy.json >> reports\deploy-draft-result.txt
  exit /b !PRC!
)

echo.
echo Produccion NO fue modificada.
echo URL guardada en reports\draft-url.txt
echo.
echo Produccion NO fue modificada.>> reports\deploy-draft-result.txt
echo URL guardada en reports\draft-url.txt>> reports\deploy-draft-result.txt
type reports\draft-url.txt >> reports\deploy-draft-result.txt

echo.
echo Siguiente paso:
echo   run-smoke-draft.bat
exit /b 0
