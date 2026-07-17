@echo off
setlocal
set "REPO_ROOT=%~dp0.."
set "SHORTCUT_DIR=%USERPROFILE%\launchers"
set "SHORTCUT=%SHORTCUT_DIR%\TKA Platform.lnk"
set "BAT_FILE=%~f0"
set "ICON=%REPO_ROOT%\scripts\launchers\icons\tka-platform.ico"

if not exist "%SHORTCUT%" (
    if not exist "%SHORTCUT_DIR%" mkdir "%SHORTCUT_DIR%"
    powershell -ExecutionPolicy Bypass -Command ^
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%');" ^
        "$s.TargetPath='C:\Windows\System32\cmd.exe';" ^
        "$s.Arguments='/c \"%BAT_FILE%\"';" ^
        "$s.WorkingDirectory='%REPO_ROOT%';" ^
        "$s.IconLocation='%ICON%,0';" ^
        "$s.Description='Launch Claude Code in TKA Platform';" ^
        "$s.Save()"
    echo Shortcut created: %SHORTCUT%
    echo Pin it to your taskbar from: %SHORTCUT_DIR%
    echo.
)

cd /d "%REPO_ROOT%"

where claude >nul 2>&1
if %errorlevel%==0 (
    claude --dangerously-skip-permissions
) else if exist "%USERPROFILE%\.local\bin\claude.exe" (
    "%USERPROFILE%\.local\bin\claude.exe" --dangerously-skip-permissions
) else (
    echo.
    echo claude was not found on PATH or in %USERPROFILE%\.local\bin
    echo Reinstall with:  irm https://claude.ai/install.ps1 ^| iex
    echo.
    pause
)