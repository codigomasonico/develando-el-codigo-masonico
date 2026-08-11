@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo CARTES - PREPARACION DE PRUEBAS LOCALES
echo ========================================
echo.
echo [1/2] Instalando dependencias...
call npm install
if errorlevel 1 goto :error

echo.
echo [2/2] Instalando Chromium para Playwright...
call npx playwright install chromium
if errorlevel 1 goto :error

echo.
echo Preparacion completada correctamente.
echo Ya puedes ejecutar run-predeploy.bat
exit /b 0

:error
echo.
echo ERROR: la preparacion no pudo completarse.
echo Revisa el mensaje anterior antes de continuar.
exit /b 1
