# Agent Hub

A taskbar popover that asks **Claude or Codex?** and opens the chosen agent in the
project you clicked.

Every Agent Hub launch opens its own Windows Terminal window. Claude and Codex
draw from one 16-color palette, so no two live Agent Hub sessions share a tab
color. Closing a session releases its color automatically.

Pin one shortcut per repo. Click it, a card appears at your cursor with the
project's icon and two buttons. Pick one and the agent's terminal opens in that
directory, already carrying the bypass flags.

```
1        Claude Code
2        Codex
Enter    last agent used for this project
Esc      cancel
```

## Install

On a fresh machine, after cloning this repo:

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

### What it does

1. Compiles four small executables with the .NET Framework compiler that ships
   with Windows. No SDK, no npm, no downloads.
2. Installs them to `%LOCALAPPDATA%\AgentHub\bin` along with the icons.
3. Creates one shortcut per project in `%USERPROFILE%\AgentHub` and the Start Menu.
4. Writes `launchers\start-claude.bat` / `start-codex.bat` into any project that
   lacks them, so a bare repo still launches.
5. Registers the host to start at logon and starts it now.

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

Stops the host, removes the install folder, shortcuts, and the logon entry. Your
repos' `launchers\start-*.bat` files are left alone. Add `-Purge` to also forget
the remembered per-project agent. Taskbar pins have to be unpinned by hand.

## How it works

Four executables split the popover and terminal lifecycles:

- **AgentChooserStub.exe** is what the shortcut launches. It does nothing but
  write `project|name|icon` to a named pipe and exit, so it starts in tens of
  milliseconds.
- **AgentChooserHost.exe** is resident. At logon it builds the WPF window
  off-screen, warms the fonts and layout, then waits on the pipe. On a ping it
  positions the pre-built card at your cursor and shows it. Selection hides the
  window rather than closing it, so the second click is as fast as the first.
- **AgentTerminalLauncher.exe** claims the first free color, then opens a new
  Windows Terminal window with that tab color.
- **AgentTerminalSession.exe** runs inside the new window and holds the named
  color lease until the agent exits. Windows releases the lease if the terminal
  is closed forcefully.

If the host isn't running when you click, the stub cold-starts it and passes the
arguments through, so a shortcut always works.

State lives in `%LOCALAPPDATA%\AgentHub`:

| File | Purpose |
|---|---|
| `last.ini` | Per-project last agent, used for the Enter shortcut and the default highlight. |
| `debug.flag` | Create this empty file to turn on verbose logging to `host.log`. |
| `launch-errors.log` | Terminal startup failures, written only when a launch fails. |

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

**The agent window does not open or has no tab color.** Re-run the installer and
confirm that all four executables exist in `%LOCALAPPDATA%\AgentHub\bin`. Then
check `%LOCALAPPDATA%\AgentHub\launch-errors.log`.

## Source layout

```
agent-hub/
  install.ps1        build + install + shortcuts + logon entry
  uninstall.ps1
  projects.json      project list (path, display name, icon)
  src/               C# sources for the four executables
  icons/             project icons
  templates/         start-claude.bat / start-codex.bat written into bare repos
  KNOWN-ISSUES.md
```

The C# targets the .NET Framework compiler, which means **C# 5 only**: no `?.`,
no string interpolation, no local functions, no expression-bodied members. The
sources carry a UTF-8 BOM because csc assumes the ANSI codepage without one and
the card contains non-ASCII text. Keep both constraints in mind when editing.
