#Requires -Version 5
<#
.SYNOPSIS
  Installs agent-hub: a taskbar popover that asks "Claude or Codex?" and opens
  the chosen agent in the project you clicked.

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
$StartupDir  = [Environment]::GetFolderPath('Startup')

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor DarkGray }
function Write-Warn2($m)  { Write-Host "    ! $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Agent Hub installer" -ForegroundColor White
Write-Host "  repo         $RepoRoot"
Write-Host "  projects in  $ProjectsRoot"
Write-Host "  install to   $InstallDir"
Write-Host ""

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

# Stop a running host so its exe can be replaced.
Get-Process AgentChooserHost -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Ok "stopping running host (pid $($_.Id))"
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

& $csc @hostArgs
if ($LASTEXITCODE -ne 0) { throw "Host build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentChooserHost.exe"

$stubArgs = @('/nologo', '/target:winexe', "/out:$BinDir\AgentChooserStub.exe",
              '/reference:System.dll', '/reference:System.Core.dll',
              (Join-Path $Here 'src\AgentChooserStub.cs'))
& $csc @stubArgs
if ($LASTEXITCODE -ne 0) { throw "Stub build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentChooserStub.exe"

$terminalSource = Join-Path $Here 'src\AgentTerminalLauncher.cs'
$terminalLauncherArgs = @('/nologo', '/target:winexe', "/out:$BinDir\AgentTerminalLauncher.exe",
                          '/reference:System.dll', '/reference:System.Core.dll', $terminalSource)
& $csc @terminalLauncherArgs
if ($LASTEXITCODE -ne 0) { throw "Terminal launcher build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentTerminalLauncher.exe"

$terminalSessionArgs = @('/nologo', '/target:exe', "/out:$BinDir\AgentTerminalSession.exe",
                         '/reference:System.dll', '/reference:System.Core.dll', $terminalSource)
& $csc @terminalSessionArgs
if ($LASTEXITCODE -ne 0) { throw "Terminal session host build failed (csc exit $LASTEXITCODE)" }
Write-Ok "built AgentTerminalSession.exe"

& (Join-Path $BinDir 'AgentTerminalSession.exe') -SelfTest
if ($LASTEXITCODE -ne 0) { throw "Terminal launcher self-test failed (exit $LASTEXITCODE)" }
Write-Ok "terminal color leasing self-test passed"

Copy-Item (Join-Path $Here 'icons\*') $IconDir -Force
Write-Ok "copied $((Get-ChildItem $IconDir).Count) icons"

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
    [void]$resolved.Add([pscustomobject]@{ Name = $p.name; Path = $full; Icon = $p.icon })
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
        [void]$resolved.Add([pscustomobject]@{ Name = $nice; Path = $d.FullName; Icon = "$($d.Name).ico" })
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

foreach ($proj in $resolved) {
    $icon = if ($proj.Icon) { Join-Path $IconDir $proj.Icon } else { $null }
    $args = '-Project "{0}" -Name "{1}"' -f $proj.Path, $proj.Name
    if ($icon -and (Test-Path $icon)) { $args += ' -Icon "{0}"' -f $icon }

    foreach ($dir in @($ShortcutDir, $StartMenu)) {
        $lnk = $shell.CreateShortcut((Join-Path $dir "$($proj.Name).lnk"))
        $lnk.TargetPath       = $stub
        $lnk.Arguments        = $args
        $lnk.WorkingDirectory = $proj.Path
        $lnk.Description      = "Choose an agent for $($proj.Name)"
        if ($icon -and (Test-Path $icon)) { $lnk.IconLocation = "$icon,0" }
        $lnk.Save()
    }
    $made++
    $iconNote = if ($icon -and (Test-Path $icon)) { '' } else { '  [no icon]' }
    Write-Ok "$($proj.Name)$iconNote  ->  $($proj.Path)"
}
Write-Ok "$made shortcut(s) in $ShortcutDir and the Start Menu"

# ----------------------------------------------------------------- 6. startup
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
Write-Host "  Click a pin -> popover appears -> 1 = Claude, 2 = Codex, Enter = last used, Esc = cancel."
Write-Host ""

if (-not $NoOpen) { Start-Process explorer.exe $ShortcutDir }
