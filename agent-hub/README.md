# Agent Hub

Agent Hub is a taskbar project command center for Windows. The TKA Platform
shortcut opens a small native card at the cursor with three jobs:

1. Show and control the project's PM2 development server.
2. Open the project's Feedback, Spec, and Sessions workflows.
3. Keep the primary checkout and every linked task worktree visible.

The main card does not expose generic Claude/Codex launchers, open the web app,
or run Git pull and push. Workflow buttons start focused, project-scoped Codex
sessions. Git status remains visible as context, but remote actions stay out of
this surface.

## Command center

The server card renders immediately as `Checking server`, then resolves PM2 and
the configured port in the background. Its visible states are:

| State | Meaning | Available action |
|---|---|---|
| Checking | Agent Hub is reading PM2 and the port. | None until resolved. |
| Running | PM2 owns the app and the port accepts connections. | Restart server. |
| Offline | PM2 is stopped and the port is free. | Start server. |
| Starting or Restarting | The request is active. Progress stays visible while PM2 and the port settle. | None until resolved. |
| Port in use | Another process owns the configured port. | None. |
| Failed | The last status or control request failed. | Try again. |

Server control uses PM2's programmatic API through `Pm2Bridge.cjs`. The bridge
always disconnects from the daemon before exiting. This avoids the long-lived
`pm2 pid` child process that previously left the card in an ambiguous checking
state. Each click also invalidates any older status probe, so a late initial
result cannot replace the visible pending state.

The workflow panel uses the existing project skills instead of a handoff text
box:

- `Feedback` opens `$fb list`, which loads the real feedback queue and asks you
  to select an item before it is claimed.
- `Spec` opens `$queue list`, the project's ranked active/backlog spec workflow.
- `Sessions` opens `$sessions`, which starts at the saved analysis watermark and
  works through sessions that have not been reviewed.

The launch path is deliberately narrow. `AgentWorkflowLauncher.cs` selects the
owned skill, and `AgentTerminalLauncher.exe` opens one colored Codex session in
the selected project with that skill as the initial prompt. The Hub waits for
the terminal launcher's ready signal and reports a real failure if Codex,
Windows Terminal, or the project is unavailable. It does not route by token
usage or claim that a desktop task was created.

Codex's installed desktop launcher currently accepts a workspace path but not
an initial prompt or task-creation result. Moving these buttons into the desktop
app requires a supported contract that accepts project path plus prompt and
returns a task ID or actionable error. `AgentWorkflowLauncher.cs` is the owner
to update when that contract exists.

The worktree panel is read-only. It reads `git worktree list --porcelain`, then
checks the branch and working-tree state at every registered path. Task
worktrees are compared with `main` and labeled conservatively:

- `Ready to merge` means clean, ahead of main, not behind, with a clean primary
  checkout currently on main. It does not claim that tests passed.
- `In progress` means the worktree has local changes.
- `Waiting on primary` preserves a fast-forwardable task while the primary
  checkout is dirty or not on main.
- `Diverged`, `Conflicts`, `Detached`, `Locked`, and `Missing` remain visible for
  deliberate review.
- `Stale · review` means a clean task has no commits beyond main or Git marks
  the registration prunable. Agent Hub does not remove it.

Automatic merge and cleanup are intentionally outside this pass. A reliable
follow-up needs a persisted verification result tied to the task commit, a
fresh primary-checkout guard, a conflict-free integration proof, and a
recoverable cleanup transaction. Until then the Hub surfaces the worktree and
preserves it.

Keyboard shortcuts:

```text
1    start or restart the configured server
2    open Feedback
3    open Spec
4    open Sessions
Esc  close
```

The card places itself inside the active monitor's usable work area. It measures
the real native window and monitor rectangles in one coordinate space, then
remeasures and repositions after the asynchronous worktree inventory or a
Show/Hide toggle changes the card's height. A taskbar activation near the bottom
therefore keeps the fully expanded card above the cursor. Worktree rows own the
scrolling when they cannot all fit; server and workflow controls stay fixed and
the worktree header always provides a clear collapse route. The 160 ms
scale/fade entry animation follows the Windows client-area animation preference;
reduced-motion mode shows the card at its final size immediately.

Server errors are shown on the card and written to
`%LOCALAPPDATA%\AgentHub\server-errors.log`. Create
`%LOCALAPPDATA%\AgentHub\debug.flag` to enable detailed host logging in
`host.log`.

## Configuration

Server control is opt-in per project in `projects.json`:

```json
{
  "name": "TKA Platform",
  "path": "tka-platform",
  "icon": "tka-platform.ico",
  "server": {
    "manager": "pm2",
    "app": "tka-dev",
    "config": "ecosystem.config.cjs",
    "port": 5173
  }
}
```

The installer accepts only the `pm2` manager, a constrained app name, a config
file inside the project, and a valid TCP port. PM2 remains responsible for
process restart and logs. When PM2 is installed, Agent Hub registers a
current-user logon task that restores its saved process list.

## Install

From npm, run this in the folder that holds your checkouts:

```powershell
npx @austencloud/agent-hub
```

Or install from this repository:

```powershell
cd <repo>\agent-hub
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Use an explicit checkout root when needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -ProjectsRoot C:\code
```

Windows only. The package carries its C# sources, and the installer compiles
them with the .NET Framework compiler already on the machine. Re-running the
installer rebuilds the binaries and refreshes existing Agent Hub shortcuts and
taskbar pins in place.

| Flag | Effect |
|---|---|
| `-ProjectsRoot <dir>` | Set the checkout root. Default: this repo's parent. |
| `-NoAutoDiscover` | Install only projects listed in `projects.json`. |
| `-NoLaunchers` | Do not create legacy `start-*.bat` terminal launchers. |
| `-NoStartup` | Do not register the host to run at logon. |
| `-NoOpen` | Do not open the shortcut folder after installation. |

The installer still carries the standalone Agent Hub terminal utilities,
colors, and naming skills for existing users. Generic agent launch controls are
not shown in the project command center; the three owned workflows reuse the
terminal launcher internally.

## How it works

- `AgentChooserStub.exe` is the shortcut target. It writes the project metadata
  to a named pipe and exits.
- `AgentChooserHost.exe` owns the resident WPF card, workflow launch state, and
  the async server and Git status checks.
- `ProjectCommandCenter.cs` owns the visible layout and state rendering.
- `Pm2DevServerController.cs` owns server decisions. `Pm2Bridge.cjs` provides
  bounded PM2 status, start, and restart calls.
- `AgentWorkflowLauncher.cs` owns the Feedback, Spec, and Sessions mappings and
  their acknowledged terminal launch.
- `PopupPlacement.cs` owns monitor-safe placement decisions.
- `GitProjectController.cs` supplies repository state.
  `GitWorktreeInventory.cs` owns the read-only linked-worktree view.

The optional terminal helpers remain separate:

- `AgentTerminalLauncher.exe` opens a new Windows Terminal window.
- `AgentTerminalSession.exe` owns the terminal tint lease and session title.
- `AgentTerminalColorWatchdog.exe` repairs live Agent Hub terminal colors and
  titles when Windows Terminal resets them.

State lives under `%LOCALAPPDATA%\AgentHub`. The installed binaries and copied
PM2 bridge live in `%LOCALAPPDATA%\AgentHub\bin`.

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

The uninstaller stops Agent Hub, removes its install directory, shortcuts, and
logon entries, and leaves repository files alone. Add `-Purge` to remove legacy
per-project agent preferences as well.

## Source layout

```text
agent-hub/
  install.ps1        build, install, shortcuts, and logon entry
  uninstall.ps1
  bootstrap.ps1      download this folder from GitHub, then install
  package.json       published as @austencloud/agent-hub
  bin/agent-hub.js   npm entry point
  projects.json      project list and optional PM2 configuration
  src/               C# host, controls, controllers, and Node PM2 bridge
  icons/             project icons
  skills/            optional terminal color and naming skills
  templates/         legacy terminal launchers for direct use
```

The C# target is C# 5. Keep newer syntax such as null propagation, string
interpolation, local functions, and expression-bodied members out of these
sources. Source files containing non-ASCII UI copy need a UTF-8 BOM because the
.NET Framework compiler otherwise assumes the active ANSI code page.
