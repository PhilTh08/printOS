@echo off
setlocal

echo Philamentix Hub V17.2 - Produktionsbuild
echo.
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo Build fehlgeschlagen. Bitte die komplette Fehlermeldung kopieren.
  exit /b 1
)

echo.
echo Build erfolgreich. V17.2 kann committed und gepusht werden.
exit /b 0
