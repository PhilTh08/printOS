@echo off
setlocal

echo ==============================================
echo  Philamentix Hub V17.2 - Installation und Build
echo ==============================================
echo.

echo [1/3] Three.js wird installiert ...
call npm.cmd install --save-exact three@0.185.1
if errorlevel 1 goto :error

echo.
echo [2/3] TypeScript-Typen werden installiert ...
call npm.cmd install --save-dev --save-exact @types/three@0.185.1
if errorlevel 1 goto :error

echo.
echo [3/3] Produktionsbuild wird geprueft ...
call npm.cmd run build
if errorlevel 1 goto :build_error

echo.
echo ==============================================
echo  V17.2 wurde installiert. Build erfolgreich.
echo ==============================================
echo.
echo Fuehre jetzt in Supabase aus:
echo supabase\print_library_v17_2.sql
exit /b 0

:build_error
echo.
echo Der Build ist fehlgeschlagen. Es wurde nichts gepusht.
echo Kopiere die komplette Fehlermeldung in den Chat.
exit /b 1

:error
echo.
echo Installation fehlgeschlagen. Pruefe die npm-Ausgabe oben.
exit /b 1
