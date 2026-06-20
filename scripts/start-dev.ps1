# Unified dev server startup
# - Starts the Cloudflare tunnel (dev.tkaflowarts.com) in the background
# - Starts the Vite dev server (blocks)
#
# Tunnel credentials (one-time setup on a new machine), first match wins:
#   1. Token file:  %USERPROFILE%\.cloudflared\tka-dev.token
#      (paste the tunnel token from Cloudflare Zero Trust -> Networks -> Tunnels,
#       or run `cloudflared tunnel token tka-dev` on a logged-in machine)
#   2. Origin cert: %USERPROFILE%\.cloudflared\cert.pem  (from `cloudflared tunnel login`)
# If neither exists the tunnel is skipped with a warning and Vite starts anyway.

try { $Host.UI.RawUI.WindowTitle = "TKA Dev Server" } catch { }

# Stream to real stdout so MINGW / Git Bash pty flushes live.
# Write-Host writes to the PS host object, which Git Bash's pty does not
# see until the child process exits. [Console]::Out.WriteLine goes direct
# to stdout so output appears line-by-line in bash terminals.
function Write-Line($msg) {
    [Console]::Out.WriteLine($msg)
    [Console]::Out.Flush()
}
function Write-Status($msg, $color = "White") {
    Write-Line "[$((Get-Date).ToString('HH:mm:ss'))] $msg"
}

# Main execution
Write-Line ""
Write-Line "========================================"
Write-Line "     TKA Development Server"
Write-Line "========================================"
Write-Line ""

# --- Cloudflare tunnel (dev.tkaflowarts.com) ---------------------------------
$cloudflared = $null
# Only a real .exe works with Start-Process. Get-Command can resolve to the npm
# shim (cloudflared.ps1, an ExternalScript) which Start-Process rejects with
# "%1 is not a valid Win32 application." Take an Application whose source ends in
# .exe; otherwise fall back to the known install path.
$cmd = Get-Command cloudflared -CommandType Application -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -like "*.exe" } | Select-Object -First 1
if ($cmd) { $cloudflared = $cmd.Source }
elseif (Test-Path "C:\Program Files (x86)\cloudflared\cloudflared.exe") {
    $cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
}

$tokenFile = Join-Path $env:USERPROFILE ".cloudflared\tka-dev.token"
$certFile = Join-Path $env:USERPROFILE ".cloudflared\cert.pem"
$tunnelProc = $null

if (-not $cloudflared) {
    Write-Status "cloudflared not found - skipping tunnel. Install: winget install Cloudflare.cloudflared"
} elseif (Test-Path $tokenFile) {
    $token = (Get-Content $tokenFile -Raw).Trim()
    Write-Status "Starting Cloudflare tunnel (dev.tkaflowarts.com) via token..."
    # tka-dev is a locally-managed tunnel, so token-based runs get no ingress
    # rules from Cloudflare - without --url every request 503s.
    # -NoNewWindow streams cloudflared logs into this console alongside Vite.
    $tunnelProc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "run", "--token", $token, "--url", "http://localhost:5173" -NoNewWindow -PassThru
} elseif (Test-Path $certFile) {
    Write-Status "Starting Cloudflare tunnel (dev.tkaflowarts.com) via origin cert..."
    $tunnelProc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "run", "tka-dev" -NoNewWindow -PassThru
} else {
    Write-Status "No tunnel credentials - dev.tkaflowarts.com will NOT be live."
    Write-Status "  One-time fix: run 'cloudflared tunnel login', then restart."
    Write-Status "  (Or save the tunnel token to $tokenFile)"
}

if ($tunnelProc) {
    # Kill the tunnel if this window closes without hitting the finally block.
    $null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
        Get-Process -Id $event.MessageData -ErrorAction SilentlyContinue | Stop-Process -Force
    } -MessageData $tunnelProc.Id
    Write-Status "Tunnel: https://dev.tkaflowarts.com"
}

Write-Line ""
Write-Status "Starting Vite dev server..."
Write-Line ""

# Start the dev server (this blocks - which is what we want)
try {
    pnpm run dev
} finally {
    Write-Status "Shutting down..."
    if ($tunnelProc -and -not $tunnelProc.HasExited) {
        Stop-Process -Id $tunnelProc.Id -Force -ErrorAction SilentlyContinue
    }
}
