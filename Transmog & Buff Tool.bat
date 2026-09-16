@echo off
setlocal
cd /d "%~dp0"
set "NODE=node\node.exe"
if not exist "%NODE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo This copy has no bundled runtime and Node.js is not installed.
    echo Download the release zip from the mod page, or install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
  )
  set "NODE=node"
  if not exist node_modules (
    echo First start: installing the menu library...
    call npm install --omit=dev --no-audit --no-fund
  )
)
"%NODE%" src\cli.js %*
if errorlevel 1 pause
endlocal
