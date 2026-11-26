@echo off
rem Installs the Glitch Rig fuses and Edit-page templates for DaVinci Resolve
rem (Windows, current user). Double-click, then restart Resolve.
setlocal
set "SRC=%~dp0.."
set "DEST=%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion"

for %%d in ("Fuses\GlitchRig" "Templates\Edit\Effects\Glitch Rig" "Templates\Edit\Transitions\Glitch Rig" "Templates\Edit\Titles\Glitch Rig") do (
  if exist "%DEST%\%%~d" rmdir /s /q "%DEST%\%%~d"
)
xcopy "%SRC%\Fuses\GlitchRig" "%DEST%\Fuses\GlitchRig\" /e /i /q >nul
xcopy "%SRC%\Templates\Edit\Effects\Glitch Rig" "%DEST%\Templates\Edit\Effects\Glitch Rig\" /e /i /q >nul
xcopy "%SRC%\Templates\Edit\Transitions\Glitch Rig" "%DEST%\Templates\Edit\Transitions\Glitch Rig\" /e /i /q >nul
xcopy "%SRC%\Templates\Edit\Titles\Glitch Rig" "%DEST%\Templates\Edit\Titles\Glitch Rig\" /e /i /q >nul
echo Installed to: %DEST%
echo Restart DaVinci Resolve, then look for "Glitch Rig" in the Effects library.
pause
