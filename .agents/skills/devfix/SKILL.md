---
name: devfix
description: Use when local dev infrastructure is broken — dev.tkaflowarts.com shows 502/503, the dev server won't serve, https/certificate errors, the Cloudflare tunnel is down, the Codex launcher or right-click context menu broke, or "fix my dev environment". Encodes the known failure modes so they're diagnosed in minutes, not rediscovered.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Fix Dev Infrastructure

When explicitly invoked, treat the text after `$devfix` as `<arguments>`. Expected shape: `[symptom, e.g. 'dev.tkaflowarts.com 502']`.

**Args:** `<arguments>`

The stack: Vite serves **HTTPS/2** on `:5173` (mkcert certs in `.cert/`),
cloudflared runs the locally-managed `tka-dev` tunnel exposing it as
`https://dev.tkaflowarts.com`. `scripts/start-dev.ps1` orchestrates both and
its header comments are the canonical doc — read it before theorizing.

**`:5173` is Austen's server.** Never start/kill/restart it yourself (hooks
block it). Diagnose with `curl.exe -k`; if his server needs a restart, ask him to
run it, e.g. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1`.

## First: split the fault domain

```powershell
curl.exe -k -s -o NUL -w "%{http_code}" --max-time 5 https://localhost:5173/
curl.exe -s -o NUL -w "%{http_code}" --max-time 10 https://dev.tkaflowarts.com/
```

| local | tunnel | Meaning |
|---|---|---|
| 000 | 502 | Vite isn't serving — ask Austen to start/restart it |
| 200 | 502 | Tunnel connected before Vite finished cold boot (the race `start-dev.ps1` now gates against), or cloudflared died — ask him to restart via the script |
| 200 | 503 | Token-based tunnel run missing `--url` — locally-managed tunnels get **no ingress rules** with a token; every request 503s. The script passes `--url https://localhost:5173` (start-dev.ps1:101); a hand-started tunnel probably didn't |
| 200 | 200 | Nothing wrong with the stack — the bug is elsewhere |

## Known failure modes

- **`http://` anywhere → ERR_EMPTY_RESPONSE.** The dev server is HTTPS/h2
  only. Every localhost URL, curl, and link is `https://`.
- **Tunnel origin TLS:** cloudflared can't read the Windows trust store for
  the mkcert CA → runs need `--no-tls-verify` (script handles it).
- **Tunnel credentials:** `%USERPROFILE%\.cloudflared\tka-dev.token` (or
  `cert.pem` from `cloudflared tunnel login`). Missing both → script skips the
  tunnel with a warning; dev.tkaflowarts.com stays dead. Refresh a token via
  `cloudflared tunnel token tka-dev` on a logged-in machine.
- **allowedHosts:** Vite only answers for hosts in `vite.config.ts`
  `server.allowedHosts` (includes `dev.tkaflowarts.com`). A new hostname needs
  adding there.
- **Launcher / context menu:** `launchers/start-codex.bat` and
  `launchers/install-codex-context-menu.ps1` (registry `HKCU` key pointing at
  the Codex install — reinstalls move the path; rerun the installer script).
- **Whole-machine setup:** `launchers/bootstrap-machine.ps1` replicates the
  full agent scaffolding on a fresh machine (CLIs, context menus, launcher
  shortcuts, global Claude/Codex config, pm2 stack, PrtSc→F13 remap). It is
  idempotent, so it also works as a repair-everything pass here; assets live
  in `launchers/bootstrap-assets/`.

## After any fix

Prove it: rerun both curls and show the codes, or have Austen confirm the
page loads. Config-only changes still follow `verification-protocol.md`.
