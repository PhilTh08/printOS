@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo  Philamentix Hub V18.0 BETA - Deploy
echo ==============================================
echo.

if not exist package.json (
  echo FEHLER: package.json wurde nicht gefunden.
  echo Bitte dieses ZIP direkt nach
  echo C:\Projekte\printos-filamentlager entpacken.
  echo.
  pause
  exit /b 1
)

if exist .next rmdir /s /q .next

echo [1/3] Production Build wird geprueft...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo BUILD FEHLGESCHLAGEN - es wurde nichts gepusht.
  pause
  exit /b 1
)

echo.
echo [2/3] Dateien werden fuer Git vorbereitet...
git add "app/(hub)/produktion/page.tsx"
git add "app/(hub)/produktion/page.module.css"
git add "components/philamentix/hub-shell.tsx"
git add "components/philamentix/maintenance.ts"
git add "supabase/production_v18_0.sql"
git add "README-V18.0-BETA.txt"
git add "VERSION.txt"
git add "V18.0-BETA-DEPLOYEN.bat"

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Add V18.0 beta production center"
  if errorlevel 1 (
    echo.
    echo FEHLER beim Git-Commit.
    pause
    exit /b 1
  )
) else (
  echo Keine neuen Aenderungen fuer einen Commit gefunden.
)

echo.
echo [3/3] Push zu GitHub...
git push
if errorlevel 1 (
  echo.
  echo BUILD war erfolgreich, aber Git Push ist fehlgeschlagen.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo  V18.0 BETA FERTIG - BUILD + PUSH ERFOLGREICH
 echo ==============================================
echo.
echo Naechster Schritt:
echo - production_v18_0.sql in Supabase ausfuehren
echo - Admin ^> Release: BETA // 18.0 aktivieren
echo - Testaccount als Beta-Tester freischalten
pause
endlocal
