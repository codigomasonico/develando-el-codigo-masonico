@echo off
setlocal

node --check bot\functions\config.mjs || exit /b 1
node --check bot\functions\direct-answer.mjs || exit /b 1
node --check bot\functions\guia-masonico.mjs || exit /b 1
node --check bot\functions\knowledge.mjs || exit /b 1
node --check bot\functions\router.mjs || exit /b 1
node --check bot\functions\safety.mjs || exit /b 1
node --check bot\functions\terminology.mjs || exit /b 1
node --check bot\functions\validator.mjs || exit /b 1
node --check bot\guia-masonico.js || exit /b 1
node --check bot\tests\runner.mjs || exit /b 1
node bot\tests\runner.mjs || exit /b 1

echo.
echo VALIDACION COMPLETA: TODO CORRECTO
endlocal
