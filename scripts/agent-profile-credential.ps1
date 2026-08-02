[CmdletBinding()]
param(
  [ValidateSet("Provision", "CopyEmail", "CopyPassword", "ClearClipboard", "Status")]
  [string]$Action = "Provision",
  [switch]$RotatePassword
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$credentialDirectory = Join-Path $env:USERPROFILE ".tka"
$credentialPath = Join-Path $credentialDirectory "agent-profile.credential.json"
$tsxPath = Join-Path $repoRoot "node_modules\.bin\tsx.cmd"
$expectedEmail = "codex-claude@agents.invalid"

function Read-StoredCredential {
  if (-not (Test-Path -LiteralPath $credentialPath)) {
    throw "No encrypted agent credential exists. Run this script with -Action Provision."
  }

  $credential = Get-Content -Raw -LiteralPath $credentialPath | ConvertFrom-Json
  if (
    $credential.version -ne 1 -or
    $credential.email -ne $expectedEmail -or
    [string]::IsNullOrWhiteSpace($credential.protectedPassword)
  ) {
    throw "The encrypted agent credential has an unexpected format."
  }
  return $credential
}

function Convert-ProtectedPasswordToPlainText([string]$protectedPassword) {
  $securePassword = ConvertTo-SecureString -String $protectedPassword
  $networkCredential = [System.Net.NetworkCredential]::new("", $securePassword)
  return $networkCredential.Password
}

function New-AgentPassword {
  $bytes = [byte[]]::new(32)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }

  $base = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
  return "Aa1!$base"
}

function Protect-Password([string]$password) {
  $securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force
  return ConvertFrom-SecureString -SecureString $securePassword
}

function Write-CredentialFile([pscustomobject]$result, [string]$password) {
  New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
  $record = [ordered]@{
    version = 1
    uid = $result.uid
    email = $result.email
    displayName = $result.displayName
    username = $result.username
    protectedPassword = Protect-Password $password
    updatedAt = [DateTimeOffset]::UtcNow.ToString("O")
  }
  $record | ConvertTo-Json | Set-Content -LiteralPath $credentialPath -Encoding utf8
}

switch ($Action) {
  "Provision" {
    if (-not (Test-Path -LiteralPath $tsxPath)) {
      throw "tsx is unavailable at $tsxPath. Restore workspace dependencies before provisioning."
    }

    $hasStoredCredential = Test-Path -LiteralPath $credentialPath
    $password = if ($hasStoredCredential -and -not $RotatePassword) {
      $stored = Read-StoredCredential
      Convert-ProtectedPasswordToPlainText $stored.protectedPassword
    } else {
      New-AgentPassword
    }
    $shouldRotate = $RotatePassword -or -not $hasStoredCredential
    $payload = @{
      password = $password
      rotatePassword = $shouldRotate
    } | ConvertTo-Json -Compress

    Push-Location $repoRoot
    try {
      $nodeOutput = $payload | & $tsxPath "scripts/provision-agent-profile.ts"
      if ($LASTEXITCODE -ne 0) {
        throw "Firebase provisioning exited with code $LASTEXITCODE."
      }
    } finally {
      Pop-Location
    }

    $result = ($nodeOutput -join "`n") | ConvertFrom-Json
    if ($result.ok -ne $true) {
      throw "Firebase provisioning did not report success."
    }
    Write-CredentialFile $result $password
    $password = $null

    [pscustomobject]@{
      Status = "Provisioned"
      Created = $result.created
      PasswordRotated = $result.passwordRotated
      Uid = $result.uid
      Email = $result.email
      DisplayName = $result.displayName
      Username = $result.username
      AuthEnabled = $result.verification.authEnabled
      EmailVerified = $result.verification.emailVerified
      Role = $result.verification.role
      Admin = $result.verification.adminClaim
      PublicProfileSafe = $result.verification.publicProfileSafe
      HiddenFromCreatorListings = $result.verification.hiddenFromCreatorListings
      PrivateTestMetadata = $result.verification.privateTestMetadata
      UsernameOwned = $result.verification.usernameOwned
      CredentialStore = $credentialPath
    }
  }
  "CopyEmail" {
    $credential = Read-StoredCredential
    Set-Clipboard -Value $credential.email
    Write-Output "Copied the agent email to the clipboard."
  }
  "CopyPassword" {
    $credential = Read-StoredCredential
    $password = Convert-ProtectedPasswordToPlainText $credential.protectedPassword
    Set-Clipboard -Value $password
    $password = $null
    Write-Output "Copied the agent password to the clipboard."
  }
  "ClearClipboard" {
    Set-Clipboard -Value ""
    Write-Output "Cleared the clipboard."
  }
  "Status" {
    $credential = Read-StoredCredential
    [pscustomobject]@{
      Status = "Encrypted credential available"
      Uid = $credential.uid
      Email = $credential.email
      DisplayName = $credential.displayName
      Username = $credential.username
      UpdatedAt = $credential.updatedAt
      CredentialStore = $credentialPath
    }
  }
}
