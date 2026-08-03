# Agent Hub

A taskbar popover that opens Claude or Codex and handles common project actions
without opening an editor.

Every Agent Hub launch opens its own Windows Terminal window. Agent Hub keeps 16
dark background tints available, so no two live Claude or Codex sessions share
one. Each tab uses the same tint as its terminal background. Closing a session
releases its tint automatically. A session also checks its ANSI-black palette
entry every two seconds and restores the assigned tint when Terminal resets it.

Color recovery is automatic in Agent Hub sessions. Run `/color` in Claude or
`$color` in Codex to force an immediate check. The same skill also works in a
manually opened session: it claims the first free tint and holds it until that
agent exits. Codex also lists it in `/skills`.

Run `/colorall` in Claude or the TKA Codex build to restore every live agent
window in one pass. Standard Codex can invoke the same skill as `$colorall`.
Agent Hub requests Administrator approval once when the live set includes an
elevated terminal.

The terminal title starts as `Starting Session`. Bare `/rename` lets Claude or
Codex choose an accurate two- or three-word name from the conversation. Use
`/rename Exact Name` when you want to choose it yourself. The same name appears
in history and Alt+Tab, with no agent or project suffix, and it never changes
again unless you run `/rename` again.

Pin one shortcut per repo. Click it, and a card appears at your cursor with the
project's icon. Pick Claude or Codex and the agent's terminal opens in that
directory, already carrying the bypass flags. Projects with a configured PM2
server also get a tile that reports its current state, and projects with a
configured app URL get a tile that opens the app in your default browser.

```
1        Claude Code
2        Codex
3        start or restart the configured server
4        open the app in the default browser
5        pull the current Git branch
6        push committed work to its upstream
Enter    last agent used for this project
Esc      cancel
```

The server tile does not open a terminal. It calls PM2 in the background, waits
for the configured port, and changes from Start to Restart when the server is
ready. A process already using the port outside PM2 appears as Take over. PM2
errors are shown on the tile and written to
`%LOCALAPPDATA%\AgentHub\server-errors.log`.

The Open app tile launches the project's `appUrl` in your default browser, with
whatever profile and sign-in state that browser already has. It is server-aware:
with the server listening it opens the page immediately; with the server offline
it reads Start & open, starts the server through PM2, waits for the port, then
opens the page. Only absolute `http://` and `https://` URLs are accepted.

Every Git project gets a compact status row with its branch, ahead and behind
counts, and changed-file count. Pull is available only for a clean worktree and
always uses `git pull --ff-only`. Push is available only when the current branch
has an upstream, is ahead, and is not behind. Dirty files do not block Push
because only commits are transferred. Agent Hub never force-pushes, stashes,
rebases, creates branches, or resolves conflicts. Git failures remain visible in
the row and are written to `%LOCALAPPDATA%\AgentHub\git-errors.log`.

Server controls and the app URL are opt-in per project in `projects.json`:

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
  },
  "appUrl": "https://localhost:5173"
}
```

The installer accepts only the `pm2` manager, a constrained app name, a config
file inside the project, and a valid TCP port. PM2 itself remains responsible
for process restart and logs. When PM2 is installed, Agent Hub registers a
current-user logon task that restores the saved PM2 process list.

## Install

From npm, in the folder that holds your checkouts:

```powershell
npx @austencloud/agent-hub
```

Windows only. Nothing to build first: the package carries the C# sources and the
installer compiles them with the .NET Framework compiler already on the machine.
Run it from inside a repo and the sibling folder becomes the project root; run it
from a folder full of repos and that folder does. Name it yourself with
`npx @austencloud/agent-hub -ProjectsRoot C:\code`.

`npx @austencloud/agent-hub uninstall` reverses it, `-Purge` included.

Or from a clone of this repo:

```powershell
cd <repo>\agent-hub
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

If your other checkouts live somewhere other than this repo's parent folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -ProjectsRoot C:\code
```

The installer opens `%USERPROFILE%\AgentHub` when it finishes. Drag the shortcuts
onto your taskbar to pin them. That folder and the Start Menu both get a copy;
the taskbar is the point.

Re-run it any time. It rebuilds, refreshes shortcuts, and never overwrites a
project's existing `launchers\start-*.bat`.
Existing Agent Hub taskbar pins are refreshed in place, including newly
configured server metadata. Other pinned applications are left alone.

### What it does

1. Verifies Claude's guarded two/three-word bare `/rename` prompt patch.
2. Installs 16 perceptually spaced dark Windows Terminal background schemes
   for the current user. Running Terminal windows reload only when those schemes
   have changed.
3. Compiles five small executables with the .NET Framework compiler that ships
   with Windows. No SDK, no npm, no downloads.
4. Installs them to `%LOCALAPPDATA%\AgentHub\bin` along with the icons.
5. Installs the personal `color` and `colorall` skills for Claude and Codex.
6. Creates one shortcut per project in `%USERPROFILE%\AgentHub` and the Start Menu.
7. Writes `launchers\start-claude.bat` / `start-codex.bat` into any project that
   lacks them, so a bare repo still launches.
8. Registers the host to start at logon and starts it now.

### Options

| Flag | Effect |
|---|---|
| `-ProjectsRoot <dir>` | Where your checkouts live. Default: this repo's parent. |
| `-NoAutoDiscover` | Only install projects listed in `projects.json`. |
| `-NoLaunchers` | Don't create `start-*.bat` in projects that lack them. |
| `-NoStartup` | Don't register the host to run at logon. |
| `-NoOpen` | Don't open the shortcut folder at the end. |

Projects come from `projects.json` plus, unless `-NoAutoDiscover` is passed, any
sibling folder under `ProjectsRoot` that contains a `.git` directory. Entries
whose path doesn't exist are skipped silently, so one `projects.json` works
across machines that have different subsets cloned.

To add an icon for a project, drop a `.ico` into `agent-hub/icons/` and name it
in `projects.json` (auto-discovered projects look for `<folder-name>.ico`).

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

Stops the host, removes the install folder, shortcuts, host logon entry, and PM2
resurrection task. Your repos' `launchers\start-*.bat` files are left alone. Add
`-Purge` to also forget the remembered per-project agent. Taskbar pins have to
be unpinned by hand.

## How it works

Five executables split the popover and terminal lifecycles:

- **AgentChooserStub.exe** is what the shortcut launches. It does nothing but
  write `project|name|icon` to a named pipe and exit, so it starts in tens of
  milliseconds.
- **AgentChooserHost.exe** is resident. At logon it builds the WPF window
  off-screen, warms the fonts and layout, then waits on the pipe. On a ping it
  positions the pre-built card at your cursor and shows it. Selection hides the
  window rather than closing it, so the second click is as fast as the first.
  Its optional server tile delegates process work to `Pm2DevServerController`.
  Git status and remote actions delegate to `GitProjectController`.
- **AgentTerminalLauncher.exe** claims the first free tint, then opens a new
  Windows Terminal window with that background scheme.
- **AgentTerminalSession.exe** runs inside the new window and holds the named
  tint lease until the agent exits. It watches the live console palette and
  restores the tint after a reset. Windows releases the lease if the terminal is
  closed forcefully.
- **AgentTerminalColorWatchdog.exe** checks every live Agent Hub session from
  the resident host. It covers terminals opened before a helper update and acts
  as a second repair path for unelevated sessions.

If the host isn't running when you click, the stub cold-starts it and passes the
arguments through, so a shortcut always works.

State lives in `%LOCALAPPDATA%\AgentHub`:

| File | Purpose |
|---|---|
| `last.ini` | Per-project last agent, used for the Enter shortcut and the default highlight. |
| `debug.flag` | Create this empty file to turn on verbose logging to `host.log`. |
| `launch-errors.log` | Terminal startup failures, written only when a launch fails. |
| `server-errors.log` | PM2 status and start failures from the server tile. |
| `git-errors.log` | Git status, pull, and push failures from the project row. |
| `terminal-color-recoveries.log` | Each automatic tint repair, including the observed color and Terminal settings timestamps. |

The Windows Terminal schemes live in
`%LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments\AgentHub`. The uninstaller
removes that fragment with the rest of Agent Hub.

Launching an agent opens `wt.exe -w new` and runs
`<project>\launchers\start-<agent>.bat` inside it. Each repo owns that file, so a
project can customize how its agent starts (extra env, a wrapper binary, a
status line) without touching agent-hub. If the bat is missing, the session
host runs `claude` or `codex` from PATH.

## Troubleshooting

**Nothing happens when I click a pin.** Check whether the host is alive:

```powershell
Get-Process AgentChooserHost
```

If it's missing, start it: `%LOCALAPPDATA%\AgentHub\bin\AgentChooserHost.exe`.
For details, create the debug flag and click again:

```powershell
New-Item -ItemType File "$env:LOCALAPPDATA\AgentHub\debug.flag" -Force
Get-Content "$env:LOCALAPPDATA\AgentHub\host.log" -Tail 30
```

**The build fails with "csc.exe not found".** Enable the .NET Framework 4.x
feature in Windows Features and re-run.

**The popover animation plays twice.** Known behavior when clicking a pin while
the popover is already open: the click's mousedown hides it, then the same
click's ping reopens it. See `KNOWN-ISSUES.md`.

**The agent window does not open or has no distinct background.** Re-run the
installer, then open a new Agent Hub session. Confirm that all five executables
exist in `%LOCALAPPDATA%\AgentHub\bin`, then check
`%LOCALAPPDATA%\AgentHub\launch-errors.log`.

**Pull or Push is disabled.** Hover the button for the exact reason. Pull is
blocked by local changes. Push is blocked when there is nothing ahead, the
branch is behind or diverged, or no upstream is configured.

## Source layout

```
agent-hub/
  install.ps1        build + install + shortcuts + logon entry
  uninstall.ps1
  bootstrap.ps1      download this folder from GitHub, then install
  package.json       published as @austencloud/agent-hub
  bin/agent-hub.js   npm entry point; resolves ProjectsRoot, calls install.ps1
  projects.json      project list (path, display name, icon)
  src/               C# sources for the executables and controllers
  icons/             project icons
  skills/            personal Claude and Codex skills installed for the user
  templates/         start-claude.bat / start-codex.bat written into bare repos
  KNOWN-ISSUES.md
```

Publishing: `cd agent-hub && npm publish`. `files` in package.json is the
allowlist, so `diag/` and `hooks/` stay out of the tarball.

The C# targets the .NET Framework compiler, which means **C# 5 only**: no `?.`,
no string interpolation, no local functions, no expression-bodied members. The
sources carry a UTF-8 BOM because csc assumes the ANSI codepage without one and
the card contains non-ASCII text. Keep both constraints in mind when editing.
