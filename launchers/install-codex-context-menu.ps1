<#
    install-codex-context-menu.ps1

    Registers (or repairs) the "Open with Codex" right-click menu entry for
    folders and folder backgrounds in Windows Explorer. It also installs the
    TKA Codex status line in the user's config.toml. This is the Codex twin
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
    Footer: add -StatusLineOnly to configure only the Codex footer.
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

function Set-CodexStatusLine {
    $codexHome = if ($env:CODEX_HOME) {
        $env:CODEX_HOME
    } else {
        Join-Path $env:USERPROFILE '.codex'
    }
    $configPath = Join-Path $codexHome 'config.toml'
    $statusLineToml = 'status_line = [' + (($StatusLineItems | ForEach-Object { '"' + $_ + '"' }) -join ', ') + ']'

    New-Item -ItemType Directory -Path $codexHome -Force | Out-Null
    $content = if (Test-Path -LiteralPath $configPath) {
        [IO.File]::ReadAllText($configPath)
    } else {
        ''
    }

    $newline = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
    $lines = [regex]::Split($content, '\r?\n')
    $statusLineIndexes = @(
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^[ \t]*(?:tui\.)?status_line[ \t]*=') { $i }
        }
    )

    if ($statusLineIndexes.Count -gt 0) {
        $firstIndex = $statusLineIndexes[0]
        $prefix = if ($lines[$firstIndex] -match '^[ \t]*tui\.') { 'tui.' } else { '' }
        $lines[$firstIndex] = $prefix + $statusLineToml

        # Collapse duplicates left by older installers or manual edits.
        $duplicateIndexes = @($statusLineIndexes | Select-Object -Skip 1)
        $content = @(
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($i -notin $duplicateIndexes) { $lines[$i] }
            }
        ) -join $newline
    } elseif ($content -match '(?m)^\s*\[tui\]\s*$') {
        $content = [regex]::Replace(
            $content,
            '(?m)^(\s*\[tui\]\s*)$',
            '$1' + [Environment]::NewLine + $statusLineToml,
            1
        )
    } else {
        # A dotted root key is valid TOML and avoids reopening an implicitly
        # created [tui] table when configs already contain [tui.*] subtables.
        $dottedLine = 'tui.' + $statusLineToml
        $firstTable = [regex]::Match($content, '(?m)^\s*\[')
        if ($firstTable.Success) {
            $content = $content.Insert(
                $firstTable.Index,
                $dottedLine + [Environment]::NewLine + [Environment]::NewLine
            )
        } else {
            if ($content.Length -gt 0 -and -not $content.EndsWith([Environment]::NewLine)) {
                $content += [Environment]::NewLine
            }
            $content += $dottedLine + [Environment]::NewLine
        }
    }

    $tempPath = "$configPath.tmp"
    [IO.File]::WriteAllText($tempPath, $content, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tempPath -Destination $configPath -Force

    Write-Host "Configured Codex status line in $configPath"
    Write-Host "  $($StatusLineItems -join ' | ')"
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

Set-CodexStatusLine

if ($StatusLineOnly) {
    Write-Host "`nRestart Codex to show the new footer."
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
