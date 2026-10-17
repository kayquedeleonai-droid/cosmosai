@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" cosmos-selection-bridge.cjs
    pause
    exit /b
  )
  echo Instale Node.js 20 ou mais recente em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)
node cosmos-selection-bridge.cjs
pause
