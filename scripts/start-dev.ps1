# Unified dev server startup with automatic mobile connection
# - Starts Vite dev server immediately
# - Attempts mobile ADB connection in background with exponential backoff
# - Never blocks - mobile is optional

try { $Host.UI.RawUI.WindowTitle = "TKA Dev Server" } catch { }

# Configuration
$PHONE_IP = "192.168.12.107"
$DEV_PORT = 5173

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

function Clean-StaleDevices {
    Write-Status "Cleaning up stale ADB connections..." "DarkGray"

    # Get all devices
    $allDevices = adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_.Trim() -ne "" }

    foreach ($line in $allDevices) {
        if ($line -match "offline|unauthorized") {
            $deviceId = ($line -split "\s+")[0]
            Write-Status "  Disconnecting stale device: $deviceId" "Yellow"
            adb disconnect $deviceId 2>$null
        }
    }
}

function Get-ConnectedDevice {
    $devices = adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
    return $devices
}

function Setup-MobileForwarding {
    $device = Get-ConnectedDevice
    if ($device) {
        $deviceId = ($device -split "\s+")[0]
        Write-Status "Setting up port forwarding for $deviceId" "Cyan"
        adb -s $deviceId reverse tcp:$DEV_PORT tcp:$DEV_PORT 2>$null
        return $true
    }
    return $false
}

function Try-WirelessConnect {
    # Try common wireless debugging ports
    $ports = @(5555, 32849, 37777, 38000, 39000, 40000, 41000, 42000, 43000, 44000, 45000)

    foreach ($port in $ports) {
        $target = "${PHONE_IP}:$port"
        $result = adb connect $target 2>&1
        if ($result -match "connected|already") {
            Start-Sleep -Milliseconds 500
            if (Get-ConnectedDevice) {
                Write-Status "Connected to $target" "Green"
                return $true
            }
        }
    }
    return $false
}

# Background job for mobile connection with exponential backoff
$mobileJob = {
    param($PHONE_IP, $DEV_PORT)

    $retryDelay = 10  # Start at 10 seconds
    $maxDelay = 300   # Max 5 minutes between retries

    while ($true) {
        # Check if already connected
        $devices = adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }

        if ($devices) {
            # Already connected - setup forwarding and check periodically
            $deviceId = ($devices -split "\s+")[0]
            adb -s $deviceId reverse tcp:$DEV_PORT tcp:$DEV_PORT 2>$null
            Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [Mobile] Connected: $deviceId - Phone can access localhost:$DEV_PORT" -ForegroundColor Green
            $retryDelay = 10  # Reset backoff on success
            Start-Sleep -Seconds 30  # Check every 30s when connected
        } else {
            # Not connected - try wireless ports
            Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [Mobile] No device found, scanning..." -ForegroundColor DarkGray

            $ports = @(5555, 32849, 37777, 38000, 39000, 40000, 41000, 42000, 43000, 44000, 45000)
            $connected = $false

            foreach ($port in $ports) {
                $target = "${PHONE_IP}:$port"
                $result = adb connect $target 2>&1
                if ($result -match "connected") {
                    Start-Sleep -Milliseconds 500
                    $check = adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
                    if ($check) {
                        $connected = $true
                        break
                    }
                }
            }

            if (-not $connected) {
                Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [Mobile] No device available. Retrying in ${retryDelay}s..." -ForegroundColor DarkGray
                Start-Sleep -Seconds $retryDelay
                $retryDelay = [Math]::Min($retryDelay * 2, $maxDelay)  # Exponential backoff
            }
        }
    }
}

# Main execution
Write-Line ""
Write-Line "========================================"
Write-Line "     TKA Development Server"
Write-Line "========================================"
Write-Line ""

# Clean up stale connections
Clean-StaleDevices

# Check for existing device
$existingDevice = Get-ConnectedDevice
if ($existingDevice) {
    Write-Status "Device already connected!" "Green"
    Setup-MobileForwarding
} else {
    Write-Status "No device connected - will retry in background" "Yellow"
}

# Start mobile connection background job
Write-Status "Starting mobile connection monitor..." "DarkGray"
$job = Start-Job -ScriptBlock $mobileJob -ArgumentList $PHONE_IP, $DEV_PORT

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
