@echo off
setlocal
cd /d "%~dp0"
title Philamentix Hub V17.2.8 - Build und Deploy

echo ======================================================
echo   PHILAMENTIX HUB V17.2.8 - BUILD UND DEPLOY
echo   Bereiche ausblenden + Admin UI Fix
echo   Projekt: %CD%
echo ======================================================
echo.

if not exist "package.json" (
  echo [FEHLER] package.json wurde hier nicht gefunden.
  echo Bitte dieses ZIP DIREKT nach
  echo C:\Projekte\printos-filamentlager
  echo entpacken und vorhandene Dateien ersetzen.
  echo.
  pause
  exit /b 1
)

if not exist "components\philamentix\maintenance.ts" (
  echo [FEHLER] maintenance.ts fehlt. ZIP bitte erneut direkt ins Projekt entpacken.
  pause
  exit /b 1
)

if not exist "supabase\maintenance_hidden_v17_2_8.sql" (
  echo [FEHLER] SQL-Migration fehlt.
  pause
  exit /b 1
)

echo WICHTIG:
echo Falls noch nicht geschehen, fuehre vor dem Testen von AUSBLENDEN einmal
echo supabase\maintenance_hidden_v17_2_8.sql im Supabase SQL Editor aus.
echo.
pause

echo [1/4] Alten Next.js Build-Cache entfernen...
if exist ".next" rmdir /s /q ".next"

echo.
echo [2/4] Production-Build pruefen...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo ======================================================
  echo   BUILD FEHLGESCHLAGEN - NICHTS WURDE GEPUSHT
  echo ======================================================
  echo.
  pause
  exit /b 1
)

echo.
echo [3/4] V17.2.8 zu Git hinzufuegen...
git add -- "app/(hub)/admin/page.tsx" "app/(hub)/admin/page.module.css" "app/api/admin/maintenance/route.ts" "app/globals.css" "components/philamentix/hub-provider.tsx" "components/philamentix/hub-shell.tsx" "components/philamentix/maintenance.ts" "supabase/maintenance_hidden_v17_2_8.sql" "VERSION.txt" "README-V17.2.8.txt" "V17.2.8-DEPLOYEN.bat"

set CHANGED=
for /f "delims=" %%A in ('git status --porcelain -- "app/(hub)/admin/page.tsx" "app/(hub)/admin/page.module.css" "app/api/admin/maintenance/route.ts" "app/globals.css" "components/philamentix/hub-provider.tsx" "components/philamentix/hub-shell.tsx" "components/philamentix/maintenance.ts" "supabase/maintenance_hidden_v17_2_8.sql" "VERSION.txt" "README-V17.2.8.txt" "V17.2.8-DEPLOYEN.bat"') do set CHANGED=1

if defined CHANGED (
  git commit -m "Add V17.2.8 hidden areas control"
  if errorlevel 1 (
    echo [FEHLER] Git-Commit fehlgeschlagen.
    pause
    exit /b 1
  )
) else (
  echo Keine neuen Aenderungen zu committen.
)

echo.
echo [4/4] Zu GitHub pushen...
git push
if errorlevel 1 (
  echo.
  echo [FEHLER] git push ist fehlgeschlagen.
  pause
  exit /b 1
)

echo.
echo ======================================================
echo   V17.2.8 FERTIG - BUILD UND PUSH ERFOLGREICH
echo   Vercel sollte jetzt automatisch deployen.
echo ======================================================
echo.
pause
endlocal
