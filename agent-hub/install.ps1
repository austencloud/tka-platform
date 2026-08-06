#Requires -Version 5
<#
.SYNOPSIS
  Installs agent-hub: a taskbar popover that starts Claude, Codex, or a
  configured development server and provides guarded Git Pull and Push actions.

.DESCRIPTION
  Compiles the resident host, stub, terminal launcher, and session host with the .NET Framework
  compiler that ships with Windows (no SDK needed), installs them to
  %LOCALAPPDATA%\AgentHub, creates one shortcut per project, and registers the
  host to start at logon.

  Re-running is safe: it rebuilds, refreshes shortcuts, and never overwrites a
  project's existing launchers\start-*.bat.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install.ps1

.EXAMPLE
  # Projects live somewhere other than this repo's parent folder
  powershell -ExecutionPolicy Bypass -File .\install.ps1 -ProjectsRoot C:\code
#>
[CmdletBinding()]
param(
    # Folder that contains your project checkouts. Defaults to this repo's parent.
    [string]$ProjectsRoot,
    # Only install the projects listed in projects.json.
    [switch]$NoAutoDiscover,
    # Skip creating launchers\start-claude.bat / start-codex.bat in projects that lack them.
    [switch]$NoLaunchers,
    # Do not register the host to run at logon.
    [switch]$NoStartup,
    # Do not open the shortcut folder when finished.
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

$Here        = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Split-Path -Parent $Here

function Measure-Repos([string]$dir) {
    if (-not $dir -or -not (Test-Path $dir)) { return 0 }
    return @(Get-ChildItem $dir -Directory -ErrorAction SilentlyContinue |
             Where-Object { Test-Path (Join-Path $_.FullName '.git') }).Count
}

if (-not $ProjectsRoot) {
    # Normal case: checkouts sit beside this repo. Bootstrapped installs run from
    # %LOCALAPPDATA% and have no repo parent, so fall back to common layouts and
    # pick whichever holds the most git repos - a folder with one stray clone
    # should not beat the drive where everything actually lives.
    $sibling = Split-Path -Parent $RepoRoot
    $best = $null; $bestCount = 0
    foreach ($cand in @($sibling, "$env:USERPROFILE\code", "$env:USERPROFILE\source\repos",
                        "$env:USERPROFILE\projects", "$env:USERPROFILE\dev",
                        'C:\code', 'D:\code', 'E:\')) {
        $n = Measure-Repos $cand
        if ($n -gt $bestCount) { $best = $cand; $bestCount = $n }
    }
    $ProjectsRoot = if ($best) { $best } else { $sibling }
}

$InstallDir  = Join-Path $env:LOCALAPPDATA 'AgentHub'
$BinDir      = Join-Path $InstallDir 'bin'
$IconDir     = Join-Path $InstallDir 'icons'
$ShortcutDir = Join-Path $env:USERPROFILE 'AgentHub'
$StartMenu   = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Agent Hub'
$TaskbarPinnedDir = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
$StartupDir  = [Environment]::GetFolderPath('Startup')
$TerminalFragmentDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows Terminal\Fragments\AgentHub'
$TerminalFragmentPath = Join-Path $TerminalFragmentDir 'session-backgrounds.json'
$ManagedSkillNames = @('color', 'colorall', 'renameall')
$ClaudeOnlySkillNames = @('rename', 'rn')
$ManagedSkillMarker = '.agent-hub-managed'
$SharedSkillRoots = @(
    (Join-Path $env:USERPROFILE '.claude\skills'),
    (Join-Path $env:USERPROFILE '.agents\skills')
)
$ClaudeSkillRoot = Join-Path $env:USERPROFILE '.claude\skills'
$TerminalSettingsPaths = @(
    (Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json'),
    (Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows Terminal\settings.json')
)

# OKLCH-derived colors use two perceptual-lightness rings. The first eight
# leases take maximally separated hues; the second eight fill the gaps at a
# lighter level. The ANSI black slot follows the background so explicit black
# cells in terminal UIs do not punch holes through the tint.
$SessionBackgrounds = @(
    '#002A2C', '#440C12', '#251A49', '#262600',
    '#002641', '#371D00', '#3B1034', '#002D15',
    '#003645', '#521E06', '#3F214F', '#1F3901',
    '#1D2D5B', '#3E2E00', '#501A30', '#003A30'
)
$SessionForeground = '#CCCCCC'
$SessionSecondaryForeground = '#9A9A9A'

function Convert-HexChannelToLinear([string]$hex, [int]$offset) {
    $channel = [Convert]::ToInt32($hex.Substring($offset, 2), 16) / 255.0
    if ($channel -le 0.04045) { return $channel / 12.92 }
    return [Math]::Pow(($channel + 0.055) / 1.055, 2.4)
}

function Get-RelativeLuminance([string]$hex) {
    $r = Convert-HexChannelToLinear $hex 1
    $g = Convert-HexChannelToLinear $hex 3
    $b = Convert-HexChannelToLinear $hex 5
    return (0.2126 * $r) + (0.7152 * $g) + (0.0722 * $b)
}

function Get-ContrastRatio([string]$first, [string]$second) {
    $firstLuminance = Get-RelativeLuminance $first
    $secondLuminance = Get-RelativeLuminance $second
    $lighter = [Math]::Max($firstLuminance, $secondLuminance)
    $darker = [Math]::Min($firstLuminance, $secondLuminance)
    return ($lighter + 0.05) / ($darker + 0.05)
}

function Convert-HexToOklab([string]$hex) {
    $r = Convert-HexChannelToLinear $hex 1
    $g = Convert-HexChannelToLinear $hex 3
    $b = Convert-HexChannelToLinear $hex 5

    $l = [Math]::Pow((0.4122214708 * $r) + (0.5363325363 * $g) + (0.0514459929 * $b), 1.0 / 3.0)
    $m = [Math]::Pow((0.2119034982 * $r) + (0.6806995451 * $g) + (0.1073969566 * $b), 1.0 / 3.0)
    $s = [Math]::Pow((0.0883024619 * $r) + (0.2817188376 * $g) + (0.6299787005 * $b), 1.0 / 3.0)

    $lightness = (0.2104542553 * $l) + (0.7936177850 * $m) - (0.0040720468 * $s)
    $a = (1.9779984951 * $l) - (2.4285922050 * $m) + (0.4505937099 * $s)
    $labB = (0.0259040371 * $l) + (0.7827717662 * $m) - (0.8086757660 * $s)
    return @($lightness, $a, $labB)
}

function Get-OklabDistance([string]$first, [string]$second) {
    $firstLab = @(Convert-HexToOklab $first)
    $secondLab = @(Convert-HexToOklab $second)
    return [Math]::Sqrt(
        [Math]::Pow($firstLab[0] - $secondLab[0], 2) +
        [Math]::Pow($firstLab[1] - $secondLab[1], 2) +
        [Math]::Pow($firstLab[2] - $secondLab[2], 2)
    )
}

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor DarkGray }
function Write-Warn2($m)  { Write-Host "    ! $m" -ForegroundColor Yellow }

function Install-AgentHubSkill(
    [string]$source,
    [string]$destination,
    [string]$skillName
) {
    $markerPath = Join-Path $destination $ManagedSkillMarker
    if ((Test-Path -LiteralPath $destination) -and
        -not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        Write-Warn2 "kept existing unmanaged $skillName skill at $destination"
        return $false
    }

    New-Item -ItemType Directory -Force $destination | Out-Null
    foreach ($entry in Get-ChildItem -LiteralPath $source -Force) {
        Copy-Item -LiteralPath $entry.FullName -Destination $destination -Recurse -Force
    }
    [IO.File]::WriteAllText(
        $markerPath,
        "Managed by @austencloud/agent-hub.`r`n",
        [Text.UTF8Encoding]::new($false)
    )
    return $true
}

Write-Host ""
Write-Host "  Agent Hub installer" -ForegroundColor White
Write-Host "  repo         $RepoRoot"
Write-Host "  projects in  $ProjectsRoot"
Write-Host "  install to   $InstallDir"
Write-Host ""

# ------------------------------------------------------ terminal color schemes
Write-Step "Installing per-session terminal backgrounds"
$schemes = @(
    for ($i = 0; $i -lt $SessionBackgrounds.Count; $i++) {
        $background = $SessionBackgrounds[$i]
        [ordered]@{
            name = 'Agent Hub Session {0:D2}' -f ($i + 1)
            background = $background
            foreground = $SessionForeground
            cursorColor = '#FFFFFF'
            selectionBackground = '#264F78'
            black = $background
            red = '#C50F1F'
            green = '#13A10E'
            yellow = '#C19C00'
            blue = '#0037DA'
            purple = '#881798'
            cyan = '#3A96DD'
            white = '#CCCCCC'
            brightBlack = $SessionSecondaryForeground
            brightRed = '#E74856'
            brightGreen = '#16C60C'
            brightYellow = '#F9F1A5'
            brightBlue = '#3B78FF'
            brightPurple = '#B4009E'
            brightCyan = '#61D6D6'
            brightWhite = '#F2F2F2'
        }
    }
)
$terminalFragment = [ordered]@{ schemes = $schemes }
$terminalFragmentJson = $terminalFragment | ConvertTo-Json -Depth 4
New-Item -ItemType Directory -Force $TerminalFragmentDir | Out-Null
$terminalFragmentChanged = (
    -not (Test-Path -LiteralPath $TerminalFragmentPath -PathType Leaf) -or
    -not [string]::Equals(
        (Get-Content -Raw -LiteralPath $TerminalFragmentPath),
        $terminalFragmentJson,
        [StringComparison]::Ordinal
    )
)
if ($terminalFragmentChanged) {
    [IO.File]::WriteAllText(
        $TerminalFragmentPath,
        $terminalFragmentJson,
        [Text.UTF8Encoding]::new($false)
    )
}

$installedFragment = Get-Content -Raw -LiteralPath $TerminalFragmentPath | ConvertFrom-Json
$installedSchemes = @($installedFragment.schemes)
$fragmentIsValid = $installedSchemes.Count -eq $SessionBackgrounds.Count
$minimumForegroundContrast = [double]::MaxValue
$minimumSecondaryContrast = [double]::MaxValue
$minimumPaletteDistance = [double]::MaxValue
for ($i = 0; $fragmentIsValid -and $i -lt $SessionBackgrounds.Count; $i++) {
    $minimumForegroundContrast = [Math]::Min(
        $minimumForegroundContrast,
        (Get-ContrastRatio $SessionBackgrounds[$i] $SessionForeground)
    )
    $minimumSecondaryContrast = [Math]::Min(
        $minimumSecondaryContrast,
        (Get-ContrastRatio $SessionBackgrounds[$i] $SessionSecondaryForeground)
    )
    $fragmentIsValid = (
        $installedSchemes[$i].name -eq ('Agent Hub Session {0:D2}' -f ($i + 1)) -and
        $installedSchemes[$i].background -eq $SessionBackgrounds[$i] -and
        $installedSchemes[$i].black -eq $SessionBackgrounds[$i] -and
        $installedSchemes[$i].foreground -eq $SessionForeground -and
        $installedSchemes[$i].brightBlack -eq $SessionSecondaryForeground
    )
}
for ($i = 0; $i -lt $SessionBackgrounds.Count; $i++) {
    for ($j = $i + 1; $j -lt $SessionBackgrounds.Count; $j++) {
        $minimumPaletteDistance = [Math]::Min(
            $minimumPaletteDistance,
            (Get-OklabDistance $SessionBackgrounds[$i] $SessionBackgrounds[$j])
        )
    }
}
if (-not $fragmentIsValid) {
    throw "Windows Terminal session background fragment failed validation: $TerminalFragmentPath"
}
if (
    $minimumForegroundContrast -lt 7.0 -or
    $minimumSecondaryContrast -lt 4.5 -or
    $minimumPaletteDistance -lt 0.04
) {
    throw "Windows Terminal session backgrounds failed contrast or separation validation."
}
$sessionBackgroundAction = if ($terminalFragmentChanged) { "installed" } else { "verified" }
Write-Ok (
    "{0} {1} session backgrounds (contrast {2:N2}:1; secondary {3:N2}:1; separation {4:N3})" -f
    $sessionBackgroundAction,
    $SessionBackgrounds.Count,
    $minimumForegroundContrast,
    $minimumSecondaryContrast,
    $minimumPaletteDistance
)

# Terminal watches its own settings directory, not the external fragment
# directory. Nudge it only when the fragment actually changed. Reloading
# settings updates every open window and can discard per-tab command-line
# appearance overrides, so an idempotent installer must leave healthy sessions
# alone.
$reloadedTerminalSettings = 0
if ($terminalFragmentChanged) {
    foreach ($settingsPath in $TerminalSettingsPaths | Select-Object -Unique) {
        if (-not (Test-Path -LiteralPath $settingsPath -PathType Leaf)) { continue }
        [IO.File]::SetLastWriteTimeUtc($settingsPath, [DateTime]::UtcNow)
        $reloadedTerminalSettings++
    }
}
if ($reloadedTerminalSettings -gt 0) {
    Write-Ok "signaled $reloadedTerminalSettings Windows Terminal settings installation(s) to reload"
} elseif (-not $terminalFragmentChanged) {
    Write-Ok "session backgrounds already current; left open Terminal windows untouched"
} else {
    Write-Warn2 "Windows Terminal has not created settings.json yet; backgrounds will load on its next start"
}

# Keep bare /rename consistent before Agent Hub launches Claude through any
# project-specific start script. The installer is guarded and idempotent.
$claudeRenameInstaller = Join-Path $RepoRoot 'launchers\install-claude-tka.ps1'
if (Test-Path -LiteralPath $claudeRenameInstaller -PathType Leaf) {
    Write-Step "Configuring Claude's two/three-word bare /rename"
    & $claudeRenameInstaller -Quiet
    Write-Ok "Claude bare /rename configured"
}

# ---------------------------------------------------------------- 1. compiler
Write-Step "Locating the .NET Framework compiler"
$fw  = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
if (-not (Test-Path $fw)) { $fw = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319' }
$csc = Join-Path $fw 'csc.exe'
if (-not (Test-Path $csc)) {
    throw "csc.exe not found under $env:WINDIR\Microsoft.NET. Enable the .NET Framework 4.x feature and re-run."
}
Write-Ok $csc

# ------------------------------------------------------------------- 2. build
Write-Step "Building Agent Hub executables"
New-Item -ItemType Directory -Force $BinDir, $IconDir | Out-Null

# Stop resident processes so their executables can be replaced.
Get-Process AgentChooserHost, AgentTerminalColorWatchdog -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Ok "stopping running $($_.ProcessName) (pid $($_.Id))"
    $_ | Stop-Process -Force
}
Start-Sleep -Milliseconds 400

$wpf = Join-Path $fw 'WPF'
$hostRefs = @(
    (Join-Path $wpf 'PresentationFramework.dll'),
    (Join-Path $wpf 'PresentationCore.dll'),
    (Join-Path $wpf 'WindowsBase.dll'),
    (Join-Path $fw  'System.Xaml.dll'),
    'System.dll', 'System.Core.dll', 'System.Xml.dll'
)
$hostArgs = @('/nologo', '/target:winexe', "/out:$BinDir\AgentChooserHost.exe")
$hostArgs += $hostRefs | ForEach-Object { "/reference:$_" }
$hostArgs += (Join-Path $Here 'src\AgentChooserHost.cs')
$hostArgs += (Join-Path $Here 'src\HiddenProcessRunner.cs')
$hostArgs += (Join-Path $Here 'src\Pm2DevServerController.cs')
$hostArgs += (Join-Path $Here 'src\GitProjectController.cs')
$hostArgs += (Join-Path $Here 'src\GitActionPanel.cs')

& $csc @hostArgs
if ($LASTEXITCODE -ne 0) { throw "Host build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentChooserHost.exe"

$serverSelfTest = Start-Process -FilePath (Join-Path $BinDir 'AgentChooserHost.exe') `
    -ArgumentList '-SelfTestServer' -Wait -PassThru -WindowStyle Hidden
if ($serverSelfTest.ExitCode -ne 0) { throw "Server control self-test failed ($($serverSelfTest.ExitCode) assertion(s))" }
Write-Ok "server control self-test passed"

$gitSelfTest = Start-Process -FilePath (Join-Path $BinDir 'AgentChooserHost.exe') `
    -ArgumentList '-SelfTestGit' -Wait -PassThru -WindowStyle Hidden
if ($gitSelfTest.ExitCode -ne 0) { throw "Git control self-test failed ($($gitSelfTest.ExitCode) assertion(s))" }
Write-Ok "Git control self-test passed"

$stubArgs = @('/nologo', '/target:winexe', "/out:$BinDir\AgentChooserStub.exe",
              '/reference:System.dll', '/reference:System.Core.dll',
              (Join-Path $Here 'src\AgentChooserStub.cs'))
& $csc @stubArgs
if ($LASTEXITCODE -ne 0) { throw "Stub build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentChooserStub.exe"

$terminalSource = Join-Path $Here 'src\AgentTerminalLauncher.cs'
$sessionTitleSource = Join-Path $Here 'src\SessionTitleManager.cs'
$terminalRefs = @('System.dll', 'System.Core.dll', 'System.Management.dll')
$terminalLauncherArgs = @('/nologo', '/target:winexe', "/out:$BinDir\AgentTerminalLauncher.exe")
$terminalLauncherArgs += $terminalRefs | ForEach-Object { "/reference:$_" }
$terminalLauncherArgs += $terminalSource
$terminalLauncherArgs += $sessionTitleSource
& $csc @terminalLauncherArgs
if ($LASTEXITCODE -ne 0) { throw "Terminal launcher build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentTerminalLauncher.exe"

$terminalSessionArgs = @('/nologo', '/target:exe', "/out:$BinDir\AgentTerminalSession.exe")
$terminalSessionArgs += $terminalRefs | ForEach-Object { "/reference:$_" }
$terminalSessionArgs += $terminalSource
$terminalSessionArgs += $sessionTitleSource
& $csc @terminalSessionArgs
if ($LASTEXITCODE -ne 0) { throw "Terminal session host build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentTerminalSession.exe"

$terminalWatchdogArgs = @('/nologo', '/target:winexe', "/out:$BinDir\AgentTerminalColorWatchdog.exe")
$terminalWatchdogArgs += $terminalRefs | ForEach-Object { "/reference:$_" }
$terminalWatchdogArgs += $terminalSource
$terminalWatchdogArgs += $sessionTitleSource
& $csc @terminalWatchdogArgs
if ($LASTEXITCODE -ne 0) { throw "Terminal color watchdog build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentTerminalColorWatchdog.exe"

& (Join-Path $BinDir 'AgentTerminalSession.exe') -SelfTest
if ($LASTEXITCODE -ne 0) { throw "Terminal launcher self-test failed (exit $LASTEXITCODE)" }
Write-Ok "terminal color leasing self-test passed"

Copy-Item (Join-Path $Here 'icons\*') $IconDir -Force
Write-Ok "copied $((Get-ChildItem $IconDir).Count) icons"

Write-Step "Installing the personal Agent Hub skills"
$installedSkills = 0
foreach ($skillName in $ManagedSkillNames) {
    $skillSource = Join-Path $Here "skills\$skillName"
    if (-not (Test-Path -LiteralPath (Join-Path $skillSource 'SKILL.md') -PathType Leaf)) {
        throw "Agent Hub skill source is missing: $skillSource"
    }
    foreach ($skillRoot in $SharedSkillRoots) {
        $destination = Join-Path $skillRoot $skillName
        if (Install-AgentHubSkill $skillSource $destination $skillName) {
            $installedSkills++
            Write-Ok $destination
        }
    }
}
foreach ($skillName in $ClaudeOnlySkillNames) {
    $skillSource = Join-Path $Here "skills\$skillName"
    if (-not (Test-Path -LiteralPath (Join-Path $skillSource 'SKILL.md') -PathType Leaf)) {
        throw "Agent Hub skill source is missing: $skillSource"
    }
    $destination = Join-Path $ClaudeSkillRoot $skillName
    if (Install-AgentHubSkill $skillSource $destination $skillName) {
        $installedSkills++
        Write-Ok $destination
    }
}
if ($installedSkills -eq 0) {
    Write-Warn2 "no personal Agent Hub skills were installed because every destination is user-owned"
}

# ---------------------------------------------------------------- 3. projects
Write-Step "Resolving projects"
$cfgPath  = Join-Path $Here 'projects.json'
$wanted   = @()
if (Test-Path $cfgPath) {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    $wanted = @($cfg.projects)
}

function Resolve-ProjectPath([string]$p) {
    if ([IO.Path]::IsPathRooted($p)) { return $p }
    return (Join-Path $ProjectsRoot $p)
}

$resolved = New-Object System.Collections.ArrayList
$seen     = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)

foreach ($p in $wanted) {
    $full = Resolve-ProjectPath $p.path
    if (-not (Test-Path $full)) { continue }
    if (-not $seen.Add($full))  { continue }
    $serverManager = $null; $serverApp = $null; $serverConfig = $null; $serverPort = $null
    $appUrl = $null
    if ($p.PSObject.Properties['appUrl'] -and $p.appUrl) {
        $appUrl = [string]$p.appUrl
        if ($appUrl -notmatch '^https?://') { throw "Invalid app URL '$appUrl' for $($p.name); it must start with http:// or https://." }
    }
    if ($null -ne $p.server) {
        $serverManager = [string]$p.server.manager
        $serverApp = [string]$p.server.app
        $serverConfigRelative = [string]$p.server.config
        $serverPort = [int]$p.server.port
        if ($serverManager -ne 'pm2') { throw "Unsupported server manager '$serverManager' for $($p.name)." }
        if ($serverApp -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$') { throw "Invalid PM2 app name '$serverApp' for $($p.name)." }
        if ([IO.Path]::IsPathRooted($serverConfigRelative)) { throw "Server config for $($p.name) must be relative to its project." }
        if ($serverPort -lt 1 -or $serverPort -gt 65535) { throw "Invalid server port '$serverPort' for $($p.name)." }

        $trimChars = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $projectRoot = [IO.Path]::GetFullPath($full).TrimEnd($trimChars)
        $serverConfig = [IO.Path]::GetFullPath((Join-Path $projectRoot $serverConfigRelative))
        $projectPrefix = $projectRoot + [IO.Path]::DirectorySeparatorChar
        if (-not $serverConfig.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Server config for $($p.name) must stay inside its project."
        }
        if (-not (Test-Path -LiteralPath $serverConfig -PathType Leaf)) { throw "Server config not found: $serverConfig" }
    }
    [void]$resolved.Add([pscustomobject]@{
        Name = $p.name; Path = $full; Icon = $p.icon
        ServerManager = $serverManager; ServerApp = $serverApp
        ServerConfig = $serverConfig; ServerPort = $serverPort
        AppUrl = $appUrl
    })
}

if (-not $NoAutoDiscover -and (Test-Path $ProjectsRoot)) {
    foreach ($d in Get-ChildItem $ProjectsRoot -Directory -ErrorAction SilentlyContinue) {
        if ($d.Name.StartsWith('.') -or $d.Name.StartsWith('_') -or $d.Name.StartsWith('$')) { continue }
        if (-not (Test-Path (Join-Path $d.FullName '.git'))) { continue }
        if (-not $seen.Add($d.FullName)) { continue }
        # Title Case the folder name: "flow-arts-wiki" -> "Flow Arts Wiki"
        $nice = ($d.Name -split '[-_]' | ForEach-Object {
            if ($_.Length -gt 0) { $_.Substring(0,1).ToUpper() + $_.Substring(1) } else { $_ }
        }) -join ' '
        [void]$resolved.Add([pscustomobject]@{
            Name = $nice; Path = $d.FullName; Icon = "$($d.Name).ico"
            ServerManager = $null; ServerApp = $null; ServerConfig = $null; ServerPort = $null
            AppUrl = $null
        })
    }
}

if ($resolved.Count -eq 0) {
    throw "No projects found under $ProjectsRoot. Pass -ProjectsRoot <folder> pointing at your checkouts."
}
Write-Ok "$($resolved.Count) project(s)"

# ------------------------------------------------- 4. per-project launcher bats
if (-not $NoLaunchers) {
    Write-Step "Ensuring each project has launchers\start-claude.bat and start-codex.bat"
    foreach ($proj in $resolved) {
        $ldir = Join-Path $proj.Path 'launchers'
        foreach ($agent in @('claude', 'codex')) {
            $dest = Join-Path $ldir "start-$agent.bat"
            if (Test-Path $dest) { continue }
            New-Item -ItemType Directory -Force $ldir | Out-Null
            Copy-Item (Join-Path $Here "templates\start-$agent.bat") $dest
            Write-Ok "created $dest"
        }
    }
}

# --------------------------------------------------------------- 5. shortcuts
Write-Step "Creating shortcuts"
New-Item -ItemType Directory -Force $ShortcutDir, $StartMenu | Out-Null
$shell = New-Object -ComObject WScript.Shell
$stub  = Join-Path $BinDir 'AgentChooserStub.exe'
$made  = 0
$pinsRefreshed = 0

foreach ($proj in $resolved) {
    $icon = if ($proj.Icon) { Join-Path $IconDir $proj.Icon } else { $null }
    $args = '-Project "{0}" -Name "{1}"' -f $proj.Path, $proj.Name
    if ($icon -and (Test-Path $icon)) { $args += ' -Icon "{0}"' -f $icon }
    if ($proj.ServerManager) {
        $args += ' -ServerManager "{0}" -ServerApp "{1}" -ServerConfig "{2}" -ServerPort "{3}"' -f `
            $proj.ServerManager, $proj.ServerApp, $proj.ServerConfig, $proj.ServerPort
    }
    if ($proj.AppUrl) { $args += ' -AppUrl "{0}"' -f $proj.AppUrl }

    foreach ($dir in @($ShortcutDir, $StartMenu)) {
        $lnk = $shell.CreateShortcut((Join-Path $dir "$($proj.Name).lnk"))
        $lnk.TargetPath       = $stub
        $lnk.Arguments        = $args
        $lnk.WorkingDirectory = $proj.Path
        $lnk.Description      = "Choose an agent for $($proj.Name)"
        if ($icon -and (Test-Path $icon)) { $lnk.IconLocation = "$icon,0" }
        $lnk.Save()
    }

    # Windows keeps a private copy of a shortcut when it is pinned. Refresh an
    # existing Agent Hub pin in place so reinstalling can add new metadata such
    # as server controls without asking the user to unpin and pin it again.
    $pinnedPath = Join-Path $TaskbarPinnedDir "$($proj.Name).lnk"
    if (Test-Path -LiteralPath $pinnedPath -PathType Leaf) {
        $pinned = $shell.CreateShortcut($pinnedPath)
        if ([IO.Path]::GetFileName($pinned.TargetPath) -ieq 'AgentChooserStub.exe') {
            $pinned.TargetPath       = $stub
            $pinned.Arguments        = $args
            $pinned.WorkingDirectory = $proj.Path
            $pinned.Description      = "Choose an agent or server for $($proj.Name)"
            if ($icon -and (Test-Path $icon)) { $pinned.IconLocation = "$icon,0" }
            $pinned.Save()
            $pinsRefreshed++
        }
    }
    $made++
    $iconNote = if ($icon -and (Test-Path $icon)) { '' } else { '  [no icon]' }
    Write-Ok "$($proj.Name)$iconNote  ->  $($proj.Path)"
}
Write-Ok "$made shortcut(s) in $ShortcutDir and the Start Menu"
if ($pinsRefreshed -gt 0) { Write-Ok "$pinsRefreshed existing taskbar pin(s) refreshed" }

# -------------------------------------------------------- 6. server resurrection
$serverProjects = @($resolved | Where-Object { $_.ServerManager -eq 'pm2' })
if ($serverProjects.Count -gt 0) {
    $pm2Cmd = Join-Path $env:APPDATA 'npm\pm2.cmd'
    if (Test-Path -LiteralPath $pm2Cmd -PathType Leaf) {
        Write-Step "Registering PM2 to restore managed servers at logon"
        $taskName = 'Agent Hub PM2 resurrect'
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
            -Argument "-NoProfile -WindowStyle Hidden -Command `"& '$pm2Cmd' resurrect`""
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Force | Out-Null
        Write-Ok $taskName
    } else {
        Write-Warn2 "PM2 is not installed; server tiles will explain how to finish setup"
    }
}

# ----------------------------------------------------------------- 7. startup
if (-not $NoStartup) {
    Write-Step "Registering the host to start at logon"
    $lnk = $shell.CreateShortcut((Join-Path $StartupDir 'Agent Hub Host.lnk'))
    $lnk.TargetPath       = Join-Path $BinDir 'AgentChooserHost.exe'
    $lnk.WorkingDirectory = $BinDir
    $lnk.Description      = 'Agent Hub resident popover host'
    $lnk.WindowStyle      = 7   # minimized; the host has no visible window anyway
    $lnk.Save()
    Write-Ok (Join-Path $StartupDir 'Agent Hub Host.lnk')
}

Write-Step "Starting the host"
Start-Process (Join-Path $BinDir 'AgentChooserHost.exe') -WindowStyle Hidden
Start-Sleep -Milliseconds 800
$running = @(Get-Process AgentChooserHost -ErrorAction SilentlyContinue).Count
if ($running -ge 1) { Write-Ok "host running" } else { Write-Warn2 "host did not stay running - see README troubleshooting" }

Write-Host ""
Write-Host "  Done." -ForegroundColor Green
Write-Host "  Drag shortcuts from $ShortcutDir onto your taskbar to pin them."
Write-Host "  Click a pin -> 1 = Claude, 2 = Codex, 3 = server, 4 = open app, 5 = Pull, 6 = Push, Enter = last used, Esc = cancel."
Write-Host ""

if (-not $NoOpen) { Start-Process explorer.exe $ShortcutDir }
