<#
    install-codex-context-menu.ps1

    Registers (or repairs) the "Open with Codex" right-click menu entry for
    folders and folder backgrounds in Windows Explorer. It also installs the
    TKA Codex status line and terminal title in the user's config.toml. This is the Codex twin
    of install-claude-context-menu.ps1. Both use the same HKCU Classes hive and
    the shared Agent Hub terminal launcher when it is installed.

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
    Status UI: add -StatusLineOnly to configure only the Codex footer and terminal title.
    Remove: add  -Uninstall  to delete the menu entries.
#>

[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$StatusLineOnly
)

$ErrorActionPreference = 'Stop'

$MenuLabel   = 'Open with Codex'
$KeyName     = 'OpenAICodex'
$DirKey      = "HKCU:\Software\Classes\Directory\shell\$KeyName"
$BgKey       = "HKCU:\Software\Classes\Directory\Background\shell\$KeyName"

# Keep the active model visible, then show the two limits Austen actually plans
# sessions around. Token count and branch are useful diagnostics without taking
# the width that current-dir would consume in the dedicated TKA launcher.
$StatusLineItems = @(
    'model-with-reasoning',
    'context-used',
    'five-hour-limit',
    'weekly-limit',
    'git-branch'
)

# The custom TKA build renders the persisted /rename value here and otherwise
# uses "Starting Session". It deliberately emits no project, agent, activity,
# or status suffix and never changes the title automatically.
$TerminalTitleItems = @(
    'thread-title'
)

function Set-TuiArraySetting([string]$Content, [string]$Name, [string[]]$Items) {
    $newline = if ($Content.Contains("`r`n")) { "`r`n" } else { "`n" }
    $lines = [regex]::Split($Content, '\r?\n')
    $settingIndexes = @(
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match ('^[ \t]*(?:tui\.)?' + [regex]::Escape($Name) + '[ \t]*=')) { $i }
        }
    )
    $settingToml = $Name + ' = [' + (($Items | ForEach-Object { '"' + $_ + '"' }) -join ', ') + ']'

    if ($settingIndexes.Count -gt 0) {
        $firstIndex = $settingIndexes[0]
        $prefix = if ($lines[$firstIndex] -match '^[ \t]*tui\.') { 'tui.' } else { '' }
        $lines[$firstIndex] = $prefix + $settingToml

        # Collapse duplicates left by older installers or manual edits.
        $duplicateIndexes = @($settingIndexes | Select-Object -Skip 1)
        return @(
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($i -notin $duplicateIndexes) { $lines[$i] }
            }
        ) -join $newline
    }

    if ($Content -match '(?m)^\s*\[tui\]\s*$') {
        return [regex]::Replace(
            $Content,
            '(?m)^(\s*\[tui\]\s*)$',
            '$1' + $newline + $settingToml,
            1
        )
    }

    # A dotted root key is valid TOML and avoids reopening an implicitly
    # created [tui] table when configs already contain [tui.*] subtables.
    $dottedLine = 'tui.' + $settingToml
    $firstTable = [regex]::Match($Content, '(?m)^\s*\[')
    if ($firstTable.Success) {
        return $Content.Insert($firstTable.Index, $dottedLine + $newline + $newline)
    }
    if ($Content.Length -gt 0 -and -not $Content.EndsWith($newline)) {
        $Content += $newline
    }
    return $Content + $dottedLine + $newline
}

function Set-CodexStatusSurfaces {
    $codexHome = if ($env:CODEX_HOME) {
        $env:CODEX_HOME
    } else {
        Join-Path $env:USERPROFILE '.codex'
    }
    $configPath = Join-Path $codexHome 'config.toml'

    New-Item -ItemType Directory -Path $codexHome -Force | Out-Null
    $content = if (Test-Path -LiteralPath $configPath) {
        [IO.File]::ReadAllText($configPath)
    } else {
        ''
    }
    $content = Set-TuiArraySetting $content 'status_line' $StatusLineItems
    $content = Set-TuiArraySetting $content 'terminal_title' $TerminalTitleItems

    $tempPath = "$configPath.tmp"
    [IO.File]::WriteAllText($tempPath, $content, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tempPath -Destination $configPath -Force

    Write-Host "Configured Codex status surfaces in $configPath"
    Write-Host "  footer: $($StatusLineItems -join ' | ')"
    Write-Host "  title:  $($TerminalTitleItems -join ' | ')"
}

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

Set-CodexStatusSurfaces

if ($StatusLineOnly) {
    Write-Host "`nRestart Codex to load the new footer and terminal title."
    return
}

# --- Resolve the real codex launcher ----------------------------------------
function Resolve-CodexCmd {
    # 1) TKA's side-by-side build, when installed.
    $tkaCodex = Join-Path $env:LOCALAPPDATA 'TKA\codex-tka\bin\codex-tka.exe'
    if (Test-Path $tkaCodex) { return (Resolve-Path $tkaCodex).Path }

    # 2) codex.cmd on PATH (npm global shim)?
    $onPath = (Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
    if ($onPath -and (Test-Path $onPath)) { return (Resolve-Path $onPath).Path }

    # 3) npm global bin default location.
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

# Agent Hub owns cross-CLI color leasing when installed. The direct Windows
# Terminal fallback keeps this context menu usable on machines without it.
$agentTerminal = Join-Path $env:LOCALAPPDATA 'AgentHub\bin\AgentTerminalLauncher.exe'
if (Test-Path -LiteralPath $agentTerminal) {
    $dirCommand = "`"$agentTerminal`" -Agent codex -Project `"%1`" -Executable `"$codexCmd`""
    $bgCommand  = "`"$agentTerminal`" -Agent codex -Project `"%V`" -Executable `"$codexCmd`""
} else {
    $dirCommand = "wt.exe -d `"%1`" cmd /k `"$codexCmd`" --dangerously-bypass-approvals-and-sandbox"
    $bgCommand  = "wt.exe -d `"%V`" cmd /k `"$codexCmd`" --dangerously-bypass-approvals-and-sandbox"
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
