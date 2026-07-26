@echo off
setlocal
REM Strip inherited NO_COLOR so Claude Code renders its orange branding.
REM The resident tray launcher (AgentChooserHost) can freeze a transient
REM NO_COLOR=1 into its env and pass it to every child; clearing it here
REM makes the launch immune regardless of the host's frozen env.
set "NO_COLOR="
REM Strip inherited Claude session markers. A launcher (or terminal) started
REM from inside a Claude Code session freezes CLAUDE_CODE_CHILD_SESSION=1 into
REM its env and passes it to every child. Claude Code reads that marker as
REM "I am a nested session" and silently turns OFF transcript saving, so the
REM session never appears in /resume. Clearing it here makes each launch a
REM real top-level session regardless of what started the launcher.
set "CLAUDE_CODE_CHILD_SESSION="
set "CLAUDE_CODE_SESSION_ID="
set "CLAUDE_CODE_BRIDGE_SESSION_ID="
set "CLAUDE_CODE_ENTRYPOINT="
set "CLAUDECODE="
set "CLAUDE_PID="
set "REPO_ROOT=%~dp0.."
set "SHORTCUT_DIR=%USERPROFILE%\launchers"
set "SHORTCUT=%SHORTCUT_DIR%\TKA Platform.lnk"
set "BAT_FILE=%~f0"
set "ICON=%REPO_ROOT%\scripts\launchers\icons\tka-platform.ico"
set "AGENT_TERMINAL=%LOCALAPPDATA%\AgentHub\bin\AgentTerminalLauncher.exe"

if not defined TKA_AGENT_TERMINAL if exist "%AGENT_TERMINAL%" (
    "%AGENT_TERMINAL%" -Agent claude -Project "%REPO_ROOT%" -Bat "%BAT_FILE%"
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
