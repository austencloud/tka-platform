@echo off
setlocal
REM Strip inherited NO_COLOR so Codex renders its intended TUI palette.
REM The resident tray launcher (AgentChooserHost) can freeze a transient
REM NO_COLOR=1 into its env and pass it to every child; clearing it here
REM makes the launch immune regardless of the host's frozen env.
set "NO_COLOR="
set "REPO_ROOT=%~dp0.."
set "SHORTCUT_DIR=%USERPROFILE%\launchers"
set "SHORTCUT=%SHORTCUT_DIR%\Codex - TKA Platform.lnk"
set "BAT_FILE=%~f0"
set "ICON=%REPO_ROOT%\scripts\launchers\icons\tka-platform.ico"
set "AGENT_TERMINAL=%LOCALAPPDATA%\AgentHub\bin\AgentTerminalLauncher.exe"

if not defined TKA_AGENT_TERMINAL if exist "%AGENT_TERMINAL%" (
    "%AGENT_TERMINAL%" -Agent codex -Project "%REPO_ROOT%" -Bat "%BAT_FILE%"
    exit /b
)

if not exist "%SHORTCUT%" (
    if not exist "%SHORTCUT_DIR%" mkdir "%SHORTCUT_DIR%"
    powershell -ExecutionPolicy Bypass -Command ^
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%');" ^
        "$s.TargetPath='C:\Windows\System32\cmd.exe';" ^
        "$s.Arguments='/c \"%BAT_FILE%\"';" ^
        "$s.WorkingDirectory='%REPO_ROOT%';" ^
        "$s.IconLocation='%ICON%,0';" ^
        "$s.Description='Launch Codex in TKA Platform';" ^
        "$s.Save()"
    echo Shortcut created: %SHORTCUT%
    echo Pin it to your taskbar from: %SHORTCUT_DIR%
    echo.
)

cd /d "%REPO_ROOT%"

rem Keep the repo-owned Codex footer synchronized across Windows machines.
rem The installer edits only tui.status_line and preserves every other setting.
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\launchers\install-codex-context-menu.ps1" -StatusLineOnly >nul 2>&1
if errorlevel 1 echo Warning: Codex status line setup failed; launching anyway.

set "TKA_CODEX=%LOCALAPPDATA%\TKA\codex-tka\bin\codex-tka.exe"
if not exist "%TKA_CODEX%" (
    echo Preparing the TKA Codex executable. A first local fallback can take several minutes.
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\launchers\install-codex-tka.ps1"
if errorlevel 1 echo Warning: Codex TKA update check failed; launching the installed executable if available.

if exist "%TKA_CODEX%" (
    "%TKA_CODEX%" --dangerously-bypass-approvals-and-sandbox
    exit /b %errorlevel%
)

echo Warning: codex-tka.exe is unavailable; falling back to the official Codex launcher.

where codex >nul 2>&1
if %errorlevel%==0 (
    codex --dangerously-bypass-approvals-and-sandbox
) else if exist "%APPDATA%\npm\codex.cmd" (
    "%APPDATA%\npm\codex.cmd" --dangerously-bypass-approvals-and-sandbox
) else (
    echo.
    echo codex was not found on PATH or in %APPDATA%\npm
    echo Reinstall with:  npm install -g @openai/codex
    echo.
    pause
)
