# Agent Hub Git Controls

Date: 2026-08-01
Status: Approved by Austen on 2026-08-01

## Outcome

Agent Hub shows the current branch, local ahead and behind counts, and changed
file count for the selected project. Two native buttons provide the daily remote
actions: Pull and Push.

The Hub is a status and safe-action surface. Detailed staging, commits, history,
rebases, and conflict resolution remain in a full Git client or agent session.

## Discovery

Internal searches for `git status`, `git pull`, `git push`, `porcelain`,
`ahead`, `behind`, and `upstream` found no Git controller or Git UI inside
`agent-hub/`. The existing asynchronous controller pattern is
`Pm2DevServerController` plus the host's `ThreadPool` and Dispatcher boundary.

Git's command-line porcelain v2 is the stable machine-readable status contract.
Git's `pull --ff-only` rejects divergent history instead of creating a merge.
The installed Git executable and configured credential manager remain the source
of repository and authentication behavior. No Git library is added.

## Safety policy

- Pull runs only for a clean worktree on a branch with an upstream.
- Pull always uses `git pull --ff-only`.
- Push runs only when the branch has an upstream, is ahead, and is not behind.
- Dirty files do not block Push because Push transfers commits, not worktree
  contents.
- No force push, automatic upstream creation, stash, rebase, merge, branch
  creation, checkout, reset, or conflict resolution is available.
- Detached HEAD, conflicts, an in-progress Git operation, missing upstream, and
  divergence block remote actions with visible reasons.
- Commands run without a shell on a background thread and have timeouts.

## Native layout

The existing agent and server tiles remain the primary row. A compact Git row
sits below them with branch and sync state on the left and two 44-pixel native
buttons on the right. Keys 4 and 5 invoke Pull and Push when those actions are
available.

Busy and error states remain in the row. Failures are also written to
`%LOCALAPPDATA%\AgentHub\git-errors.log`.

## Code boundaries

- `HiddenProcessRunner.cs` extracts the existing hidden process execution
  responsibility so PM2 and Git do not duplicate it.
- `GitProjectController.cs` owns Git discovery, porcelain parsing, guards, and
  remote commands.
- `GitActionPanel.cs` owns the native Git row and button presentation.
- `AgentChooserHost.cs` remains the orchestrator for project selection,
  background work, and generation-safe UI updates.
- `install.ps1` compiles the new sources and runs pure controller self-tests.

## Verification

1. Compile with the repository installer and run PM2 plus Git controller
   self-tests.
2. In disposable local repositories, prove clean Pull, ahead Push, dirty Pull
   refusal, and diverged Push refusal.
3. Open the native visual-test host and inspect the Git row in clean, dirty,
   busy, blocked, and error states.
4. Confirm the production taskbar pin still opens the current host and the live
   development server remains healthy.
