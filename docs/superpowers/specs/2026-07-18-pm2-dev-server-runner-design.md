# pm2 Dev-Server Runner

Date: 2026-07-18
Status: Approved (conversation with Austen, 2026-07-18)

## Problem

The :5173 dev server lives in a VS Code terminal, so keeping the server up
requires keeping VS Code (~2.5 GB RAM) open, and restarting a wedged server
means hunting down a process chain by hand. Austen wants a minimalist CLI
runner with one-command restart.

## Decision

Supervise the existing `scripts/start-dev.ps1` (vite + Cloudflare tunnel
orchestrator) with **pm2**. No custom control script: pm2 IS the CLI.

Rejected alternatives: hand-rolled `devctl.ps1` (never-hand-roll; pm2 covers
it), oxmgr/pmc Rust managers (too young to trust the daily server to),
NSSM service (hides logs).

## Design

1. **Harden `scripts/start-dev.ps1` for supervised restarts:**
   - Shutdown (finally block + exit handler) uses `taskkill /PID <id> /T /F`
     so the whole cmd→pnpm→vite tree dies, not just the cmd wrapper.
   - Pre-boot sweep: if anything is listening on :5173, tree-kill it first.
     `pnpm run dev` has no `--strictPort`, so an orphan on :5173 would push
     the new vite to :5174 and silently break the tunnel and every session.
2. **`ecosystem.config.cjs`** at repo root: app `tka-dev`, script
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1`,
   cwd repo root, `autorestart: true`, generous `kill_timeout`.
3. **Boot at login:** `pm2 save` + a Task Scheduler logon task running
   `pm2 resurrect` (pm2's built-in `pm2 startup` is Linux-only).

## Daily driver

- `pm2 restart tka-dev` — the one command when it fucks up (any terminal,
  any Claude session)
- `pm2 logs tka-dev` / `pm2 status` — boot errors, health
- Crash auto-restarts via pm2.

## Out of scope

Making VS Code itself lighter; multi-app pm2 usage; agent servers on other
ports (still ad-hoc per resource-budget rule).
