# The Dev Server Is Austen's — ENFORCED

## The Rule

**Never start, restart, or stop the dev server. Not on :5173, not by any
command, not for any reason, not even when Austen says it is broken.**

That includes every one of these, with no exceptions and no "just this once":

- `npm run dev` / `pnpm run dev` / `vite` aimed at :5173
- `scripts/start-dev.ps1` (the launcher — agents do not run it)
- `pm2 start|restart|stop tka-dev`
- killing, tree-killing, or sweeping whatever holds :5173

Austen has a **button in Agent Hub** that starts and restarts the server. That
button is the only sanctioned path, and it is his to press.

## Why It Is Not Yours To Start

The button is not a convenience wrapper around `vite`. It carries the whole rig
Austen wants attached to a server boot — the Cloudflare tunnel for
`dev.tkaflowarts.com`, the pm2 supervision of `tka-dev`, the ordering that keeps
the tunnel from serving 502s during Vite's cold boot, and whatever else he wires
into it later. An agent starting Vite by hand produces a server that is missing
all of it, and it fights the pm2 app for the port.

Austen (2026-08-10), after an agent ran the launcher itself: *"we have an agent
hub and through that agent hub I have the ability to start the server and
restart the server ... you're never supposed to actually open up a new bash
command and start the dev server. I have a button for that, that button handles
all the stuff like the Cloudflare tunnel and everything else that I want to be
connected to the starting of my server."*

"He said the server was broken" is not authorization. "He told me to make the
page work" is not authorization. Making the page work means **telling him to
press the button**, then continuing once it is up.

## What To Do Instead

When the server is down, wedged, or serving errors:

1. Diagnose freely — read logs, inspect the port, identify the process, find
   the actual fault. Diagnosis is yours.
2. Report what you found in one line.
3. **Ask him to restart it from Agent Hub**, and say why.
4. Wait. Then verify and carry on.

If a task genuinely needs a server you control for a throwaway check, run your
own on a free port (`vite --port <free>`) and reap it in the same turn —
`resource-budget.md`. That is never :5173 and never the launcher.

## The IPv6 Trap (this is what made an agent think the server was dead)

`"dev": "vite --host ::"` binds **IPv6**. `curl https://localhost:5173/`
resolves to IPv4 `127.0.0.1` first and returns `000`, which reads exactly like
"not running." It is not. Use `curl -k -g 'https://[::1]:5173/'`, or check the
port directly before concluding anything:

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
```

A dead process can also leave `LISTEN` and established sockets behind, so a
listening port is not proof of a live server either. Confirm the owning PID
still exists before diagnosing further — and either way, the remedy is the
button, not your shell.

## Forbidden

- Any command that starts, restarts, or stops :5173 or the `tka-dev` pm2 app.
- Running `scripts/start-dev.ps1`.
- Killing whatever holds :5173, including when it is stale or dead.
- Treating "the server is broken" or "make this page work" as permission to
  start it.
- Concluding the server is down from an IPv4 `curl localhost:5173` alone.

## Related

- `CLAUDE.md` → Dev Server · `.claude/skills/devfix/SKILL.md`
- `resource-budget.md` (your own servers, on your own ports, reaped)
- Memory: `feedback_never_start_dev_server`
