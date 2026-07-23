<#
    install-claude-context-menu.ps1

    Registers (or repairs) the "Open with Claude Code" right-click menu entry
    for folders and folder backgrounds in Windows Explorer.

    Why this exists: Claude Code may be installed through the native installer
    or npm, and neither layout guarantees that claude.exe itself is on PATH.
    This script resolves the real executable, writes the command with its full
    path (PATH-independent), and attaches Claude's embedded icon to the menu.

    Re-run this any time a Claude Code update relocates the binary and the menu
    entry stops working.

    Usage:  powershell -ExecutionPolicy Bypass -File launchers\install-claude-context-menu.ps1
    Remove: add  -Uninstall  to delete the menu entries.
#>

[CmdletBinding()]
param(
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$MenuLabel   = 'Open with Claude Code'
$KeyName     = 'ClaudeCode'
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
    Write-Host "`nClaude Code context-menu entries removed."
    return
}

# --- Resolve the real claude.exe -------------------------------------------
function Resolve-ClaudeExe {
    # 1) On PATH already?
    $onPath = (Get-Command claude.exe -ErrorAction SilentlyContinue).Source
    if ($onPath -and (Test-Path $onPath)) { return (Resolve-Path $onPath).Path }

    # 2) npm package native binary. The PATH shim is usually claude.cmd/ps1,
    # but the packaged executable provides the icon and launches directly.
    $npmNative = Join-Path $env:APPDATA 'npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe'
    if (Test-Path $npmNative) { return (Resolve-Path $npmNative).Path }

    # 3) Native installer default location.
    $native = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
    if (Test-Path $native) { return (Resolve-Path $native).Path }

    # 4) Versioned install dir fallback (newest wins).
    $versionsDir = Join-Path $env:USERPROFILE '.local\share\claude\versions'
    if (Test-Path $versionsDir) {
        $candidate = Get-ChildItem $versionsDir -Filter 'claude.exe' -Recurse -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }

    throw "Could not find claude.exe. Install Claude Code (irm https://claude.ai/install.ps1 | iex) then re-run this script."
}

$claudeExe = Resolve-ClaudeExe
Write-Host "Using claude.exe: $claudeExe"

# Claude's built-in bare /rename already asks the model for a title. Tighten
# that prompt to the same two/three-word contract used by the Codex build.
$renameInstaller = Join-Path $PSScriptRoot 'install-claude-tka.ps1'
if (Test-Path -LiteralPath $renameInstaller -PathType Leaf) {
    & $renameInstaller -ClaudeExe $claudeExe
}

# claude.exe carries the branded Claude icon at index 0; Windows pulls the
# correctly-sized variant (16/32px) from its icon group for the menu.
$iconRef = "$claudeExe,0"

# Agent Hub owns cross-CLI color leasing when installed. The direct Windows
# Terminal fallback keeps this context menu usable on machines without it.
$agentTerminal = Join-Path $env:LOCALAPPDATA 'AgentHub\bin\AgentTerminalLauncher.exe'
if (Test-Path -LiteralPath $agentTerminal) {
    $dirCommand = "`"$agentTerminal`" -Agent claude -Project `"%1`" -Executable `"$claudeExe`""
    $bgCommand  = "`"$agentTerminal`" -Agent claude -Project `"%V`" -Executable `"$claudeExe`""
} else {
    $dirCommand = "wt.exe -d `"%1`" cmd /k `"$claudeExe`" --dangerously-skip-permissions"
    $bgCommand  = "wt.exe -d `"%V`" cmd /k `"$claudeExe`" --dangerously-skip-permissions"
}

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
