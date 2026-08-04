# Pin an Apollo instance to one physical monitor, by side rather than by GUID.
#
# RUN THIS ON d1 (the host), elevated. It is the whole "which of my two 4K
# panels does Mirror show" setup in one command:
#
#   powershell -ExecutionPolicy Bypass -File .\pin-apollo-display.ps1 -Instance 2 -Side left
#
# Instance 2 (port 48989) serves the laptop, instance 1 (47989) serves d2. So
# "laptop gets the left panel, d2's ultrawide gets the right" is:
#
#   -Instance 2 -Side left
#   -Instance 1 -Side right
#
# Add -WhatIf to see the decision without writing anything.
#
# Why a script instead of the dashboard: both panels are identical 4K, so
# friendly_name cannot tell you which is physically on the left. Desktop X
# coordinate can, and it is the only positional truth available. This joins
# Windows' screen geometry to Apollo's device ids and writes the winner to
# output_name (the config key behind the dashboard's "Display Device Id").

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [ValidateSet(1, 2)]  [int]    $Instance = 2,
  [ValidateSet("left", "right")] [string] $Side = "left"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

# --- Where this instance lives ---------------------------------------------

if ($Instance -eq 1) {
  $installDir  = "C:\Program Files\Apollo"
  $serviceName = "ApolloService"
} else {
  $installDir  = "C:\Program Files\Apollo2"
  $serviceName = "Apollo2Service"
}
$confPath = Join-Path $installDir "config\sunshine.conf"

if (-not (Test-Path $confPath)) { throw "No config at $confPath. Is instance $Instance installed?" }

# --- Apollo's view of the displays -----------------------------------------
# Apollo logs "Currently available display devices:" followed by a JSON array
# carrying device_id / display_name / friendly_name. That is the only place the
# device ids are exposed outside the web UI.

function Get-ApolloLogPath {
  $candidates = @(
    (Join-Path $installDir "config\sunshine.log"),
    (Join-Path $installDir "svctemp\sunshine.log"),   # per-service TEMP override
    (Join-Path $env:TEMP "sunshine.log"),
    "C:\Windows\Temp\sunshine.log"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}

function Get-ApolloDisplays {
  $log = Get-ApolloLogPath
  if (-not $log) { throw "Could not find Apollo's log. Open the dashboard's Troubleshooting tab instead and copy the device id by hand." }

  $text = Get-Content $log -Raw
  # Take the LAST enumeration in the log; earlier ones can predate a monitor
  # being plugged in or a driver reinstall.
  $matches = [regex]::Matches($text, 'Currently available display devices:\s*(\[.*?\])', 'Singleline')
  if ($matches.Count -eq 0) { throw "No display enumeration found in $log. Restart $serviceName and try again." }

  $json = $matches[$matches.Count - 1].Groups[1].Value
  return ($json | ConvertFrom-Json)
}

# --- Decide which one is the left (or right) physical panel ----------------

function Test-IsVirtual($entry) {
  # A connected client's virtual display shows up here too, and it must never
  # win the "leftmost" contest. SudoVDA is what Apollo bundles.
  $name = "$($entry.friendly_name) $($entry.device_id)"
  return ($name -match 'virtual|sudo|vda|idd')
}

$apollo  = Get-ApolloDisplays
$screens = [System.Windows.Forms.Screen]::AllScreens

$rows = @()
foreach ($entry in $apollo) {
  if (Test-IsVirtual $entry) { continue }
  $screen = $screens | Where-Object { $_.DeviceName -eq $entry.display_name } | Select-Object -First 1
  if (-not $screen) { continue }   # enumerated but not currently attached
  $rows += [pscustomobject]@{
    Side     = ""
    X        = $screen.Bounds.X
    Res      = "$($screen.Bounds.Width)x$($screen.Bounds.Height)"
    Primary  = $screen.Primary
    Display  = $entry.display_name
    Friendly = $entry.friendly_name
    DeviceId = $entry.device_id
  }
}

if ($rows.Count -lt 2) {
  Write-Warning "Found $($rows.Count) physical display(s). Pinning a side needs at least two."
}
if ($rows.Count -eq 0) { throw "No physical displays matched between Apollo and Windows." }

$sorted = $rows | Sort-Object X
$sorted[0].Side = "left"
$sorted[$sorted.Count - 1].Side = "right"

Write-Host ""
Write-Host "Physical displays on this machine, left to right:" -ForegroundColor Cyan
$sorted | Format-Table Side, X, Res, Primary, Display, Friendly, DeviceId -AutoSize | Out-String | Write-Host

$target = $sorted | Where-Object { $_.Side -eq $Side } | Select-Object -First 1
if (-not $target) { throw "Could not resolve the $Side display." }

Write-Host ("Instance {0} ({1}) will capture the {2} panel: {3}" -f $Instance, $serviceName, $Side, $target.DeviceId) -ForegroundColor Green

# --- Write output_name and restart -----------------------------------------

$conf = ""
if ((Get-Item $confPath).Length -gt 0) { $conf = Get-Content $confPath -Raw }

if ($conf -match '(?m)^\s*output_name\s*=.*$') {
  $conf = [regex]::Replace($conf, '(?m)^\s*output_name\s*=.*$', "output_name = $($target.DeviceId)")
} else {
  if ($conf.Length -gt 0 -and -not $conf.EndsWith("`n")) { $conf += "`r`n" }
  $conf += "output_name = $($target.DeviceId)`r`n"
}

if ($PSCmdlet.ShouldProcess($confPath, "set output_name to the $Side panel and restart $serviceName")) {
  Copy-Item $confPath "$confPath.bak" -Force
  Set-Content -Path $confPath -Value $conf -Encoding ascii
  Restart-Service $serviceName -Force
  Write-Host "Done. $serviceName restarted; backup at $confPath.bak" -ForegroundColor Green
  Write-Host "Reconnect the client to pick it up." -ForegroundColor Green
}
