# Agent Hub Dev-Server Control

Date: 2026-08-01
Status: Approved by Austen on 2026-08-01

## Goal

Agent Hub starts the TKA development server without VS Code or a visible
terminal. The existing PM2 runner remains the process owner.

## Decision

Configured projects receive a third tile beside Claude and Codex. Its action and
label follow the observed state:

- Offline: Start
- Starting: Starting
- Online: Restart
- Port owned outside PM2: Take over
- PM2 unavailable: PM2 needed
- Failed command: Retry

Keyboard shortcut `3` invokes the same action. The popover remains responsive
while PM2 runs and reports the result on the tile.

## Configuration

`agent-hub/projects.json` may define a `server` object with four fields:

- `manager`: `pm2`
- `app`: constrained PM2 application name
- `config`: path relative to the project root
- `port`: TCP readiness port

The installer resolves the config to an absolute path, proves it remains inside
the project, and passes the metadata through the existing shortcut and named
pipe boundary. Auto-discovered projects receive no server tile.

## Runtime path

```text
project shortcut
  -> AgentChooserStub
  -> AgentChooserHost
  -> Pm2DevServerController
  -> pm2 tka-dev
  -> scripts/start-dev-pm2.cjs
  -> scripts/start-dev.ps1
  -> Vite :5173 + Cloudflare tunnel
```

The controller executes the installed PM2 JavaScript entry point with Node. It
does not pass a configurable shell command. App names, config paths, and ports
are validated before use.

## Failure behavior

The tile distinguishes PM2 state from TCP readiness. It never labels the server
Running until PM2 owns a positive process ID and the configured port accepts a
connection. A different process on the port is reported as Take over. Errors
remain visible and are appended to
`%LOCALAPPDATA%\AgentHub\server-errors.log`.

## Verification

1. Compile the WPF host and stub with the installed .NET Framework compiler.
2. Run the controller self-test for metadata validation, PID parsing, and state
   classification.
3. Install Agent Hub and inspect the native popover at normal Windows scaling.
4. Start and restart through tile `3`.
5. Prove PM2 reports `tka-dev` online and `tka-tunnel2` remains stopped.
6. Prove only `:5173` is listening and `https://localhost:5173` responds.

The process runner remains governed by
`docs/superpowers/specs/2026-07-18-pm2-dev-server-runner-design.md`.
