@echo off
setlocal
cd /d "%~dp0"

echo.
echo ================================================
echo  Philamentix Hub V17.2.8.1 - Live Sync Fix
echo ================================================
echo.

if exist ".next" rmdir /s /q ".next"

echo [1/3] Build wird geprueft...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo BUILD FEHLGESCHLAGEN - nichts wurde gepusht.
  pause
  exit /b 1
)

echo.
echo [2/3] Git Commit...
git add components/philamentix/hub-provider.tsx VERSION.txt README-V17.2.8.1.txt V17.2.8.1-DEPLOYEN.bat

git diff --cached --quiet
if not errorlevel 1 goto PUSH

git commit -m "Fix maintenance live sync for users"
if errorlevel 1 (
  echo Git Commit fehlgeschlagen.
  pause
  exit /b 1
)

:PUSH
echo.
echo [3/3] Push zu GitHub...
git push
if errorlevel 1 (
  echo Git Push fehlgeschlagen.
  pause
  exit /b 1
)

echo.
echo ================================================
echo  V17.2.8.1 FERTIG - BUILD UND PUSH ERFOLGREICH
echo ================================================
echo.
pause
