# Removes the PyMobileDevice3-Tunneld scheduled task and any running tunneld
# processes. Run from an elevated PowerShell window.

$ErrorActionPreference = "Continue"
$TaskName = "PyMobileDevice3-Tunneld"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task: $TaskName" -ForegroundColor Green
} else {
  Write-Host "No scheduled task named $TaskName was installed." -ForegroundColor Yellow
}

# Kill lingering tunneld python processes (includes SYSTEM-owned ones)
Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe' OR Name='cmd.exe'" |
  Where-Object { $_.CommandLine -match "pymobiledevice3.*tunneld" } |
  ForEach-Object {
    Write-Host "Stopping PID $($_.ProcessId) ($($_.Name))" -ForegroundColor Gray
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Write-Host "Done." -ForegroundColor Green
