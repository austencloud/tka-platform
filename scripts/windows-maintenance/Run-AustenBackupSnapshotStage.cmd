@echo off
setlocal

call "C:\ProgramData\AustenBackup\State\VShadowVars.cmd"
if errorlevel 1 exit /b 20

if not defined SHADOW_DEVICE_1 exit /b 21
if not defined SHADOW_ID_1 exit /b 22

"C:\Program Files\PowerShell\7\pwsh.exe" ^
  -NoLogo ^
  -NoProfile ^
  -NonInteractive ^
  -ExecutionPolicy Bypass ^
  -File "C:\ProgramData\AustenBackup\Scripts\Invoke-AustenBackupSnapshotStage.ps1"

exit /b %errorlevel%
