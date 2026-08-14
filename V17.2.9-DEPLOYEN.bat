@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==============================================
echo   Philamentix Hub V17.2.9 - Rescan Deploy
echo ==============================================
echo.

echo [1/4] Alten Next.js Build-Cache entfernen...
if exist ".next" rmdir /s /q ".next"

echo [2/4] Production Build pruefen...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo BUILD FEHLGESCHLAGEN - es wurde NICHT gepusht.
  echo.
  pause
  exit /b 1
)

echo [3/4] Dateien zu Git hinzufuegen...
git add "app/(hub)/druckbibliothek/page.tsx"
git add "app/(hub)/druckbibliothek/page.module.css"
git add "supabase/print_library_v17_2_9.sql"
git add "V17.2.9-DEPLOYEN.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo Keine neuen Aenderungen zum Committen gefunden.
) else (
  git commit -m "Add V17.2.9 print library rescan"
  if errorlevel 1 (
    echo Git-Commit fehlgeschlagen.
    pause
    exit /b 1
  )
)

echo [4/4] Zu GitHub pushen...
git push
if errorlevel 1 (
  echo Git-Push fehlgeschlagen.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo   V17.2.9 FERTIG - BUILD + PUSH ERFOLGREICH
 echo ==============================================
echo.
echo Wichtig: print_library_v17_2_9.sql muss einmal
 echo im Supabase SQL Editor ausgefuehrt worden sein.
echo.
pause
