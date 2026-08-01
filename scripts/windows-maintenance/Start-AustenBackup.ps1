#requires -Version 7.0

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$prepScript = 'C:\ProgramData\AustenBackup\Scripts\Invoke-AustenBackupPrep.ps1'
$pwshPath = 'C:\Program Files\PowerShell\7\pwsh.exe'
$taskName = 'Austen Daily Backup'

& $pwshPath `
    -NoLogo `
    -NoProfile `
    -NonInteractive `
    -ExecutionPolicy Bypass `
    -File $prepScript
$prepExitCode = $LASTEXITCODE

if ($prepExitCode -ne 0) {
    throw "Cloud and Git backup preparation failed with exit code $prepExitCode. The protected backup was not started."
}

& "$env:SystemRoot\System32\schtasks.exe" /Run /TN $taskName
if ($LASTEXITCODE -ne 0) {
    throw "Task Scheduler could not start $taskName."
}

Write-Output "Started $taskName after cloud and Git preparation completed."
