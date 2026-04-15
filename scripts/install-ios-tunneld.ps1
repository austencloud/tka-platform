# Installs a Windows Scheduled Task that auto-starts pymobiledevice3 tunneld
# at every login with full admin privileges and no UAC prompts.
#
# The task is registered with LogonType Password. Windows stores the password
# encrypted in its LSA secret store and uses it to log the user in for the
# task with the full unfiltered admin token. Same mechanism used by iMazing.
#
# Footgun: if you change your Windows password, re-run this installer.
#
# Run ONCE, from an elevated PowerShell window:
#   powershell -ExecutionPolicy Bypass -File E:\tka-platform\scripts\install-ios-tunneld.ps1

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "This script must be run as Administrator." -ForegroundColor Red
  exit 1
}

$TaskName = "PyMobileDevice3-Tunneld"
$LogDir = "C:\ProgramData\pymobiledevice3"
$LogFile = Join-Path $LogDir "tunneld.log"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$acl = Get-Acl $LogDir
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  "Users", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl -Path $LogDir -AclObject $acl

$PythonExe = $null
foreach ($p in @(
  "C:\Python313\python.exe", "C:\Python312\python.exe", "C:\Python311\python.exe",
  "C:\Program Files\Python313\python.exe", "C:\Program Files\Python312\python.exe"
)) { if (Test-Path $p) { $PythonExe = $p; break } }
if (-not $PythonExe) {
  Write-Host "Could not locate a system Python install." -ForegroundColor Red
  exit 1
}
Write-Host "Using Python: $PythonExe" -ForegroundColor Gray

$fullUser = "$env:USERDOMAIN\$env:USERNAME"
Write-Host ""
Write-Host "Enter your Windows password for account: $fullUser" -ForegroundColor Yellow
Write-Host "(Stored encrypted in Windows LSA secret store, never in plain text)" -ForegroundColor DarkGray
$cred = Get-Credential -UserName $fullUser -Message "Enter Windows password for $fullUser"
if (-not $cred) {
  Write-Host "Cancelled." -ForegroundColor Red
  exit 1
}
$plainPassword = $cred.GetNetworkCredential().Password

$CmdLine = "/c `"$PythonExe`" -m pymobiledevice3 remote tunneld >> `"$LogFile`" 2>&1"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed existing task." -ForegroundColor Gray
}

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $CmdLine
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $fullUser
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -Hidden `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -User $fullUser `
  -Password $plainPassword `
  -RunLevel Highest `
  -Description "pymobiledevice3 tunnel daemon for iOS 17+ developer services" | Out-Null

$plainPassword = $null
[GC]::Collect()

Write-Host "Task registered. Runs at every login with full admin rights." -ForegroundColor Green

Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe' OR Name='cmd.exe'" |
  Where-Object { $_.CommandLine -match "pymobiledevice3.*tunneld" } |
  ForEach-Object {
    Write-Host "Killing straggler PID $($_.ProcessId)" -ForegroundColor Gray
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Write-Host ""
Write-Host "Starting task now..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

$info = Get-ScheduledTaskInfo -TaskName $TaskName
$resultCode = $info.LastTaskResult
Write-Host "LastTaskResult code: $resultCode" -ForegroundColor Gray
Write-Host "(0 means success, 267009 means still running)" -ForegroundColor DarkGray

$tunneld = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -match "pymobiledevice3.*tunneld" } |
  Select-Object -First 1

if ($tunneld) {
  Write-Host ""
  Write-Host "tunneld is running (PID $($tunneld.ProcessId))." -ForegroundColor Green
  Write-Host "Test with: node E:\tka-platform\scripts\capture-devices.cjs" -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "tunneld did not start. Log tail:" -ForegroundColor Red
  if (Test-Path $LogFile) {
    Get-Content $LogFile -Tail 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
  } else {
    Write-Host "  no log produced. Check password was correct." -ForegroundColor DarkGray
  }
}
