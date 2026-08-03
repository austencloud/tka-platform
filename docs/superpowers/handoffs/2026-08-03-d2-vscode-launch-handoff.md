# D2 VS Code Launch Config + Dev Tunnel — Handoff (2026-08-03)

For the agent on **d2** (the office machine). Written from d1. Two tasks: the
launch-config fix (below) and the dev-tunnel takeover (next section).

## Task 2: d2 takes over the tka-dev2 tunnel

Austen's decision (2026-08-03): dev hostnames follow machine rank.

| Hostname | Tunnel | Machine |
|---|---|---|
| dev.tkaflowarts.com | `tka-dev` | d1 (primary desktop) |
| dev2.tkaflowarts.com | `tka-dev2` | **d2 — you** |
| dev3.tkaflowarts.com | `tka-dev3` | laptop |

The laptop used to run `tka-dev2`; it moves to the new `tka-dev3` (already
created and DNS-routed from d1). d2 claims `tka-dev2`. Steps on d2:

1. `cloudflared tunnel login` (browser opens; Austen authorizes the zone).
2. `cloudflared tunnel token tka-dev2 | Set-Content "$env:USERPROFILE\.cloudflared\tka-dev2.token"`
3. Pull `main`, then register the tunnel with pm2 using the repo shim:
   `pm2 start scripts/tunnel2-pm2.cjs --name tka-dev2-tunnel` and `pm2 save`.
   The shim is token-based; it reads the token file from step 2 and forwards
   dev2.tkaflowarts.com to whatever serves `https://localhost:5173` locally.
4. Verify: with a dev server running on d2, `curl https://dev2.tkaflowarts.com`
   should return the app.

**Round-robin warning:** until the laptop stops its old `tka-dev2` connector,
both machines serve dev2.tkaflowarts.com and requests bounce between them.
The laptop's switchover to `tka-dev3` is a separate handoff; if dev2 behaves
erratically before that lands, that is the cause, not your config.

## What happened

Austen reported his VS Code launch command on d2 was not using the HTTPS dev
server. Root cause is in the repo, not on d2: the committed
`.vscode/launch.json` had `"url": "http://localhost:5173"` in the
"Debug in Chrome" configuration. The dev server runs HTTPS with HTTP/2
(`scripts/start-dev.ps1` waits on `https://localhost:5173`), so the plain-http
URL gets ERR_EMPTY_RESPONSE.

Fixed on `main`: the Chrome debug URL is now `https://localhost:5173`.

## What to do on d2

1. Pull `main` (use the `sync` skill if the working tree is dirty).
2. `.vscode/launch.json` is tracked, so the pull delivers the fix. If d2 has
   local uncommitted edits to `.vscode/launch.json`, diff them against the
   pulled version first. Keep anything genuinely d2-specific; otherwise the
   repo version wins.
3. If any local launcher, task, or script on d2 references
   `http://localhost:5173`, change it to `https://`. The dev server never
   serves plain HTTP. This applies everywhere: launch configs, tasks,
   shortcuts, cloudflared configs.
4. Verify: start the dev server (`🚀 Start Dev Server` launch config runs
   `scripts/start-dev.ps1`), then `🌐 Debug in Chrome` should open
   `https://localhost:5173` and load the app. A cert warning is expected on a
   fresh profile; accept it.

## Canonical facts (do not re-derive)

- Dev server = HTTPS + HTTP/2 on 5173, always. `http://` links to it are a
  known footgun (memory: `reference_dev_server_http2_freeze_fix`, rule:
  `.claude/rules/clickable-links.md`).
- `scripts/start-dev.ps1` is the canonical boot path: it sweeps stale :5173
  owners, boots vite, waits for HTTPS readiness, then runs the cloudflared
  tunnel against `https://localhost:5173`.
- `.vscode/launch.json`, `settings.json`, and `tasks.json` are tracked in the
  repo. Local drift on any machine should be reconciled toward `main`, not
  committed over it, unless the change is an improvement for every machine.
