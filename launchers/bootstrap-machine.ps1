<#
    bootstrap-machine.ps1

    One-shot machine bootstrap for the AI-agent scaffolding on a fresh
    Windows laptop. Replicates the primary dev box: Claude Code + Codex CLIs
    launching in bypass-permissions mode, the Explorer right-click context
    menus, the taskbar launcher shortcuts, global Claude/Codex config with
    the custom statusline, the pm2 dev-server stack with its logon resurrect
    task, and the PrintScreen to F13 remap.

    On a brand-new machine, paste these three lines into PowerShell
    (no admin needed; winget ships with Windows 11):

        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
        git clone https://github.com/austencloud/tka-platform.git C:\tka-platform
        powershell -ExecutionPolicy Bypass -File C:\tka-platform\launchers\bootstrap-machine.ps1

    Every step is idempotent: re-running repairs missing pieces without
    replacing existing user config. The Chrome DevTools MCP step adds one
    scoped environment value to an existing server entry when present.
    Two things cannot be scripted and are printed as a checklist at the end:
    interactive logins (claude / codex) and taskbar pinning (Windows 11 has
    no supported API for it; the script opens the shortcut folder instead).

    Switches:
      -DryRun         print what each step would do, change nothing
      -SkipDevServer  skip pnpm install + pm2 + the logon resurrect task
      -SkipPowerToys  skip the PowerToys install + PrintScreen->F13 remap
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipDevServer,
    [switch]$SkipPowerToys
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Assets   = Join-Path $PSScriptRoot 'bootstrap-assets'

function Write-Step($name) {
    Write-Host "`n== $name" -ForegroundColor Cyan
}

function Invoke-Mutation($desc, [scriptblock]$action) {
    if ($DryRun) {
        Write-Host "   [dry-run] $desc" -ForegroundColor DarkGray
    } else {
        Write-Host "   $desc"
        & $action
    }
}

# Copy an asset into place only when the destination does not exist yet.
# A machine's own evolved config always wins over the repo template.
function Copy-IfAbsent($source, $destination) {
    if (Test-Path $destination) {
        Write-Host "   kept existing: $destination" -ForegroundColor DarkGray
        return
    }
    Invoke-Mutation "install $destination" {
        $destDir = Split-Path -Parent $destination
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force $destDir | Out-Null }
        Copy-Item $source $destination
    }
}

$checklist = New-Object System.Collections.Generic.List[string]

# --- 1. Prerequisites --------------------------------------------------------
Write-Step 'Prerequisites (node, Windows Terminal)'

if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "   node present: $(node --version)" -ForegroundColor DarkGray
} else {
    Invoke-Mutation 'install Node.js LTS via winget' {
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                    [Environment]::GetEnvironmentVariable('Path', 'User')
    }
}

if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
    Write-Host '   Windows Terminal present' -ForegroundColor DarkGray
} else {
    Invoke-Mutation 'install Windows Terminal via winget (context menus launch through wt.exe)' {
        winget install --id Microsoft.WindowsTerminal -e --accept-source-agreements --accept-package-agreements
    }
}

# --- 2. Claude Code CLI ------------------------------------------------------
Write-Step 'Claude Code CLI'

$claudeNative = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
if ((Get-Command claude -ErrorAction SilentlyContinue) -or (Test-Path $claudeNative)) {
    Write-Host '   claude present' -ForegroundColor DarkGray
} else {
    Invoke-Mutation 'install Claude Code (irm https://claude.ai/install.ps1 | iex)' {
        Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
    }
    $checklist.Add('Run `claude` once to log in (interactive, cannot be scripted).')
}

# --- 3. Codex CLI ------------------------------------------------------------
Write-Step 'Codex CLI'

$codexCmd = Join-Path $env:APPDATA 'npm\codex.cmd'
if ((Get-Command codex -ErrorAction SilentlyContinue) -or (Test-Path $codexCmd)) {
    Write-Host '   codex present' -ForegroundColor DarkGray
} else {
    Invoke-Mutation 'npm install -g @openai/codex' {
        npm install -g @openai/codex
    }
    $checklist.Add('Run `codex login` once (interactive, cannot be scripted).')
}

# --- 4. Global agent config --------------------------------------------------
Write-Step 'Global Claude config (~\.claude)'
Copy-IfAbsent (Join-Path $Assets 'claude-settings.json') (Join-Path $env:USERPROFILE '.claude\settings.json')
Copy-IfAbsent (Join-Path $Assets 'statusline.mjs')       (Join-Path $env:USERPROFILE '.claude\statusline.mjs')

Write-Step 'Global Codex config (~\.codex)'
Copy-IfAbsent (Join-Path $Assets 'codex-config.toml')    (Join-Path $env:USERPROFILE '.codex\config.toml')

Write-Step 'Chrome DevTools MCP terminal title guard'
$titleGuardInstaller = Join-Path $PSScriptRoot 'install-terminal-title-guard.mjs'
Invoke-Mutation 'protect intentional terminal names from Chrome DevTools MCP' {
    & node $titleGuardInstaller
    if ($LASTEXITCODE -ne 0) { throw "Terminal title guard installer failed (exit $LASTEXITCODE)" }
}

# --- 5. Explorer context menus ----------------------------------------------
Write-Step 'Right-click context menus (HKCU, no admin)'

foreach ($installer in @('install-claude-context-menu.ps1', 'install-codex-context-menu.ps1')) {
    $path = Join-Path $PSScriptRoot $installer
    if ($DryRun) {
        Write-Host "   [dry-run] run $installer" -ForegroundColor DarkGray
        continue
    }
    try {
        & $path
    } catch {
        Write-Warning "$installer failed: $_"
        $checklist.Add("Re-run launchers\$installer after fixing the above (usually: the CLI it points at is not installed yet).")
    }
}

# --- 6. Launcher shortcuts ---------------------------------------------------
# Same shortcut the start-*.bat files self-install on first run. Created here
# directly (via WScript.Shell, like the bats do) because running the bats
# would immediately launch an interactive agent session.
Write-Step 'Launcher shortcuts (%USERPROFILE%\launchers)'

$shortcutDir = Join-Path $env:USERPROFILE 'launchers'

function New-LauncherShortcut($name, $bat, $workDir, $icon, $description) {
    $lnk = Join-Path $shortcutDir "$name.lnk"
    if (Test-Path $lnk) {
        Write-Host "   kept existing: $lnk" -ForegroundColor DarkGray
        return
    }
    if (-not (Test-Path $bat)) {
        Write-Host "   skipped ($bat not found)" -ForegroundColor DarkGray
        return
    }
    Invoke-Mutation "create $lnk" {
        if (-not (Test-Path $shortcutDir)) { New-Item -ItemType Directory -Force $shortcutDir | Out-Null }
        $shell = New-Object -ComObject WScript.Shell
        $s = $shell.CreateShortcut($lnk)
        $s.TargetPath = 'C:\Windows\System32\cmd.exe'
        $s.Arguments = "/c `"$bat`""
        $s.WorkingDirectory = $workDir
        if (Test-Path $icon) { $s.IconLocation = "$icon,0" }
        $s.Description = $description
        $s.Save()
    }
}

New-LauncherShortcut 'TKA Platform' `
    (Join-Path $RepoRoot 'launchers\start-claude.bat') `
    $RepoRoot `
    (Join-Path $RepoRoot 'scripts\launchers\icons\tka-platform.ico') `
    'Launch Claude Code in TKA Platform'

New-LauncherShortcut 'Codex - TKA Platform' `
    (Join-Path $RepoRoot 'launchers\start-codex.bat') `
    $RepoRoot `
    (Join-Path $RepoRoot 'scripts\launchers\icons\tka-platform.ico') `
    'Launch Codex in TKA Platform'

New-LauncherShortcut 'Cirque Aflame' `
    'C:\cirque-aflame\launchers\start-claude.bat' `
    'C:\cirque-aflame' `
    'C:\cirque-aflame\launchers\icons\cirque-aflame.ico' `
    'Launch Claude Code in Cirque Aflame'

$checklist.Add("Pin the shortcuts: right-click each .lnk in $shortcutDir and choose Pin to taskbar (Windows offers no scriptable pin API).")

# --- 7. Dev server stack -----------------------------------------------------
if ($SkipDevServer) {
    Write-Step 'Dev server stack (skipped by -SkipDevServer)'
} else {
    Write-Step 'Dev server stack (pnpm install, pm2, logon resurrect task)'

    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        Write-Host '   pm2 present' -ForegroundColor DarkGray
    } else {
        Invoke-Mutation 'npm install -g pm2' { npm install -g pm2 }
    }

    Invoke-Mutation 'corepack enable (activates the repo-pinned pnpm)' {
        corepack enable
    }

    Invoke-Mutation "pnpm install in $RepoRoot (first run takes a while)" {
        Push-Location $RepoRoot
        try { pnpm install } finally { Pop-Location }
    }

    Invoke-Mutation 'pm2 start ecosystem.config.cjs; pm2 save' {
        Push-Location $RepoRoot
        try {
            pm2 start ecosystem.config.cjs --only tka-dev
            pm2 save
        } finally { Pop-Location }
    }

    $taskName = 'Agent Hub PM2 resurrect'
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Write-Host "   scheduled task present: $taskName" -ForegroundColor DarkGray
    } else {
        Invoke-Mutation "register logon task '$taskName'" {
            $pm2Cmd  = Join-Path $env:APPDATA 'npm\pm2.cmd'
            $action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
                -Argument "-NoProfile -WindowStyle Hidden -Command `"& '$pm2Cmd' resurrect`""
            $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger | Out-Null
        }
    }

    $checklist.Add('Dev HTTPS certs are machine-local: run the /devfix flow (mkcert + scripts/start-dev.ps1) if dev.tkaflowarts.com is needed on this machine.')
}

# --- 8. PowerToys PrintScreen -> F13 remap -----------------------------------
if ($SkipPowerToys) {
    Write-Step 'PowerToys remap (skipped by -SkipPowerToys)'
} else {
    Write-Step 'PowerToys Keyboard Manager (PrintScreen -> F13)'

    $ptExe = @(
        (Join-Path $env:ProgramFiles 'PowerToys\PowerToys.exe'),
        (Join-Path $env:LOCALAPPDATA 'PowerToys\PowerToys.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $ptExe) {
        Invoke-Mutation 'install PowerToys via winget' {
            winget install --id Microsoft.PowerToys -e --accept-source-agreements --accept-package-agreements
        }
    } else {
        Write-Host "   PowerToys present: $ptExe" -ForegroundColor DarkGray
    }

    Copy-IfAbsent (Join-Path $Assets 'powertoys-keyboard-default.json') `
        (Join-Path $env:LOCALAPPDATA 'Microsoft\PowerToys\Keyboard Manager\default.json')
    $checklist.Add('Enable Keyboard Manager inside PowerToys once (the remap file is already in place); bind ShareX capture to F13 if ShareX is wanted here.')
}

# --- Done --------------------------------------------------------------------
Write-Step 'Done'

if (-not $DryRun) {
    Invoke-Mutation "open $shortcutDir for taskbar pinning" {
        if (Test-Path $shortcutDir) { explorer $shortcutDir }
    }
}

if ($checklist.Count -gt 0) {
    Write-Host "`nManual steps remaining:" -ForegroundColor Yellow
    $i = 1
    foreach ($item in $checklist) {
        Write-Host ("  {0}. {1}" -f $i, $item)
        $i++
    }
}

Write-Host "`nRe-run this script any time; it only fills gaps." -ForegroundColor Green
