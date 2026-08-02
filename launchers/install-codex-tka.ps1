<#
    Builds TKA's Codex patch against the exact release used here.
    The resulting executable lives beside the official installation and shares
    its login, config, plugins, and update state.
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$SourceBuild,
    [switch]$DevelopmentBuild,
    [switch]$SkipTests,
    [switch]$InstallBuiltArtifact
)

$ErrorActionPreference = 'Stop'
$CodexVersion = '0.146.0'
$UpstreamCommit = 'e363b08c9175ac1cbe5893615dd2cb9ddf95043b'
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
$BuildProfile = if ($DevelopmentBuild) { 'dev' } else { 'release' }
$BuiltExeRelativePath = if ($DevelopmentBuild) { 'debug\codex.exe' } else { 'release\codex.exe' }
$CargoTestProfileArgs = if ($DevelopmentBuild) { @() } else { @('--release') }

# Agent Hub can inherit a PATH captured before rustup was installed. Rustup's
# standard per-user bin directory remains authoritative in that case.
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (
    (Test-Path -LiteralPath (Join-Path $CargoBin 'rustup.exe')) -and
    (Test-Path -LiteralPath (Join-Path $CargoBin 'cargo.exe')) -and
    (($env:PATH -split ';') -notcontains $CargoBin)
) {
    $env:PATH = "$CargoBin;$env:PATH"
}

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

function Get-FileSha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '')
    } finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Install-CodexExecutable([string]$SourcePath, [string]$DestinationPath) {
    $destinationRoot = Split-Path $DestinationPath
    $destinationName = Split-Path $DestinationPath -Leaf
    $destinationBase = [IO.Path]::GetFileNameWithoutExtension($destinationName)
    $destinationExtension = [IO.Path]::GetExtension($destinationName)
    $stagedPath = Join-Path $destinationRoot "$destinationBase.next$destinationExtension"

    Copy-Item -LiteralPath $SourcePath -Destination $stagedPath -Force
    $sourceHash = Get-FileSha256 $SourcePath
    $stagedHash = Get-FileSha256 $stagedPath
    if ($sourceHash -ne $stagedHash) {
        throw "Staged executable checksum mismatch: expected $sourceHash, got $stagedHash"
    }

    $backupPath = $null
    if (Test-Path -LiteralPath $DestinationPath) {
        try {
            Copy-Item -LiteralPath $stagedPath -Destination $DestinationPath -Force -ErrorAction Stop
            Remove-Item -LiteralPath $stagedPath -Force
        } catch [System.IO.IOException] {
            $currentHash = Get-FileSha256 $DestinationPath
            $backupName = "$destinationBase.previous-$($currentHash.Substring(0, 12))-$PID$destinationExtension"
            $backupPath = Join-Path $destinationRoot $backupName
            if (Test-Path -LiteralPath $backupPath) {
                throw "Refusing to replace existing backup: $backupPath"
            }

            Rename-Item -LiteralPath $DestinationPath -NewName $backupName
            try {
                Rename-Item -LiteralPath $stagedPath -NewName $destinationName
            } catch {
                Rename-Item -LiteralPath $backupPath -NewName $destinationName -ErrorAction SilentlyContinue
                throw
            }
        }
    } else {
        Rename-Item -LiteralPath $stagedPath -NewName $destinationName
    }

    $installedHash = Get-FileSha256 $DestinationPath
    if ($sourceHash -ne $installedHash) {
        throw "Installed executable checksum mismatch: expected $sourceHash, got $installedHash"
    }
    if ($backupPath) {
        Write-Host "Kept the in-use executable at $backupPath; running sessions can finish normally."
    }
}

function Install-BuiltCodexExecutable([string]$BuiltExePath) {
    if (-not (Test-Path -LiteralPath $BuiltExePath)) {
        throw "Build completed without producing $BuiltExePath"
    }
    Install-CodexExecutable $BuiltExePath $InstalledExe

    $metadata = [ordered]@{
        codexVersion = $CodexVersion
        upstreamCommit = $UpstreamCommit
        patchSha256 = $patchHash
        buildProfile = $BuildProfile
        executableSha256 = Get-FileSha256 $InstalledExe
        installedAt = [DateTimeOffset]::Now.ToString('o')
    }
    $metadata | ConvertTo-Json | Set-Content -LiteralPath $MetadataPath -Encoding utf8

    Invoke-Native { & $InstalledExe --version } 'Installed Codex TKA smoke test'
    Write-Host "Installed: $InstalledExe"
}

if (-not (Test-Path -LiteralPath $PatchPath)) {
    throw "Missing Codex TKA patch: $PatchPath"
}

$patchHash = Get-FileSha256 $PatchPath
$currentDevelopmentBuild = $false
if (-not $Force -and (Test-Path -LiteralPath $InstalledExe) -and (Test-Path -LiteralPath $MetadataPath)) {
    $metadata = Get-Content -Raw -LiteralPath $MetadataPath | ConvertFrom-Json
    $installedHash = Get-FileSha256 $InstalledExe
    $installedProfile = if ($metadata.PSObject.Properties.Name -contains 'buildProfile') {
        $metadata.buildProfile
    } else {
        'release'
    }
    $requestedProfileMatches = (
        (-not $SourceBuild -and -not $DevelopmentBuild -and -not $InstallBuiltArtifact) -or
        $installedProfile -eq $BuildProfile
    )
    if (
        $metadata.upstreamCommit -eq $UpstreamCommit -and
        $metadata.patchSha256 -eq $patchHash -and
        $metadata.executableSha256 -eq $installedHash -and
        $requestedProfileMatches
    ) {
        if (
            $installedProfile -eq 'dev' -and
            -not $SourceBuild -and
            -not $DevelopmentBuild -and
            -not $InstallBuiltArtifact
        ) {
            $currentDevelopmentBuild = $true
            Write-Host "Codex TKA $CodexVersion is current (dev); checking for the production asset..."
        } else {
            Write-Host "Codex TKA $CodexVersion is current ($installedProfile): $InstalledExe"
            return
        }
    }
}

New-Item -ItemType Directory -Force -Path $BinRoot | Out-Null

if ($InstallBuiltArtifact) {
    Install-BuiltCodexExecutable (Join-Path $TargetRoot $BuiltExeRelativePath)
    return
}

if (-not $SourceBuild -and -not $DevelopmentBuild) {
    $downloadRoot = Join-Path ([IO.Path]::GetTempPath()) ("codex-tka-" + [guid]::NewGuid().ToString('N'))
    try {
        New-Item -ItemType Directory -Path $downloadRoot | Out-Null
        $archivePath = Join-Path $downloadRoot 'codex-tka-windows-x64.zip'
        $checksumPath = "$archivePath.sha256"
        Write-Host "Checking GitHub for $ReleaseTag..."
        Invoke-WebRequest -UseBasicParsing -Uri "$ReleaseBaseUrl/codex-tka-windows-x64.zip" -OutFile $archivePath
        Invoke-WebRequest -UseBasicParsing -Uri "$ReleaseBaseUrl/codex-tka-windows-x64.zip.sha256" -OutFile $checksumPath
        $expectedArchiveHash = ((Get-Content -Raw -LiteralPath $checksumPath).Trim() -split '\s+')[0]
        $actualArchiveHash = Get-FileSha256 $archivePath
        if ($actualArchiveHash -ne $expectedArchiveHash) {
            throw "Release checksum mismatch: expected $expectedArchiveHash, got $actualArchiveHash"
        }
        Expand-Archive -LiteralPath $archivePath -DestinationPath $downloadRoot -Force
        $downloadedExe = Join-Path $downloadRoot 'codex-tka.exe'
        $downloadedMetadata = Join-Path $downloadRoot 'codex-tka.json'
        if (-not (Test-Path -LiteralPath $downloadedExe)) { throw 'Release archive contains no codex-tka.exe.' }
        if (-not (Test-Path -LiteralPath $downloadedMetadata)) { throw 'Release archive contains no codex-tka.json.' }
        $releaseMetadata = Get-Content -Raw -LiteralPath $downloadedMetadata | ConvertFrom-Json
        if ($releaseMetadata.upstreamCommit -ne $UpstreamCommit -or $releaseMetadata.patchSha256 -ne $patchHash) {
            throw 'Release asset was built from a different upstream commit or patch.'
        }
        $downloadedExecutableHash = Get-FileSha256 $downloadedExe
        if ($releaseMetadata.executableSha256 -ne $downloadedExecutableHash) {
            throw 'Release executable does not match its metadata checksum.'
        }
        Install-CodexExecutable $downloadedExe $InstalledExe
        Copy-Item -LiteralPath $downloadedMetadata -Destination $MetadataPath -Force
        Invoke-Native { & $InstalledExe --version } 'Downloaded Codex TKA smoke test'
        Write-Host "Installed GitHub release: $InstalledExe"
        return
    } catch {
        if ($currentDevelopmentBuild) {
            Write-Warning "The $ReleaseTag production asset is not available yet; keeping the current development build. $($_.Exception.Message)"
            return
        }
        Write-Warning "No usable $ReleaseTag asset was found; building the incremental development executable locally. $($_.Exception.Message)"
        $DevelopmentBuild = $true
        $BuildProfile = 'dev'
        $BuiltExeRelativePath = 'debug\codex.exe'
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
    Invoke-Native { git -C $SourceRoot apply --check $PatchPath } 'Codex TKA patch validation'
    Invoke-Native { git -C $SourceRoot apply $PatchPath } 'Codex TKA patch application'
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
    if (-not $SkipTests) {
        Write-Host 'Testing lossless MCP startup status delivery...'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-app-server --lib guaranteed_delivery_helpers_cover_terminal_server_notifications } 'App-server MCP status delivery tests'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-app-server-client --lib forward_in_process_event_preserves_mcp_status_under_backpressure } 'App-server client MCP backpressure tests'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-tui --lib app_server_lag_does_not_interrupt_mcp_startup } 'TUI MCP startup lag tests'

        Write-Host 'Testing the patched status renderer...'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-tui --lib status_line_style } 'Status renderer tests'

        Write-Host 'Testing manual terminal titles...'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-tui --lib terminal_title } 'Terminal title tests'

        Write-Host 'Testing generated and explicit renames...'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-tui --lib thread_name_generation } 'Generated rename tests'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-tui --lib rename } 'Rename interaction tests'

        Write-Host 'Testing direct skill slash commands...'
        Invoke-Native { cargo test @CargoTestProfileArgs -p codex-tui --lib skill_slash } 'Skill slash command tests'
    }

    if ($DevelopmentBuild) {
        Write-Host 'Building the incremental Codex TKA development executable...'
        Invoke-Native { cargo build -p codex-cli --bin codex } 'Codex TKA development build'
    } else {
        Write-Host 'Building the production Codex TKA executable...'
        Invoke-Native { cargo build --release -p codex-cli --bin codex } 'Codex TKA release build'
    }
} finally {
    Pop-Location
}

$builtExe = Join-Path $TargetRoot $BuiltExeRelativePath
Install-BuiltCodexExecutable $builtExe
