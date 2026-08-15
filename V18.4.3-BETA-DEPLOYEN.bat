@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo  Philamentix Hub V18.4.3 BETA - DUAL SCAN
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

echo [1/5] QR-Code Abhaengigkeit wird geprueft...
call npm.cmd list qrcode.react@4.2.0 --depth=0 >nul 2>&1
if errorlevel 1 (
  echo qrcode.react wird installiert...
  call npm.cmd install qrcode.react@4.2.0 --save-exact
  if errorlevel 1 (
    echo.
    echo FEHLER: qrcode.react konnte nicht installiert werden.
    pause
    exit /b 1
  )
) else (
  echo qrcode.react@4.2.0 ist vorhanden.
)

echo.
echo [2/5] Alter Next-Build wird entfernt...
if exist .next rmdir /s /q .next

echo.
echo [3/5] Production Build wird geprueft...
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
echo [4/5] V18.4.3 Dateien werden fuer Git vorbereitet...
git add "app/(hub)/produktion/page.tsx"
git add "app/(hub)/produktion/page.module.css"
git add "README-V18.4.3-BETA.txt"
git add "VERSION.txt"
git add "V18.4.3-BETA-DEPLOYEN.bat"
if exist package.json git add package.json
if exist package-lock.json git add package-lock.json

echo.
echo [5/5] Commit + Push...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Add V18.4.3 dual scan labels"
  if errorlevel 1 (
    echo.
    echo FEHLER beim Git-Commit.
    pause
    exit /b 1
  )
) else (
  echo Keine neuen Aenderungen fuer einen Commit gefunden.
)

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
echo  V18.4.3 BETA FERTIG - BUILD + PUSH ERFOLGREICH
echo ============================================================
echo.
echo Keine neue SQL-Migration noetig.
echo In Produktion ^> Etiketten gibt es jetzt QR UND Barcode.
echo Das Scanfeld ist fuer Handscanner vorbereitet.
echo.
pause
endlocal
