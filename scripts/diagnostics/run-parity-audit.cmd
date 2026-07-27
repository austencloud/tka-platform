@echo off
rem Daily read-only parity audit (parity-repair spec, phase 5).
rem Registered in Windows Task Scheduler as "TKA Parity Audit" (04:30 local):
rem   schtasks /Create /F /SC DAILY /ST 04:30 /TN "TKA Parity Audit" ^
rem     /TR "E:\tka-platform\scripts\diagnostics\run-parity-audit.cmd"
rem On actionable drift (exit 2) or audit failure (exit 1) the script writes
rem an in-app admin notification, which the deployed onNewNotification
rem function pushes to devices. The audit never mutates sequence data.
cd /d E:\tka-platform
set TKA_ADMIN=1
call npx tsx scripts/diagnostics/audit-sequence-public-parity.ts --alert >> scripts\migrations\backups\parity-audit.log 2>&1
