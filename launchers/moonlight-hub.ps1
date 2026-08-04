# Moonlight Hub - a one-click card for jumping straight into a stream.
#
# Same shape as Agent Hub: a pinned taskbar shortcut opens a small card at the
# cursor, you press a number (or Enter for last used), the stream starts. No
# Moonlight host list to navigate, no picking the right app tile, no remembering
# which of d1's two Apollo instances is which.
#
# The host address is DISCOVERED, never hardcoded - this repo is public and the
# Moonlight runbook forbids committing tailnet addresses. First run probes the
# tailnet for a peer listening on the Apollo port and caches the answer; later
# runs reuse the cache and only re-probe if it has gone stale.

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

$ErrorActionPreference = "Stop"

# --- What you can jump into ------------------------------------------------
# Apollo serves each client its own instance on d1. Ports are +1000 per
# instance: instance 1 (d2) is 47989, instance 2 (this laptop) is 48989.
$HostPort = 48989

# "Virtual Display" is Apollo's app that CREATES a screen. "Desktop" captures a
# physical monitor d1 already has. The quotes matter - the space in the app name
# truncates to "Virtual" without them and Apollo answers "Failed to find
# application Virtual".
$Modes = @(
  [pscustomobject]@{
    Key   = "1"
    Title = "Extended"
    Blurb = "New screen on d1, 1:1 native"
    App   = "Virtual Display"
    Args  = "--resolution 1920x1200 --fps 60 --bitrate 40000 --video-codec HEVC"
  },
  [pscustomobject]@{
    Key   = "2"
    Title = "Mirror"
    Blurb = "Show d1's own monitor"
    App   = "Desktop"
    Args  = "--resolution 1920x1200 --fps 60 --bitrate 40000 --video-codec HEVC"
  },
  [pscustomobject]@{
    Key   = "3"
    Title = "Away"
    Blurb = "Off the LAN, low bandwidth"
    App   = "Virtual Display"
    Args  = "--resolution 1920x1080 --fps 60 --bitrate 5000 --video-codec HEVC"
  }
)

$Moonlight = "C:\Program Files\Moonlight Game Streaming\Moonlight.exe"
$StateDir  = Join-Path $env:LOCALAPPDATA "MoonlightHub"
$HostCache = Join-Path $StateDir "host.txt"
$LastFile  = Join-Path $StateDir "last.txt"

if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }

# --- Finding the host ------------------------------------------------------

function Test-ApolloPort([string]$Address) {
  # Test-NetConnection is far too slow for a launcher (seconds per closed port).
  # A raw socket with a short timeout keeps the card feeling instant.
  if (-not $Address) { return $false }
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($Address, $HostPort, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(600, $false)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Resolve-StreamHost {
  # Cached answer first - this is the common path and costs one fast probe.
  if (Test-Path $HostCache) {
    $cached = (Get-Content $HostCache -Raw).Trim()
    if (Test-ApolloPort $cached) { return $cached }
  }

  # Otherwise ask the tailnet who is listening on Apollo's port. Same
  # fingerprint the runbook's Step 2 uses, so it survives a node being
  # recreated with a new address.
  try {
    $peers = (tailscale status --json | ConvertFrom-Json).Peer.PSObject.Properties.Value
  } catch {
    return $null
  }

  foreach ($peer in $peers) {
    if (-not $peer.Online) { continue }
    foreach ($ip in $peer.TailscaleIPs) {
      if ($ip -notmatch ':' -and (Test-ApolloPort $ip)) {
        Set-Content -Path $HostCache -Value $ip -Encoding ascii
        return $ip
      }
    }
  }
  return $null
}

function Start-Stream($Mode, [string]$Address) {
  Set-Content -Path $LastFile -Value $Mode.Key -Encoding ascii
  $line = 'stream {0}:{1} "{2}" {3} --frame-pacing --display-mode fullscreen' -f `
    $Address, $HostPort, $Mode.App, $Mode.Args
  Start-Process -FilePath $Moonlight -ArgumentList $line
}

# --- The card --------------------------------------------------------------

$bg     = [System.Drawing.Color]::FromArgb(24, 24, 28)
$tile   = [System.Drawing.Color]::FromArgb(38, 38, 46)
$accent = [System.Drawing.Color]::FromArgb(129, 140, 248)   # matches --theme-accent
$text   = [System.Drawing.Color]::FromArgb(238, 238, 242)
$dim    = [System.Drawing.Color]::FromArgb(150, 150, 162)

$lastKey = ""
if (Test-Path $LastFile) { $lastKey = (Get-Content $LastFile -Raw).Trim() }

$form                 = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = "None"
$form.BackColor       = $bg
$form.TopMost         = $true
$form.ShowInTaskbar   = $false
$form.KeyPreview      = $true
$form.StartPosition   = "Manual"
$form.Width           = 340
$form.Height          = 96 + ($Modes.Count * 62)

# Open at the cursor like Agent Hub's popover, but keep the whole card on
# screen when the click happens near an edge.
$cursor = [System.Windows.Forms.Cursor]::Position
$screen = [System.Windows.Forms.Screen]::FromPoint($cursor).WorkingArea
$x = [Math]::Min($cursor.X, $screen.Right - $form.Width - 8)
$y = [Math]::Min($cursor.Y, $screen.Bottom - $form.Height - 8)
$form.Location = New-Object System.Drawing.Point([Math]::Max($screen.Left, $x), [Math]::Max($screen.Top, $y))

$title           = New-Object System.Windows.Forms.Label
$title.Text      = "Stream d1"
$title.ForeColor = $text
$title.Font      = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$title.SetBounds(18, 14, 220, 30)
$form.Controls.Add($title)

$status           = New-Object System.Windows.Forms.Label
$status.ForeColor = $dim
$status.Font      = New-Object System.Drawing.Font("Segoe UI", 8)
$status.SetBounds(18, 44, 300, 18)
$status.Text      = "finding d1..."
$form.Controls.Add($status)

$streamHost = $null

function Invoke-Mode($Mode) {
  if (-not $streamHost) { return }
  $form.Hide()
  Start-Stream $Mode $streamHost
  $form.Close()
}

$top = 70
foreach ($mode in $Modes) {
  $btn           = New-Object System.Windows.Forms.Button
  $btn.FlatStyle = "Flat"
  $btn.BackColor = $tile
  $btn.ForeColor = $text
  $btn.TextAlign = "MiddleLeft"
  $btn.Font      = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
  $btn.Text      = "  $($mode.Key)   $($mode.Title)"
  $btn.SetBounds(14, $top, 312, 54)
  $btn.FlatAppearance.BorderSize = 0
  $btn.Enabled = $false
  if ($mode.Key -eq $lastKey) { $btn.FlatAppearance.BorderSize = 1; $btn.FlatAppearance.BorderColor = $accent }
  $btn.Tag = $mode
  $btn.Add_Click({ Invoke-Mode $this.Tag }.GetNewClosure())
  $form.Controls.Add($btn)

  # The blurb rides on top of the button so the whole tile stays clickable.
  $sub           = New-Object System.Windows.Forms.Label
  $sub.Text      = $mode.Blurb
  $sub.ForeColor = $dim
  $sub.Font      = New-Object System.Drawing.Font("Segoe UI", 8)
  $sub.BackColor = $tile
  $sub.SetBounds(44, $top + 30, 270, 16)
  $sub.Tag = $mode
  $sub.Add_Click({ Invoke-Mode $this.Tag }.GetNewClosure())
  $form.Controls.Add($sub)
  $sub.BringToFront()

  $top += 62
}

$form.Add_KeyDown({
  if ($_.KeyCode -eq "Escape") { $form.Close(); return }
  if ($_.KeyCode -eq "Return") {
    $m = $Modes | Where-Object { $_.Key -eq $lastKey } | Select-Object -First 1
    if (-not $m) { $m = $Modes[0] }
    Invoke-Mode $m
    return
  }
  # KeyCode for the number row comes through as D1/D2/D3.
  $ch = $_.KeyCode.ToString() -replace "^D", ""
  $pressed = $Modes | Where-Object { $_.Key -eq $ch } | Select-Object -First 1
  if ($pressed) { Invoke-Mode $pressed }
})

# Click away to dismiss, same as the Agent Hub card.
$form.Add_Deactivate({ $form.Close() })

# Resolve after the card is on screen so it appears instantly rather than
# waiting on the network.
$form.Add_Shown({
  $form.Activate()
  $script:streamHost = Resolve-StreamHost
  if ($streamHost) {
    $status.Text = "d1 at $streamHost    Enter = last used    Esc to cancel"
    foreach ($c in $form.Controls) { if ($c -is [System.Windows.Forms.Button]) { $c.Enabled = $true } }
  } else {
    $status.ForeColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
    $status.Text = "d1 not reachable. Is it awake and on the tailnet?"
  }
})

[void]$form.ShowDialog()
