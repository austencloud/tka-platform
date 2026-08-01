#requires -Version 7.0

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [System.Security.Principal.WindowsPrincipal]::new($identity)
if ($identity.IsSystem -or $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Backup verification must run in Austen's normal unelevated session."
}

$expectedAccount = "$env:COMPUTERNAME\Austen"
if (-not $identity.Name.Equals($expectedAccount, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Backup verification must run as $expectedAccount."
}

$computerName = $env:COMPUTERNAME
$maintenanceRoot = 'C:\Users\Austen\Documents\PC Maintenance'
$logRoot = Join-Path $maintenanceRoot 'Logs'
$localBackupRoot = "F:\Automated Backups\$computerName"
$cloudStageRoot = "D:\_DOCUMENTS\Computer Backup\$computerName"
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$resultPath = Join-Path $logRoot "backup-verification-$timestamp.json"
$latestResultPath = Join-Path $logRoot 'latest-backup-verification.json'
$cloudResultPath = Join-Path $cloudStageRoot 'latest-backup-verification.json'

[System.IO.Directory]::CreateDirectory($logRoot) | Out-Null

function Test-BackupPair {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [string[]]$ExcludeRelativePrefixes = @()
    )

    $allSourceFiles = @(
        Get-ChildItem -LiteralPath $Source -File -Recurse -Force -ErrorAction Stop |
            Where-Object {
                $relativePath = $_.FullName.Substring($Source.Length).TrimStart('\')
                $excluded = $false
                foreach ($prefix in $ExcludeRelativePrefixes) {
                    if ($relativePath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                        $excluded = $true
                        break
                    }
                }
                -not $excluded
            }
    )

    $unsupported = @(
        $allSourceFiles | Where-Object {
            ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or
            ($_.Attributes -band [System.IO.FileAttributes]::Offline)
        }
    )
    $sourceFiles = @(
        $allSourceFiles | Where-Object {
            -not ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -and
            -not ($_.Attributes -band [System.IO.FileAttributes]::Offline)
        }
    )

    $missing = [System.Collections.Generic.List[string]]::new()
    $mismatched = [System.Collections.Generic.List[string]]::new()

    foreach ($sourceFile in $sourceFiles) {
        $relativePath = $sourceFile.FullName.Substring($Source.Length).TrimStart('\')
        $destinationFile = Join-Path $Destination $relativePath

        if (-not (Test-Path -LiteralPath $destinationFile -PathType Leaf)) {
            $missing.Add($relativePath)
            continue
        }

        $destinationItem = Get-Item -LiteralPath $destinationFile -Force
        if (($destinationItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or
            ($destinationItem.Attributes -band [System.IO.FileAttributes]::Offline)) {
            $mismatched.Add($relativePath)
            continue
        }
        if ($sourceFile.Length -ne $destinationItem.Length) {
            $mismatched.Add($relativePath)
            continue
        }

        $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash
        $destinationHash = (Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash
        if ($sourceHash -ne $destinationHash) {
            $mismatched.Add($relativePath)
        }
    }

    [pscustomobject]@{
        Source = $Source
        Destination = $Destination
        SourceFiles = $sourceFiles.Count
        UnsupportedSourceFiles = @($unsupported | ForEach-Object {
            $_.FullName.Substring($Source.Length).TrimStart('\')
        })
        MissingFiles = @($missing)
        MismatchedFiles = @($mismatched)
        Passed = $unsupported.Count -eq 0 -and $missing.Count -eq 0 -and $mismatched.Count -eq 0
    }
}

function Test-BackedPath {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination
    )

    $sourceExists = Test-Path -LiteralPath $Source -PathType Container
    $destinationExists = Test-Path -LiteralPath $Destination -PathType Container
    $destinationFiles = if ($destinationExists) {
        @(Get-ChildItem -LiteralPath $Destination -File -Recurse -Force -ErrorAction Stop).Count
    } else {
        0
    }

    [pscustomobject]@{
        Source = $Source
        Destination = $Destination
        Required = $sourceExists
        DestinationExists = $destinationExists
        DestinationFiles = $destinationFiles
        Passed = -not $sourceExists -or ($destinationExists -and $destinationFiles -gt 0)
    }
}

$pairDefinitions = @(
    @{ Source = 'D:\Videos\MatthiasBarker'; Destination = "$localBackupRoot\D\Videos\MatthiasBarker" },
    @{ Source = 'D:\Music\CircusPlaylist'; Destination = "$localBackupRoot\D\Music\CircusPlaylist" },
    @{ Source = 'D:\Downloads\_organized\Preserved Media'; Destination = "$localBackupRoot\D\Downloads\_organized\Preserved Media" },
    @{
        Source = 'C:\Users\Austen\Documents'
        Destination = "$localBackupRoot\C\User\Austen\Documents"
        ExcludeRelativePrefixes = @('PC Maintenance\Logs\')
    }
)

$pairResults = foreach ($definition in $pairDefinitions) {
    $excludeRelativePrefixes = if ($definition.ContainsKey('ExcludeRelativePrefixes')) {
        [string[]]$definition.ExcludeRelativePrefixes
    } else {
        @()
    }

    Test-BackupPair `
        -Source $definition.Source `
        -Destination $definition.Destination `
        -ExcludeRelativePrefixes $excludeRelativePrefixes
}

$agentDefinitions = @(
    @{ Source = 'C:\Users\Austen\.codex'; Destination = "$localBackupRoot\C\User\Austen\.codex" },
    @{ Source = 'C:\Users\Austen\.claude'; Destination = "$localBackupRoot\C\User\Austen\.claude" },
    @{ Source = 'C:\Users\Austen\AppData\Local\AgentHub'; Destination = "$localBackupRoot\C\User\Austen\AppData\Local\AgentHub" },
    @{ Source = 'C:\Users\Austen\AppData\Local\OpenAI'; Destination = "$localBackupRoot\C\User\Austen\AppData\Local\OpenAI" },
    @{ Source = 'C:\Users\Austen\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0'; Destination = "$localBackupRoot\C\User\Austen\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0" },
    @{ Source = 'C:\Users\Austen\AppData\Local\Packages\Claude_pzs8sxrjxfjjc'; Destination = "$localBackupRoot\C\User\Austen\AppData\Local\Packages\Claude_pzs8sxrjxfjjc" },
    @{ Source = 'C:\Users\Austen\AppData\Roaming\Claude'; Destination = "$localBackupRoot\C\User\Austen\AppData\Roaming\Claude" },
    @{ Source = 'C:\Users\Austen\AppData\Roaming\Claude Code'; Destination = "$localBackupRoot\C\User\Austen\AppData\Roaming\Claude Code" },
    @{ Source = 'C:\Users\Austen\AppData\Roaming\Code\User'; Destination = "$localBackupRoot\C\User\Austen\AppData\Roaming\Code\User" },
    @{ Source = 'C:\Users\Austen\AppData\Local\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState'; Destination = "$localBackupRoot\C\User\Austen\AppData\Local\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState" }
)
$agentResults = foreach ($definition in $agentDefinitions) {
    Test-BackedPath -Source $definition.Source -Destination $definition.Destination
}

$backupResultPath = Join-Path $localBackupRoot 'Manifests\latest-backup-result.json'
$backupResult = if (Test-Path -LiteralPath $backupResultPath -PathType Leaf) {
    Get-Content -LiteralPath $backupResultPath -Raw | ConvertFrom-Json
} else {
    $null
}

$profileManifest = Get-ChildItem `
    -LiteralPath (Join-Path $localBackupRoot 'Manifests') `
    -File `
    -Filter 'profile-snapshot-*.json' `
    -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1

$hiveResults = @()
if ($null -ne $profileManifest) {
    $profileResult = Get-Content -LiteralPath $profileManifest.FullName -Raw | ConvertFrom-Json
    $hiveResults = @(
        foreach ($hive in $profileResult.HiveChecks) {
            $destination = Join-Path "$localBackupRoot\C\User\Austen" $hive.Name
            $exists = Test-Path -LiteralPath $destination -PathType Leaf
            $hash = if ($exists) { (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash } else { $null }
            [pscustomobject]@{
                Name = $hive.Name
                Exists = $exists
                ExpectedSHA256 = $hive.SHA256
                ActualSHA256 = $hash
                Passed = $exists -and $hash -eq $hive.SHA256
            }
        }
    )
}

$manifestChecks = foreach ($name in @('cross-device-placeholders.csv', 'icloud-photos-placeholders.csv')) {
    $path = Join-Path $localBackupRoot "Manifests\$name"
    $exists = Test-Path -LiteralPath $path -PathType Leaf
    $rows = if ($exists) { @(Import-Csv -LiteralPath $path).Count } else { 0 }
    [pscustomobject]@{
        Name = $name
        Exists = $exists
        Rows = $rows
        Passed = $exists -and $rows -gt 0
    }
}

$workingStateRoot = Join-Path $localBackupRoot "D\_DOCUMENTS\Computer Backup\$computerName\Development\TKA Working State"
$latestWorkingState = Get-ChildItem -LiteralPath $workingStateRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1
$workingStateCheck = if ($null -ne $latestWorkingState) {
    $prepPath = Join-Path $latestWorkingState.FullName 'prep-result.json'
    $bundlePath = Join-Path $latestWorkingState.FullName 'tka-platform.bundle'
    $prepPassed = if (Test-Path -LiteralPath $prepPath) {
        [bool]((Get-Content -LiteralPath $prepPath -Raw | ConvertFrom-Json).Passed)
    } else {
        $false
    }
    [pscustomobject]@{
        Snapshot = $latestWorkingState.Name
        PrepPassed = $prepPassed
        BundleExists = Test-Path -LiteralPath $bundlePath -PathType Leaf
        BundleBytes = if (Test-Path -LiteralPath $bundlePath -PathType Leaf) { (Get-Item -LiteralPath $bundlePath).Length } else { 0 }
        Passed = $prepPassed -and (Test-Path -LiteralPath $bundlePath -PathType Leaf) -and (Get-Item -LiteralPath $bundlePath).Length -gt 0
    }
} else {
    [pscustomobject]@{
        Snapshot = $null
        PrepPassed = $false
        BundleExists = $false
        BundleBytes = 0
        Passed = $false
    }
}

$driveDatabase = 'C:\Users\Austen\AppData\Local\Google\DriveFS\105882458849295229143\mirror_sqlite.db'
$sqlitePath = 'C:\Android\platform-tools\sqlite3.exe'
$cloudResult = [ordered]@{
    Available = $false
    QueueDepth = $null
    MatthiasFileCount = $null
    MatthiasMismatches = $null
    Passed = $false
}

if ((Test-Path -LiteralPath $driveDatabase) -and (Test-Path -LiteralPath $sqlitePath)) {
    $cloudResult.Available = $true
    $queueSql = 'select (select count(*) from pending_uploads) + (select count(*) from queued_uploads);'
    $cloudResult.QueueDepth = [int](& $sqlitePath -readonly $driveDatabase $queueSql)

    $matthiasSql = @"
WITH RECURSIVE paths(local_stable_id,path) AS (
  SELECT local_stable_id, local_filename FROM mirror_item WHERE is_root=1
  UNION ALL
  SELECT m.local_stable_id, paths.path || '/' || m.local_filename
  FROM mirror_item m JOIN paths ON m.parent_local_stable_id=paths.local_stable_id
)
SELECT
  sum(CASE WHEN m.local_type=1 THEN 1 ELSE 0 END),
  sum(CASE WHEN m.local_type=1 AND (
    m.local_size != m.cloud_size OR
    m.local_md5_checksum != m.cloud_md5_checksum
  ) THEN 1 ELSE 0 END)
FROM paths p
JOIN mirror_item m USING(local_stable_id)
WHERE p.path LIKE 'F:/Videos/MatthiasBarker/%';
"@

    $matthiasValues = (& $sqlitePath -readonly -separator '|' $driveDatabase $matthiasSql) -split '\|'
    $cloudResult.MatthiasFileCount = [int]$matthiasValues[0]
    $cloudResult.MatthiasMismatches = [int]$matthiasValues[1]
    $cloudResult.Passed = $cloudResult.MatthiasFileCount -eq 20 -and $cloudResult.MatthiasMismatches -eq 0
}

$repositoryBackupPassed = (
    (Test-Path -LiteralPath "$localBackupRoot\E\tka-platform\.git\HEAD" -PathType Leaf) -and
    (Test-Path -LiteralPath "$localBackupRoot\E\tka-platform\src" -PathType Container)
)

$backupResultPassed = $null -ne $backupResult -and [bool]$backupResult.Passed
$snapshotCopyVerificationPassed = (
    $backupResultPassed -and
    @($backupResult.SnapshotStage.CopyResults | Where-Object { -not $_.Skipped -and -not $_.VerificationPassed }).Count -eq 0
)
$stableCopyVerificationPassed = (
    $backupResultPassed -and
    @($backupResult.CopyResults | Where-Object {
        $_.Source -ne 'E:\tka-platform' -and -not $_.Skipped -and -not $_.VerificationPassed
    }).Count -eq 0
)

$passed = (
    @($pairResults | Where-Object { -not $_.Passed }).Count -eq 0 -and
    @($agentResults | Where-Object { -not $_.Passed }).Count -eq 0 -and
    @($hiveResults | Where-Object { -not $_.Passed }).Count -eq 0 -and
    $hiveResults.Count -gt 0 -and
    @($manifestChecks | Where-Object { -not $_.Passed }).Count -eq 0 -and
    $workingStateCheck.Passed -and
    $cloudResult.Passed -and
    $repositoryBackupPassed -and
    $backupResultPassed -and
    $snapshotCopyVerificationPassed -and
    $stableCopyVerificationPassed
)

$result = [ordered]@{
    Timestamp = (Get-Date).ToString('o')
    Computer = $computerName
    BackupRunId = if ($null -ne $backupResult) { $backupResult.RunId } else { $null }
    LocalPairs = @($pairResults)
    AgentState = @($agentResults)
    HiveChecks = @($hiveResults)
    Manifests = @($manifestChecks)
    WorkingState = $workingStateCheck
    Cloud = $cloudResult
    RepositoryBackupPassed = $repositoryBackupPassed
    BackupResultPassed = $backupResultPassed
    SnapshotCopyVerificationPassed = $snapshotCopyVerificationPassed
    StableCopyVerificationPassed = $stableCopyVerificationPassed
    Passed = $passed
}

$json = $result | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($resultPath, $json, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($latestResultPath, $json, [System.Text.UTF8Encoding]::new($false))
[System.IO.Directory]::CreateDirectory($cloudStageRoot) | Out-Null
[System.IO.File]::WriteAllText($cloudResultPath, $json, [System.Text.UTF8Encoding]::new($false))

$json
if (-not $result.Passed) {
    exit 1
}
