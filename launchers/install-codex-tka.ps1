<#
    Builds TKA's status-meter patch against the exact Codex release used here.
    The resulting executable lives beside the official installation and shares
    its login, config, plugins, and update state.
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$SourceBuild
)

$ErrorActionPreference = 'Stop'
$CodexVersion = '0.144.6'
$UpstreamCommit = '5d1fbf26c43abc65a203928b2e31561cb039e06d'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$PatchPath = Join-Path $RepoRoot 'patches\codex-tka-status-bars.patch'
$TkaRoot = Join-Path $env:LOCALAPPDATA 'TKA\codex-tka'
$SourceRoot = Join-Path $TkaRoot "source\$CodexVersion"
$TargetRoot = Join-Path $TkaRoot "target\$CodexVersion"
$BinRoot = Join-Path $TkaRoot 'bin'
$InstalledExe = Join-Path $BinRoot 'codex-tka.exe'
$MetadataPath = Join-Path $BinRoot 'codex-tka.json'
$ReleaseTag = "codex-tka-v$CodexVersion"
$ReleaseBaseUrl = "https://github.com/austencloud/tka-platform/releases/download/$ReleaseTag"

function Assert-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $InstallHint"
    }
}

function Invoke-Native([scriptblock]$Command, [string]$Description) {
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

if (-not (Test-Path -LiteralPath $PatchPath)) {
    throw "Missing renderer patch: $PatchPath"
}

$patchHash = (Get-FileHash -LiteralPath $PatchPath -Algorithm SHA256).Hash
if (-not $Force -and (Test-Path -LiteralPath $InstalledExe) -and (Test-Path -LiteralPath $MetadataPath)) {
    $metadata = Get-Content -Raw -LiteralPath $MetadataPath | ConvertFrom-Json
    if ($metadata.upstreamCommit -eq $UpstreamCommit -and $metadata.patchSha256 -eq $patchHash) {
        Write-Host "Codex TKA $CodexVersion is current: $InstalledExe"
        return
    }
}

New-Item -ItemType Directory -Force -Path $BinRoot | Out-Null

if (-not $SourceBuild) {
    $downloadRoot = Join-Path ([IO.Path]::GetTempPath()) ("codex-tka-" + [guid]::NewGuid().ToString('N'))
    try {
        New-Item -ItemType Directory -Path $downloadRoot | Out-Null
        $archivePath = Join-Path $downloadRoot 'codex-tka-windows-x64.zip'
        $checksumPath = "$archivePath.sha256"
        Write-Host "Checking GitHub for $ReleaseTag..."
        Invoke-WebRequest -UseBasicParsing -Uri "$ReleaseBaseUrl/codex-tka-windows-x64.zip" -OutFile $archivePath
        Invoke-WebRequest -UseBasicParsing -Uri "$ReleaseBaseUrl/codex-tka-windows-x64.zip.sha256" -OutFile $checksumPath
        $expectedArchiveHash = ((Get-Content -Raw -LiteralPath $checksumPath).Trim() -split '\s+')[0]
        $actualArchiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
        if ($actualArchiveHash -ne $expectedArchiveHash) {
            throw "Release checksum mismatch: expected $expectedArchiveHash, got $actualArchiveHash"
        }
        Expand-Archive -LiteralPath $archivePath -DestinationPath $downloadRoot -Force
        $downloadedExe = Join-Path $downloadRoot 'codex-tka.exe'
        $downloadedMetadata = Join-Path $downloadRoot 'codex-tka.json'
        if (-not (Test-Path -LiteralPath $downloadedExe)) { throw 'Release archive contains no codex-tka.exe.' }
        Copy-Item -LiteralPath $downloadedExe -Destination $InstalledExe -Force
        if (Test-Path -LiteralPath $downloadedMetadata) {
            Copy-Item -LiteralPath $downloadedMetadata -Destination $MetadataPath -Force
        }
        Invoke-Native { & $InstalledExe --version } 'Downloaded Codex TKA smoke test'
        Write-Host "Installed GitHub release: $InstalledExe"
        return
    } catch {
        Write-Warning "No usable $ReleaseTag asset was found; building from pinned source. $($_.Exception.Message)"
    } finally {
        $resolvedTemp = [IO.Path]::GetFullPath($downloadRoot)
        if ($resolvedTemp.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Assert-Command 'git.exe' 'Install Git for Windows, then reopen the terminal.'
Assert-Command 'rustup.exe' 'Install rustup from https://rustup.rs, then reopen the terminal.'
Assert-Command 'cargo.exe' 'Install the Rust MSVC toolchain through rustup.'

New-Item -ItemType Directory -Force -Path (Split-Path $SourceRoot), $TargetRoot, $BinRoot | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot '.git'))) {
    if (Test-Path -LiteralPath $SourceRoot) {
        throw "Refusing to replace unexpected path: $SourceRoot"
    }
    Write-Host "Cloning OpenAI Codex $CodexVersion..."
    Invoke-Native { git clone --filter=blob:none --no-checkout https://github.com/openai/codex.git $SourceRoot } 'Codex clone'
    Invoke-Native { git -C $SourceRoot sparse-checkout set codex-rs } 'Sparse checkout setup'
    Invoke-Native { git -C $SourceRoot checkout --detach $UpstreamCommit } 'Pinned Codex checkout'
}

$actualCommit = (& git -C $SourceRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actualCommit -ne $UpstreamCommit) {
    throw "Source checkout is $actualCommit; expected $UpstreamCommit. Remove only $SourceRoot and rerun."
}

& git -C $SourceRoot apply --reverse --check $PatchPath 2>$null
$alreadyPatched = $LASTEXITCODE -eq 0
if (-not $alreadyPatched) {
    Invoke-Native { git -C $SourceRoot apply --check $PatchPath } 'Renderer patch validation'
    Invoke-Native { git -C $SourceRoot apply $PatchPath } 'Renderer patch application'
}

$toolchainFile = Join-Path $SourceRoot 'codex-rs\rust-toolchain.toml'
$toolchainText = Get-Content -Raw -LiteralPath $toolchainFile
$toolchain = [regex]::Match($toolchainText, '(?m)^channel\s*=\s*"([^"]+)"').Groups[1].Value
if (-not $toolchain) { throw "Could not read the pinned Rust channel from $toolchainFile" }

Write-Host "Ensuring Rust $toolchain has its build components..."
Invoke-Native { rustup toolchain install $toolchain --profile minimal --component cargo,rustfmt } 'Pinned Rust toolchain install'

$env:CARGO_TARGET_DIR = $TargetRoot
$cargoRoot = Join-Path $SourceRoot 'codex-rs'
Push-Location $cargoRoot
try {
    # Entering codex-rs makes rustup honor the release's rust-toolchain.toml.
    Write-Host 'Testing the patched status renderer...'
    Invoke-Native { cargo test -p codex-tui status_line_style } 'Status renderer tests'

    Write-Host 'Building codex-tka.exe...'
    Invoke-Native { cargo build --release -p codex-cli --bin codex } 'Codex TKA release build'
} finally {
    Pop-Location
}

$builtExe = Join-Path $TargetRoot 'release\codex.exe'
if (-not (Test-Path -LiteralPath $builtExe)) { throw "Build completed without producing $builtExe" }
Copy-Item -LiteralPath $builtExe -Destination $InstalledExe -Force

$metadata = [ordered]@{
    codexVersion = $CodexVersion
    upstreamCommit = $UpstreamCommit
    patchSha256 = $patchHash
    executableSha256 = (Get-FileHash -LiteralPath $InstalledExe -Algorithm SHA256).Hash
    installedAt = [DateTimeOffset]::Now.ToString('o')
}
$metadata | ConvertTo-Json | Set-Content -LiteralPath $MetadataPath -Encoding utf8

Invoke-Native { & $InstalledExe --version } 'Installed Codex TKA smoke test'
Write-Host "Installed: $InstalledExe"
