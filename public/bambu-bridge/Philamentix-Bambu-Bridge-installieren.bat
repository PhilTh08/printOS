@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Philamentix-Bambu-Bridge-installieren.ps1"
if errorlevel 1 (
  echo.
  echo Installation fehlgeschlagen.
  pause
)
endlocal
