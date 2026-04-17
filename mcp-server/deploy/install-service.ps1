# Installs the Flow Arts Knowledge MCP server as a Windows service.
# Requires: Administrator elevation.
# Installs NSSM via winget if missing, then registers the service.

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'
$ServiceName = 'FlowArtsKnowledgeMCP'
$LauncherPath = 'E:\tka-platform\mcp-server\deploy\run-mcp-http.cmd'
$LogDir = 'E:\tka-platform\mcp-server\deploy\logs'

if (-not (Test-Path $LauncherPath)) {
    throw "Launcher not found at $LauncherPath"
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

# --- 1. Ensure NSSM is available ---
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssm) {
    Write-Host "Installing NSSM via winget..."
    winget install --id NSSM.NSSM --accept-source-agreements --accept-package-agreements --silent
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    $nssm = Get-Command nssm -ErrorAction SilentlyContinue
    if (-not $nssm) {
        throw "NSSM install failed. Install manually from https://nssm.cc/download"
    }
}
Write-Host "NSSM located at: $($nssm.Source)"

# --- 2. Remove any prior install ---
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing service..."
    & nssm stop $ServiceName confirm | Out-Null
    & nssm remove $ServiceName confirm | Out-Null
    Start-Sleep -Seconds 2
}

# --- 3. Install fresh ---
Write-Host "Installing service $ServiceName..."
& nssm install $ServiceName $LauncherPath
& nssm set $ServiceName AppDirectory 'E:\tka-platform\mcp-server'
& nssm set $ServiceName DisplayName 'Flow Arts Knowledge MCP Server'
& nssm set $ServiceName Description 'HTTP MCP server on port 3333 for TKA/VTG domain knowledge.'
& nssm set $ServiceName Start SERVICE_AUTO_START
& nssm set $ServiceName AppStdout (Join-Path $LogDir 'mcp-stdout.log')
& nssm set $ServiceName AppStderr (Join-Path $LogDir 'mcp-stderr.log')
& nssm set $ServiceName AppRotateFiles 1
& nssm set $ServiceName AppRotateOnline 1
& nssm set $ServiceName AppRotateBytes 10485760
& nssm set $ServiceName AppThrottle 5000
& nssm set $ServiceName AppExit Default Restart
& nssm set $ServiceName AppRestartDelay 3000

# --- 4. Start it ---
Write-Host "Starting service..."
& nssm start $ServiceName

Start-Sleep -Seconds 8

# --- 5. Verify ---
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3333/' -UseBasicParsing -TimeoutSec 5
    Write-Host ""
    Write-Host "SUCCESS. Service is responding on http://localhost:3333/"
    Write-Host "  Status: $($response.StatusCode)"
    Write-Host "  Body:   $($response.Content)"
} catch {
    Write-Host ""
    Write-Host "Service installed but not responding yet. Check logs:"
    Write-Host "  $LogDir\mcp-stderr.log"
    throw
}

Write-Host ""
Write-Host "Next step: set up the Cloudflare tunnel (see deploy\README.md)."
