# Installs the Moonlight Hub shortcut. Idempotent — re-run any time.
#
# Drops the pin next to the Agent Hub shortcuts so both live in one folder, and
# on the Desktop for convenience. Drag either onto the taskbar to pin it.
#
#   powershell -ExecutionPolicy Bypass -File .\install-moonlight-hub.ps1

param(
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

$here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$hubScript = Join-Path $here "moonlight-hub.ps1"
if (-not (Test-Path $hubScript)) { throw "moonlight-hub.ps1 not found next to this installer" }

$moonlight = "C:\Program Files\Moonlight Game Streaming\Moonlight.exe"
$binDir    = Join-Path $env:LOCALAPPDATA "MoonlightHub"
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }

# PowerShell always flashes a console window, even with -WindowStyle Hidden,
# because the host allocates one before the script can hide it. wscript starts
# the process with the window already suppressed, so the card just appears.
$shim = Join-Path $binDir "moonlight-hub.vbs"
$vbs = @"
' Launches the Moonlight Hub card with no console flash.
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""$hubScript""", 0, False
"@
Set-Content -Path $shim -Value $vbs -Encoding ascii

$targets = @(
  (Join-Path $env:USERPROFILE "AgentHub"),   # where the Agent Hub pins already live
  [Environment]::GetFolderPath('Desktop')
)

$wsh = New-Object -ComObject WScript.Shell
foreach ($dir in $targets) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $lnkPath = Join-Path $dir "Stream d1.lnk"
  $lnk = $wsh.CreateShortcut($lnkPath)
  $lnk.TargetPath       = "$env:WINDIR\System32\wscript.exe"
  $lnk.Arguments        = '"' + $shim + '"'
  $lnk.WorkingDirectory = $binDir
  $lnk.Description      = "Jump straight into a d1 stream"
  # Borrow Moonlight's own icon so the pin is recognizable at a glance.
  if (Test-Path $moonlight) { $lnk.IconLocation = "$moonlight,0" }
  $lnk.Save()
  Write-Host "shortcut: $lnkPath"
}

Write-Host ""
Write-Host "Drag 'Stream d1' onto the taskbar to pin it."
if (-not $NoOpen) { Start-Process explorer.exe (Join-Path $env:USERPROFILE "AgentHub") }
