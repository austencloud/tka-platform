@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "SHORTCUT_DIR=%USERPROFILE%\launchers"
set "SHORTCUT=%SHORTCUT_DIR%\TKA Platform.lnk"
set "BAT_FILE=%~f0"
set "ICON=%~dp0icons\tka-platform.ico"

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
claude --dangerously-skip-permissions
