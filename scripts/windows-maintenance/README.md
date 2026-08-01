# Austen Backup

This backup keeps privileged work fixed and inspectable. Git, Google Drive
staging, and cloud verification run as Austen. The SYSTEM task can only invoke
the protected scripts under `C:\ProgramData\AustenBackup`; it does not execute
anything from the user profile or repository.

## Schedule

- 1:30 AM daily: stage personal folders, provider manifests, and Git working
  state on `D:` as Austen, then start the fixed SYSTEM task.
- On demand after staging: copy fixed sources to the protected `F:` archive as
  SYSTEM.
- 4:00 AM Sunday: verify hashes, manifests, agent state, Git recovery data, and
  Google Drive metadata as Austen.

The `C:` profile copy comes from a temporary VSS snapshot so `NTUSER.DAT` and
its transaction logs are consistent and readable. The snapshot is deleted when
VShadow exits. Reparse points and offline cloud files are never followed.
`D:\PICTURES2\iCloud Photos` and `C:\Users\Austen\CrossDevice` are represented
by manifests because their contents are provider-backed placeholders.

Robocopy performs a list-only comparison after each stable copy. Open database
files can retain stale directory-entry sizes inside an otherwise immutable VSS
snapshot. When Robocopy reports one of those files again after reconciliation,
the backup opens both streams and requires equal handle-level lengths and
SHA-256 hashes. Missing files, different content, and unparseable comparison
records still fail the run. Registry hives and transaction logs are refreshed
from the snapshot on every run, then checked by handle length and SHA-256,
because their contents can change without actionable size or timestamp changes.

## Install or update

Run the installer once through the narrow Windows elevation path:

```powershell
sudo.exe --disable-input powershell.exe -NoProfile -ExecutionPolicy Bypass -File E:\tka-platform\scripts\windows-maintenance\Install-AustenBackupTask.ps1
```

The installer copies the runtime to `C:\ProgramData\AustenBackup`, verifies the
Microsoft signature on VShadow, protects the runtime and backup destination,
registers all three tasks, and grants Austen read-and-execute access to the
fixed SYSTEM task. Austen cannot modify its action or pass arguments to it.

## Run and inspect

`C:\Users\Austen\Documents\PC Maintenance\Scripts\Start-AustenBackup.ps1`
runs the user-context preparation synchronously, then starts the protected task.

Canonical results are stored under:

- `C:\ProgramData\AustenBackup\Logs`
- `C:\ProgramData\AustenBackup\State`
- `F:\Automated Backups\DESKTOP-TJLLGPG\Manifests`
- `C:\Users\Austen\Documents\PC Maintenance\Logs`

The `F:` archive is read-only to Austen. That prevents a user-context process
from replacing an output directory with a junction before the SYSTEM copy.
Restore reads do not require elevation; changing or deleting archive contents
does.

These scripts do not install SSD firmware, restart Windows, or shut the machine
down.
