# Unified dev server startup
# - Starts the Cloudflare tunnel (dev.tkaflowarts.com) in the background
# - Starts the Vite dev server (blocks)

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

# Start Cloudflare tunnel for dev.tkaflowarts.com
Write-Status "Starting Cloudflare tunnel (dev.tkaflowarts.com)..." "Cyan"
$tunnelJob = Start-Job -ScriptBlock {
    cloudflared tunnel run tka-dev 2>&1 | ForEach-Object {
        Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [Tunnel] $_" -ForegroundColor DarkCyan
    }
}

# Register cleanup on exit
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Get-Job | Stop-Job -PassThru | Remove-Job -Force
}

Write-Line ""
Write-Status "Starting Vite dev server..." "Green"
Write-Status "Tunnel: https://dev.tkaflowarts.com" "Cyan"
Write-Line ""

# Start the dev server (this blocks - which is what we want)
try {
    pnpm run dev
} finally {
    # Cleanup
    Write-Status "Shutting down..." "Yellow"
    Get-Job | Stop-Job -PassThru | Remove-Job -Force
}
