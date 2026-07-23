[CmdletBinding()]
param(
    [switch]$SmokeTest,
    [ValidateRange(1024, 65535)]
    [int]$Port = 4173
)

$ErrorActionPreference = "Stop"

try { $Host.UI.RawUI.WindowTitle = "TKA Last Local Build" } catch { }

function Write-Line([string]$Message) {
    [Console]::Out.WriteLine($Message)
    [Console]::Out.Flush()
}

function Write-Status([string]$Message) {
    Write-Line "[$((Get-Date).ToString('HH:mm:ss'))] $Message"
}

function Stop-ProcessTree([int]$ProcessId) {
    if ($ProcessId -gt 0) {
        & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$cloudflareDir = Join-Path $repoRoot ".svelte-kit\cloudflare"
$serverEntry = Join-Path $repoRoot ".svelte-kit\output\server\index.js"
$stateDir = Join-Path $repoRoot ".stable-preview-state"
$devCertPath = Join-Path $repoRoot ".cert\dev-cert.pem"
$devKeyPath = Join-Path $repoRoot ".cert\dev-key.pem"
$abortedSnapshotDir = Join-Path $repoRoot ".stable-preview-next"
$abortedWranglerConfig = Join-Path $repoRoot ".stable-preview-next.wrangler.toml"

function Remove-AbortedSnapshot {
    $expectedRoot = [IO.Path]::GetFullPath($repoRoot) +
        [IO.Path]::DirectorySeparatorChar
    $stagingPath = [IO.Path]::GetFullPath($abortedSnapshotDir)
    $configPath = [IO.Path]::GetFullPath($abortedWranglerConfig)

    if (
        -not $stagingPath.StartsWith(
            $expectedRoot,
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        -not $configPath.StartsWith(
            $expectedRoot,
            [StringComparison]::OrdinalIgnoreCase
        )
    ) {
        throw "Refusing to clean an unexpected path."
    }

    if (Test-Path -LiteralPath $stagingPath) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
        Write-Status "Removed the aborted snapshot staging directory."
    }
    if (Test-Path -LiteralPath $configPath) {
        Remove-Item -LiteralPath $configPath -Force
    }
}

function Get-PortOwners([int]$LocalPort) {
    return @(
        Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    )
}

function Assert-PortAvailable {
    $owners = Get-PortOwners $Port
    if ($owners.Count -eq 0) {
        return
    }

    $ownerDetails = @(
        foreach ($ownerPid in $owners) {
            Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
        }
    )
    $localBuildOwner = $ownerDetails |
        Where-Object { $_.CommandLine -match "wrangler\.js.*pages dev.*\.svelte-kit" } |
        Select-Object -First 1

    if ($localBuildOwner) {
        Write-Status "The last local build is already running at https://localhost:$Port."
        exit 0
    }

    $summary = ($ownerDetails | ForEach-Object {
        "PID $($_.ProcessId): $($_.CommandLine)"
    }) -join [Environment]::NewLine
    throw "Port $Port is already in use.$([Environment]::NewLine)$summary"
}

function Assert-AgentServerBudget {
    $devOwners = Get-PortOwners 5173
    $serverProcesses = @(
        Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
            Where-Object {
                $_.CommandLine -match "vite\\bin\\vite\.js" -or
                $_.CommandLine -match "wrangler\.js.*pages dev"
            }
    )
    $agentServers = @(
        $serverProcesses |
            Where-Object { $_.ProcessId -notin $devOwners }
    )

    if ($agentServers.Count -ge 2) {
        $summary = ($agentServers | ForEach-Object {
            "PID $($_.ProcessId): $($_.CommandLine)"
        }) -join [Environment]::NewLine
        throw "Two agent servers are already running. Stop one before starting the local build preview.$([Environment]::NewLine)$summary"
    }
}

function Assert-MemoryBudget {
    $availableMb = [math]::Round(
        (Get-Counter "\Memory\Available MBytes").CounterSamples[0].CookedValue
    )
    if ($availableMb -lt 4096) {
        throw "Only $availableMb MB of memory is available. The local build preview needs at least 4096 MB."
    }
}

function Resolve-WranglerBin {
    $adapter = Get-Item -LiteralPath (
        Join-Path $repoRoot "node_modules\@sveltejs\adapter-cloudflare"
    ) -Force
    $adapterPath = if ($adapter.Target) {
        [string]$adapter.Target
    } else {
        $adapter.FullName
    }
    $virtualNodeModules = Split-Path (
        Split-Path $adapterPath -Parent
    ) -Parent
    $wranglerBin = Join-Path $virtualNodeModules "wrangler\bin\wrangler.js"

    if (-not (Test-Path -LiteralPath $wranglerBin)) {
        throw "Wrangler is missing. Open https://tkaflowarts.com instead."
    }
    return $wranglerBin
}

function Get-OriginCode([string]$Url) {
    return & curl.exe -k -s -o NUL -w "%{http_code}" --max-time 5 $Url 2>$null
}

function Wait-ForOrigin([string]$Url, [int]$TimeoutSec = 60) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $code = Get-OriginCode $Url
        if ($code -match "^[23]\d\d$") {
            return $code
        }
        Start-Sleep -Milliseconds 500
    }
    return "000"
}

Set-Location $repoRoot
Remove-AbortedSnapshot

if (
    -not (Test-Path -LiteralPath (Join-Path $cloudflareDir "_worker.js")) -or
    -not (Test-Path -LiteralPath (Join-Path $cloudflareDir "index.html")) -or
    -not (Test-Path -LiteralPath $serverEntry)
) {
    throw "No completed local build is available. Open https://tkaflowarts.com instead."
}

Assert-PortAvailable
Assert-AgentServerBudget
Assert-MemoryBudget

$wranglerBin = Resolve-WranglerBin
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$protocol = "http"
$arguments = @(
    $wranglerBin,
    "pages",
    "dev",
    $cloudflareDir,
    "--port",
    [string]$Port,
    "--ip",
    "0.0.0.0",
    "--persist-to",
    $stateDir,
    "--log-level",
    "info",
    "--show-interactive-dev-session=false"
)

if (
    (Test-Path -LiteralPath $devCertPath) -and
    (Test-Path -LiteralPath $devKeyPath)
) {
    $protocol = "https"
    $arguments += @(
        "--local-protocol",
        "https",
        "--https-cert-path",
        $devCertPath,
        "--https-key-path",
        $devKeyPath
    )
}

$origin = "${protocol}://localhost:$Port"
Write-Status "Starting the last completed local build at $origin."
$previewProcess = Start-Process -FilePath $nodeExe -ArgumentList $arguments `
    -WorkingDirectory $repoRoot -NoNewWindow -PassThru

try {
    $rootCode = Wait-ForOrigin "$origin/"
    if ($rootCode -notmatch "^[23]\d\d$") {
        throw "The local build preview did not answer within 60 seconds."
    }

    $appCode = Get-OriginCode "$origin/app"
    $versionCode = Get-OriginCode "$origin/_app/version.json"
    if ($appCode -notmatch "^[23]\d\d$") {
        throw "/app returned HTTP $appCode."
    }
    if ($versionCode -ne "200") {
        throw "/_app/version.json returned HTTP $versionCode."
    }

    Write-Status "Local build ready. Root: $rootCode, app: $appCode, version: $versionCode."
    Write-Line ""
    Write-Line "Open $origin"
    Write-Line "This launcher never runs a build."
    Write-Line ""

    if ($SmokeTest) {
        Write-Status "Smoke test passed. Stopping the verification server."
        return
    }

    while ($previewProcess -and -not $previewProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    if ($previewProcess -and -not $previewProcess.HasExited) {
        Write-Status "Stopping the local build preview."
        Stop-ProcessTree $previewProcess.Id
    }
}
