# Run ONCE in an ADMIN PowerShell. Registers a logon task that re-applies the
# RTX 4090 300W power cap on every boot (the cap otherwise resets to 450W).
# Rationale: caps transient power spikes during heavy GPU work (local LLM inference)
# to stay clear of the PSU rail — relevant given the recurring Kernel-Power 41 crashes.

$nvsmi = "C:\Windows\System32\nvidia-smi.exe"
if (-not (Test-Path $nvsmi)) { $nvsmi = (Get-Command nvidia-smi).Source }

$action  = New-ScheduledTaskAction -Execute $nvsmi -Argument "-pl 300"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "GPU-PowerLimit-300W" -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force

Write-Host "Registered 'GPU-PowerLimit-300W'. Applying now..."
& $nvsmi -pl 300
Write-Host "Current limit: $(& $nvsmi --query-gpu=power.limit --format=csv,noheader)"
