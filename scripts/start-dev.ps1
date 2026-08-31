# Unified dev server startup
# - Starts the Vite dev server (background), waits until it actually serves,
#   THEN starts the Cloudflare tunnel (dev.tkaflowarts.com).
# - Verifies installed dependency manifests and imports before Vite starts. A
#   broken install is rebuilt from the frozen lockfile and rechecked first.
# - Restores the machine-local mkcert certificate pair before Vite starts. The
#   tunnel always targets HTTPS, so allowing Vite to silently fall back to HTTP
#   would leave a connected tunnel returning 502s.
# - Ordering matters: cloudflared connects to Cloudflare's edge in ~1s, but Vite
#   on a project this size takes much longer to boot. If the tunnel comes up
#   first, dev.tkaflowarts.com returns 502 Bad Gateway for the whole cold-boot
#   window (edge connected, origin not yet answering). Gating the tunnel on a
#   real 200 from the origin closes that window.
# - The script blocks on Vite and tears the tunnel down on exit.
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

# Poll the Vite origin until it serves a 200 (or we time out). curl.exe ships
# with Windows 10/11 and honors -k for the mkcert self-signed dev cert; Windows
# PowerShell 5.1's Invoke-WebRequest has no -SkipCertificateCheck. A pre-boot
# request yields "000" (connection refused) until Vite is listening.
function Wait-ForOrigin {
    param([string]$Url = "https://localhost:5173/", [int]$TimeoutSec = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $code = & curl.exe -k -s -o NUL -w "%{http_code}" --max-time 5 $Url
        if ($code -eq "200") { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# Stop-Process on the cmd wrapper leaves the pnpm/node grandchildren alive
# (it is not a tree kill), and an orphaned vite holding :5173 pushes the next
# boot to :5174 because `pnpm run dev` has no --strictPort — which silently
# breaks the tunnel and every localhost:5173 consumer. taskkill /T takes the
# whole tree down.
function Stop-ProcessTree($processId) {
    if ($processId) {
        & taskkill.exe /PID $processId /T /F 2>$null | Out-Null
    }
}

# Pre-boot sweep: anything already listening on :5173 is a stale server from a
# previous run — tree-kill it so this boot owns the port. If pm2 supervises
# tka-dev, stop it through pm2 FIRST: killing its vite directly makes pm2
# respawn it instantly, and the respawn wins the race for :5173 (manual boots
# then die with "port already in use"). Skipped when we ARE the pm2 child
# (TKA_PM2 set by start-dev-pm2.cjs) — pm2 stop would stop ourselves.
function Stop-Pm2App {
    if ($env:TKA_PM2) { return }
    $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
    if ($pm2) {
        Write-Status "Stopping pm2 app tka-dev (manual run takes over; 'pm2 start tka-dev' to hand back)."
        & pm2 stop tka-dev 2>$null | Out-Null
    }
}
function Clear-Port5173 {
    $owners = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($ownerPid in $owners) {
        Write-Status "Port 5173 held by PID $ownerPid - killing its process tree."
        Stop-ProcessTree $ownerPid
    }
    if ($owners) { Start-Sleep -Seconds 2 }
}

# Vite remembers failed package resolution for the life of the process. Check
# the real installed files and import the boot-critical dependency graph before
# Vite is allowed to start, so a hollow pnpm package directory cannot poison the
# module graph until Austen restarts again.
function Test-WorkspaceInstall($RepoRoot) {
    $verifier = Join-Path $RepoRoot "scripts\verify-workspace-install.mjs"
    $check = Start-Process -FilePath "node.exe" -ArgumentList $verifier, $RepoRoot `
        -WorkingDirectory $RepoRoot -NoNewWindow -Wait -PassThru
    return $check.ExitCode -eq 0
}

function Invoke-RepoCommand($RepoRoot, $Command) {
    $commandProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/d", "/s", "/c", $Command `
        -WorkingDirectory $RepoRoot -NoNewWindow -Wait -PassThru
    return $commandProcess.ExitCode
}

function Repair-WorkspaceInstall($RepoRoot) {
    Write-Status "Dependency preflight failed - rebuilding the frozen install before Vite starts."

    $installExit = Invoke-RepoCommand $RepoRoot "pnpm install --force --offline --frozen-lockfile --reporter=append-only"
    if ($installExit -ne 0) {
        Write-Status "Offline repair could not complete - retrying from the registry with the same frozen lockfile."
        $installExit = Invoke-RepoCommand $RepoRoot "pnpm install --force --frozen-lockfile --reporter=append-only"
    }
    if ($installExit -ne 0) {
        throw "Dependency repair failed. Vite was not started with an unhealthy install."
    }

    $buildExit = Invoke-RepoCommand $RepoRoot "pnpm run build:packages"
    if ($buildExit -ne 0) {
        throw "Workspace package rebuild failed. Vite was not started with stale package entrypoints."
    }

    if (-not (Test-WorkspaceInstall $RepoRoot)) {
        throw "Dependency repair completed but the install still fails its importability check. Vite was not started."
    }

    # The repaired package version may be identical, so source paths alone do
    # not prove Vite's existing optimizer output is safe. Force exactly the next
    # dev-server optimizer pass through the canonical Vite cache owner.
    $env:TKA_FORCE_VITE_DEPS = "1"
    Write-Status "Dependency repair verified - Vite will rebuild its dependency cache once."
}

function Ensure-DevHttpsCertificate($RepoRoot) {
    $certificateDirectory = Join-Path $RepoRoot ".cert"
    $certificatePath = Join-Path $certificateDirectory "dev-cert.pem"
    $keyPath = Join-Path $certificateDirectory "dev-key.pem"

    if ((Test-Path -LiteralPath $certificatePath) -and (Test-Path -LiteralPath $keyPath)) {
        return
    }

    $mkcert = Join-Path $RepoRoot ".tools\mkcert.exe"
    if (-not (Test-Path -LiteralPath $mkcert)) {
        throw "Dev HTTPS certificate is missing and $mkcert is unavailable. Vite was not started because the Cloudflare tunnel requires HTTPS."
    }

    New-Item -ItemType Directory -Force -Path $certificateDirectory | Out-Null
    Write-Status "Dev HTTPS certificate missing - regenerating the localhost certificate pair."
    & $mkcert -cert-file $certificatePath -key-file $keyPath localhost 127.0.0.1 ::1

    if (($LASTEXITCODE -ne 0) -or
        (-not (Test-Path -LiteralPath $certificatePath)) -or
        (-not (Test-Path -LiteralPath $keyPath))) {
        throw "Dev HTTPS certificate generation failed. Vite was not started because the Cloudflare tunnel requires HTTPS."
    }

    Write-Status "Dev HTTPS certificate restored."
}

# Main execution
Write-Line ""
Write-Line "========================================"
Write-Line "     TKA Development Server"
Write-Line "========================================"
Write-Line ""

# --- Resolve cloudflared + credentials (tunnel starts later, after Vite is up) -
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

# --- Start Vite first, in the background, so we can wait for it -----------------
# cmd.exe /c wraps pnpm (a .cmd/.ps1 shim Start-Process can't launch directly)
# and stays alive for the life of the dev server. -NoNewWindow streams Vite logs
# into this console and keeps node in this process tree, so console Ctrl+C and
# VS Code "terminate" both reach it. WorkingDirectory is the repo root.
$repoRoot = Split-Path -Parent $PSScriptRoot
Ensure-DevHttpsCertificate $repoRoot
if (-not (Test-WorkspaceInstall $repoRoot)) {
    Stop-Pm2App
    Clear-Port5173
    Repair-WorkspaceInstall $repoRoot
} else {
    Stop-Pm2App
    Clear-Port5173
}
Write-Status "Starting Vite dev server..."
Write-Line ""
$viteProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm run dev" `
    -WorkingDirectory $repoRoot -NoNewWindow -PassThru

try {
    # --- Wait for Vite to actually serve, THEN bring up the tunnel -------------
    if (-not $cloudflared) {
        Write-Status "cloudflared not found - skipping tunnel. Install: winget install Cloudflare.cloudflared"
    } elseif ((Test-Path $tokenFile) -or (Test-Path $certFile)) {
        Write-Status "Waiting for Vite on https://localhost:5173 before opening the tunnel..."
        if (Wait-ForOrigin) {
            Write-Status "Vite is serving - starting Cloudflare tunnel (dev.tkaflowarts.com)."
        } else {
            Write-Status "Vite not ready after 180s - starting tunnel anyway (may 502 until Vite is up)."
        }

        if (Test-Path $tokenFile) {
            $token = (Get-Content $tokenFile -Raw).Trim()
            # tka-dev is a locally-managed tunnel, so token-based runs get no ingress
            # rules from Cloudflare - without --url every request 503s.
            # -NoNewWindow streams cloudflared logs into this console alongside Vite.
            # Vite dev serves HTTPS/2 (mkcert). Origin must be https; --no-tls-verify
            # because cloudflared can't load the Windows trust store for the mkcert CA.
            $tunnelProc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "run", "--token", $token, "--no-tls-verify", "--url", "https://localhost:5173" -NoNewWindow -PassThru
        } else {
            $tunnelProc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "run", "tka-dev" -NoNewWindow -PassThru
        }

        if ($tunnelProc) {
            # Kill the tunnel if this window closes without hitting the finally block.
            $null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
                Get-Process -Id $event.MessageData -ErrorAction SilentlyContinue | Stop-Process -Force
            } -MessageData $tunnelProc.Id
            Write-Status "Tunnel: https://dev.tkaflowarts.com"
        }
    } else {
        Write-Status "No tunnel credentials - dev.tkaflowarts.com will NOT be live."
        Write-Status "  One-time fix: run 'cloudflared tunnel login', then restart."
        Write-Status "  (Or save the tunnel token to $tokenFile)"
    }

    # Block on Vite (keeps the script alive). A poll loop rather than
    # WaitForExit() so console Ctrl+C interrupts cleanly and the finally runs.
    while ($viteProc -and -not $viteProc.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Status "Shutting down..."
    if ($tunnelProc -and -not $tunnelProc.HasExited) {
        Stop-ProcessTree $tunnelProc.Id
    }
    if ($viteProc -and -not $viteProc.HasExited) {
        Stop-ProcessTree $viteProc.Id
    }
}
