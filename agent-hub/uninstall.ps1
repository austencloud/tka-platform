#Requires -Version 5
<#
.SYNOPSIS
  Removes agent-hub: stops the host, deletes the install folder, shortcuts, and
  the Windows Terminal color fragment, managed Agent Hub skills, and the logon
  entry.

.DESCRIPTION
  Project launchers (each repo's launchers\start-*.bat) are left alone - they are
  part of your repos, not part of this install.
#>
[CmdletBinding()]
param(
    # Also delete %LOCALAPPDATA%\AgentHub\last.ini (remembered per-project agent).
    [switch]$Purge
)

$ErrorActionPreference = 'Stop'

$InstallDir  = Join-Path $env:LOCALAPPDATA 'AgentHub'
$ShortcutDir = Join-Path $env:USERPROFILE 'AgentHub'
$StartMenu   = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Agent Hub'
$StartupLnk  = Join-Path ([Environment]::GetFolderPath('Startup')) 'Agent Hub Host.lnk'
$TerminalFragmentDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows Terminal\Fragments\AgentHub'
$ManagedSkillMarker = '.agent-hub-managed'
$ManagedSkillPaths = @(
    foreach ($skillName in @('color', 'colorall', 'renameall')) {
        Join-Path $env:USERPROFILE ".claude\skills\$skillName"
        Join-Path $env:USERPROFILE ".agents\skills\$skillName"
    }
)

Get-Process AgentChooserHost, AgentTerminalColorWatchdog -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 300
Write-Host "stopped host and terminal color watchdog"

foreach ($p in @($StartupLnk, $StartMenu, $ShortcutDir, $TerminalFragmentDir)) {
    if (Test-Path $p) { Remove-Item $p -Recurse -Force; Write-Host "removed $p" }
}

foreach ($skillPath in $ManagedSkillPaths) {
    $markerPath = Join-Path $skillPath $ManagedSkillMarker
    if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
        Remove-Item -LiteralPath $skillPath -Recurse -Force
        Write-Host "removed $skillPath"
    }
}

$pm2Task = Get-ScheduledTask -TaskName 'Agent Hub PM2 resurrect' -ErrorAction SilentlyContinue
if ($pm2Task) {
    Unregister-ScheduledTask -TaskName $pm2Task.TaskName -Confirm:$false
    Write-Host "removed scheduled task $($pm2Task.TaskName)"
}

if (Test-Path $InstallDir) {
    if ($Purge) {
        Remove-Item $InstallDir -Recurse -Force
        Write-Host "removed $InstallDir"
    } else {
        Get-ChildItem $InstallDir -Exclude 'last.ini' | Remove-Item -Recurse -Force
        Write-Host "removed $InstallDir contents (kept last.ini; use -Purge to delete it)"
    }
}

Write-Host ""
Write-Host "Uninstalled. Taskbar pins remain until you unpin them by hand."
