#Requires -Version 5
<#
.SYNOPSIS
  Downloads just the agent-hub folder from GitHub and runs the installer.

.DESCRIPTION
  For machines that don't have (or don't want) a full clone of tka-platform,
  which is a couple of gigabytes. Pulls this folder over the GitHub contents
  API into %LOCALAPPDATA%\AgentHub\source, then hands off to install.ps1.

  One-liner:
    iwr -useb https://raw.githubusercontent.com/austencloud/tka-platform/main/agent-hub/bootstrap.ps1 | iex

.EXAMPLE
  # Projects live somewhere other than the default guess
  .\bootstrap.ps1 -ProjectsRoot C:\code

.EXAMPLE
  # Download only, don't install
  .\bootstrap.ps1 -NoInstall
#>
[CmdletBinding()]
param(
    [string]$Repo    = 'austencloud/tka-platform',
    [string]$Branch  = 'main',
    [string]$Dest    = (Join-Path $env:LOCALAPPDATA 'AgentHub\source'),
    # Passed straight through to install.ps1.
    [string]$ProjectsRoot,
    [switch]$NoAutoDiscover,
    [switch]$NoLaunchers,
    [switch]$NoStartup,
    [switch]$NoOpen,
    # Download the folder but skip running the installer.
    [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host ""
Write-Host "  Agent Hub bootstrap" -ForegroundColor White
Write-Host "  from  https://github.com/$Repo (branch $Branch)"
Write-Host "  into  $Dest"
Write-Host ""

$api  = "https://api.github.com/repos/$Repo/contents"
$hdrs = @{ 'User-Agent' = 'agent-hub-bootstrap'; 'Accept' = 'application/vnd.github+json' }
$count = 0

function Get-Folder([string]$RepoPath, [string]$LocalPath) {
    New-Item -ItemType Directory -Force $LocalPath | Out-Null
    $url = "$api/$RepoPath" + "?ref=$Branch"
    try {
        $items = Invoke-RestMethod -Uri $url -Headers $hdrs
    } catch {
        throw "Could not list $RepoPath on GitHub. $($_.Exception.Message)"
    }
    foreach ($item in $items) {
        $local = Join-Path $LocalPath $item.name
        if ($item.type -eq 'dir') {
            Get-Folder $item.path $local
        } elseif ($item.type -eq 'file') {
            Invoke-WebRequest -Uri $item.download_url -Headers $hdrs -OutFile $local -UseBasicParsing
            $script:count++
            Write-Host "    $($item.path)" -ForegroundColor DarkGray
        }
    }
}

Write-Host "==> Downloading" -ForegroundColor Cyan
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
Get-Folder 'agent-hub' $Dest
Write-Host "    $count file(s)" -ForegroundColor DarkGray

$installer = Join-Path $Dest 'install.ps1'
if (-not (Test-Path $installer)) { throw "install.ps1 missing after download - check the repo path." }

if ($NoInstall) {
    Write-Host ""
    Write-Host "  Downloaded to $Dest" -ForegroundColor Green
    Write-Host "  Run: powershell -ExecutionPolicy Bypass -File `"$installer`""
    Write-Host ""
    return
}

# Default the project root to the parent of the current directory's repo if we
# can find one, otherwise let install.ps1 fail loudly with its own message.
$passthru = @{}
if ($ProjectsRoot)  { $passthru['ProjectsRoot']   = $ProjectsRoot }
if ($NoAutoDiscover){ $passthru['NoAutoDiscover'] = $true }
if ($NoLaunchers)   { $passthru['NoLaunchers']    = $true }
if ($NoStartup)     { $passthru['NoStartup']      = $true }
if ($NoOpen)        { $passthru['NoOpen']         = $true }

# install.ps1 finds the project root itself (repo parent, else common layouts).
& $installer @passthru
