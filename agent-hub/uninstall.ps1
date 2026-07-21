#Requires -Version 5
<#
.SYNOPSIS
  Removes agent-hub: stops the host, deletes the install folder, shortcuts, and
  the logon entry.

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

Get-Process AgentChooserHost -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 300
Write-Host "stopped host"

foreach ($p in @($StartupLnk, $StartMenu, $ShortcutDir)) {
    if (Test-Path $p) { Remove-Item $p -Recurse -Force; Write-Host "removed $p" }
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
