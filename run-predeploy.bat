@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem ============================================================
rem CARTES - QUALITY GATE PRE-DEPLOY
rem Salida TXT 100%% UTF-8, sin mezcla UTF-16/ANSI
rem ============================================================

chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
set "NODE_DISABLE_COLORS=1"
set "NO_COLOR=1"
set "FORCE_COLOR=0"

if not exist "reports" mkdir "reports"

set "LOG=reports\predeploy-result.txt"
set "TMP=reports\predeploy-result.tmp"

if exist "%LOG%" del /q "%LOG%" >nul 2>&1
if exist "%TMP%" del /q "%TMP%" >nul 2>&1

echo ========================================
echo CARTES - QUALITY GATE PRE-DEPLOY
echo ========================================
echo.
echo Ejecutando pruebas...
echo El resultado completo se guardara en:
echo %LOG%
echo.

rem ------------------------------------------------------------
rem Node escribe UTF-8 directamente al archivo temporal.
rem No se usa PowerShell para capturar stdout, evitando UTF-16.
rem ------------------------------------------------------------
node scripts\predeploy-quality-gate.mjs > "%TMP%" 2>&1
set "CODE=!ERRORLEVEL!"

if "!CODE!"=="0" (
    set "RESULTADO=QUALITY GATE LOCAL PASS"
    set "SIGUIENTE=Siguiente paso: deploy draft de Netlify y smoke test."
) else (
    set "RESULTADO=QUALITY GATE LOCAL FAIL"
    set "SIGUIENTE=No hacer deploy hasta corregir los fallos."
)

rem ------------------------------------------------------------
rem Crear el TXT final en UTF-8.
rem El bloque ECHO usa code page 65001 y TYPE copia los bytes UTF-8
rem generados directamente por Node.
rem ------------------------------------------------------------
(
    echo ========================================
    echo CARTES - QUALITY GATE PRE-DEPLOY
    echo ========================================
    echo Fecha/Hora: %date% %time%
    echo Equipo: %COMPUTERNAME%
    echo Usuario: %USERNAME%
    echo.
) > "%LOG%"

type "%TMP%" >> "%LOG%"

(
    echo.
    echo RESULTADO: !RESULTADO!
    echo !SIGUIENTE!
    echo Codigo de salida: !CODE!
    echo Reporte JSON: reports\predeploy-quality-report.json
) >> "%LOG%"

del /q "%TMP%" >nul 2>&1

echo.
echo ========================================
echo RESULTADO
echo ========================================
type "%LOG%"
echo.
echo Reporte TXT:  %LOG%
echo Reporte JSON: reports\predeploy-quality-report.json
echo.

exit /b !CODE!
