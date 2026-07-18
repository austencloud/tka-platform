<#
    install-codex-context-menu.ps1

    Registers (or repairs) the "Open with Codex" right-click menu entry for
    folders and folder backgrounds in Windows Explorer. This is the Codex twin
    of install-claude-context-menu.ps1 — same HKCU Classes hive, same
    wt.exe + cmd /k pattern, so opening Codex on a folder is as convenient as
    opening Claude Code.

    Why full-path resolution: `codex` is installed as an npm global shim at
    %APPDATA%\npm\codex.cmd. That dir is usually on PATH, but the menu command
    is written with the resolved full path so it works even if PATH is off.

    Codex's `--dangerously-bypass-approvals-and-sandbox` is the direct analogue
    of Claude Code's `--dangerously-skip-permissions`: it skips every approval
    prompt and runs without the sandbox. That mirrors the Claude launcher's
    frictionless behavior. Drop the flag below if you want Codex to ask before
    running commands.

    Re-run this any time an npm/Codex update relocates the shim and the menu
    entry stops working.

    Usage:  powershell -ExecutionPolicy Bypass -File launchers\install-codex-context-menu.ps1
    Remove: add  -Uninstall  to delete the menu entries.
#>

[CmdletBinding()]
param(
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$MenuLabel   = 'Open with Codex'
$KeyName     = 'OpenAICodex'
$DirKey      = "HKCU:\Software\Classes\Directory\shell\$KeyName"
$BgKey       = "HKCU:\Software\Classes\Directory\Background\shell\$KeyName"

function Remove-MenuKeys {
    foreach ($k in @($DirKey, $BgKey)) {
        if (Test-Path $k) {
            Remove-Item $k -Recurse -Force
            Write-Host "Removed $k"
        }
    }
}

if ($Uninstall) {
    Remove-MenuKeys
    Write-Host "`nCodex context-menu entries removed."
    return
}

# --- Resolve the real codex launcher ----------------------------------------
function Resolve-CodexCmd {
    # 1) codex.cmd on PATH (npm global shim)?
    $onPath = (Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
    if ($onPath -and (Test-Path $onPath)) { return (Resolve-Path $onPath).Path }

    # 2) npm global bin default location.
    $npmShim = Join-Path $env:APPDATA 'npm\codex.cmd'
    if (Test-Path $npmShim) { return (Resolve-Path $npmShim).Path }

    throw "Could not find codex.cmd. Install Codex (npm install -g @openai/codex) then re-run this script."
}

$codexCmd = Resolve-CodexCmd
Write-Host "Using codex launcher: $codexCmd"

# Codex ships no icon of its own (it's a Node CLI), so borrow node.exe's icon —
# it reads as "a Node tool" and visually distinguishes this entry from Claude's.
$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { $nodeExe = 'C:\Program Files\nodejs\node.exe' }
$iconRef = "$nodeExe,0"

# Windows Terminal opens the shell in the target folder (-d), then cmd /k keeps
# the window alive after Codex exits. %1 = clicked folder, %V = folder background.
$dirCommand = "wt.exe -d `"%1`" cmd /k `"$codexCmd`" --dangerously-bypass-approvals-and-sandbox"
$bgCommand  = "wt.exe -d `"%V`" cmd /k `"$codexCmd`" --dangerously-bypass-approvals-and-sandbox"

# --- Write the keys ---------------------------------------------------------
function Set-MenuKey {
    param($BaseKey, $Command)

    $cmdKey = Join-Path $BaseKey 'command'
    New-Item -Path $cmdKey -Force | Out-Null   # creates BaseKey + command in one shot

    Set-ItemProperty -Path $BaseKey -Name '(default)' -Value $MenuLabel
    Set-ItemProperty -Path $BaseKey -Name 'Icon'      -Value $iconRef
    Set-ItemProperty -Path $cmdKey  -Name '(default)' -Value $Command
}

Set-MenuKey -BaseKey $DirKey -Command $dirCommand
Set-MenuKey -BaseKey $BgKey  -Command $bgCommand

Write-Host "`nInstalled '$MenuLabel' context-menu entry:"
Write-Host "  Folder right-click     -> $dirCommand"
Write-Host "  Folder background      -> $bgCommand"
Write-Host "  Icon                   -> $iconRef"
Write-Host "`nRight-click any folder (or inside one) and pick '$MenuLabel'."
