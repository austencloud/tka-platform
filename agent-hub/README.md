# Agent Hub

Agent Hub is a taskbar project command center for Windows. The TKA Platform
shortcut opens a small native card at the cursor with three jobs:

1. Show and control the project's PM2 development server.
2. Turn a short note into a guarded feedback request for an agent.
3. Turn a short note into a guarded commit request for an agent.
4. Keep the primary checkout and every linked task worktree visible.

The main card does not launch CLI agents, open the web app, or run Git pull and
push. Claude and Codex desktop tasks own agent work. Git status remains visible
as context, but remote actions stay out of this surface.

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

The handoff area is deliberately honest. It copies a complete prompt to the
clipboard and tells you to paste it into a Claude or Codex desktop task. Agent
Hub does not claim that an agent is available, route by token usage, or pretend
that a task was dispatched.

The precise next integration is a supported desktop task-creation contract that
accepts a project path plus prompt and returns a task ID or a useful error. When
that contract exists, `CopyAgentRequest` in `AgentChooserHost.cs` is the single
place to add dispatch while preserving clipboard copy as the fallback.

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
1        start or restart the configured server
Ctrl+2   copy a feedback request
Ctrl+3   copy a commit request
Esc      close
```

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
colors, and naming skills for existing users. The project command center no
longer launches those terminals.

## How it works

- `AgentChooserStub.exe` is the shortcut target. It writes the project metadata
  to a named pipe and exits.
- `AgentChooserHost.exe` owns the resident WPF card, clipboard handoff, and the
  async server and Git status checks.
- `ProjectCommandCenter.cs` owns the visible layout and state rendering.
- `Pm2DevServerController.cs` owns server decisions. `Pm2Bridge.cjs` provides
  bounded PM2 status, start, and restart calls.
- `AgentPromptBuilder.cs` owns the feedback and commit request formats.
- `GitProjectController.cs` supplies branch and change context to the copied
  prompts. `GitWorktreeInventory.cs` owns the read-only linked-worktree view.

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
