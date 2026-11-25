@echo off
rem Installs Barborka FX as an unsigned CEP extension for the current user (Windows).
rem Double-click, then restart After Effects / Premiere Pro.
setlocal
set "SRC=%~dp0.."
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.barborka.fx"

rem Unsigned panels load only with PlayerDebugMode on (CSXS 10, 11, 12).
for %%v in (10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy "%SRC%\CSXS" "%DEST%\CSXS\" /e /i /q >nul
xcopy "%SRC%\css" "%DEST%\css\" /e /i /q >nul
xcopy "%SRC%\js" "%DEST%\js\" /e /i /q >nul
xcopy "%SRC%\jsx" "%DEST%\jsx\" /e /i /q >nul
copy "%SRC%\index.html" "%DEST%\" >nul
copy "%SRC%\.debug" "%DEST%\" >nul
echo Installed to: %DEST%
echo Restart After Effects / Premiere Pro, then open Window ^> Extensions ^> Barborka FX.
pause
