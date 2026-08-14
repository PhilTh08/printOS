@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo  Philamentix Hub V18.4.2 BETA - MODULE + SMOOTH SYNC FIX
echo ============================================================
echo.

if not exist package.json (
  echo FEHLER: package.json wurde nicht gefunden.
  echo.
  echo Bitte dieses ZIP direkt nach
  echo C:\Projekte\printos-filamentlager
  echo entpacken und dann diese BAT dort doppelklicken.
  echo.
  pause
  exit /b 1
)

echo [1/6] QR-Code Abhaengigkeit wird geprueft...
call npm.cmd list qrcode.react@4.2.0 --depth=0 >nul 2>&1
if errorlevel 1 (
  echo qrcode.react wird installiert...
  call npm.cmd install qrcode.react@4.2.0 --save-exact
  if errorlevel 1 (
    echo.
    echo FEHLER: qrcode.react konnte nicht installiert werden.
    echo Es wurde nichts gebaut oder gepusht.
    pause
    exit /b 1
  )
) else (
  echo qrcode.react@4.2.0 ist vorhanden.
)

echo.
echo [2/6] Alter Next-Build wird entfernt...
if exist .next rmdir /s /q .next

echo.
echo [3/6] Production Build wird geprueft...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo ============================================================
  echo  BUILD FEHLGESCHLAGEN
  echo ============================================================
  echo Es wurde NICHT committed und NICHT gepusht.
  echo.
  pause
  exit /b 1
)

echo.
echo [4/6] Nur V18.4.2 Dateien werden fuer Git vorbereitet...
git add "components/philamentix/hub-provider.tsx"
git add "components/philamentix/hub-shell.tsx"
git add "components/philamentix/maintenance.ts"
git add "app/(hub)/produktion/page.tsx"
git add "app/(hub)/produktion/page.module.css"
git add "app/(hub)/admin/page.tsx"
git add "app/(hub)/admin/page.module.css"
git add "app/api/admin/releases/route.ts"
git add "supabase/production_v18_1_to_v18_4.sql"
git add "README-V18.4.2-BETA.txt"
git add "VERSION.txt"
git add "V18.4.2-BETA-DEPLOYEN.bat"
if exist package.json git add package.json
if exist package-lock.json git add package-lock.json

echo.
echo [5/6] Commit wird erstellt...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Fix V18.4 beta modules and smooth sync"
  if errorlevel 1 (
    echo.
    echo FEHLER beim Git-Commit.
    echo Es wurde nichts gepusht.
    pause
    exit /b 1
  )
) else (
  echo Keine neuen Aenderungen fuer einen Commit gefunden.
)

echo.
echo [6/6] Push zu GitHub...
git push
if errorlevel 1 (
  echo.
  echo BUILD war erfolgreich, aber Git Push ist fehlgeschlagen.
  echo Der lokale Stand ist installiert. Vercel startet erst nach erfolgreichem Push.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  V18.4.2 BETA FERTIG - BUILD + PUSH ERFOLGREICH
echo ============================================================
echo.
echo Keine NEUE SQL-Migration fuer diesen Fix.
echo Die bekannte V18.1-V18.4 SQL liegt nur zur Sicherheit erneut bei.
echo.
echo Danach:
echo   Admin ^> Release
echo   18.1 / 18.2 / 18.3 / 18.4 direkt anklicken
echo.
echo Die Version wird SOFORT gespeichert.
echo Downgrade blendet Module nur aus - Daten bleiben erhalten.
echo.
pause
endlocal
