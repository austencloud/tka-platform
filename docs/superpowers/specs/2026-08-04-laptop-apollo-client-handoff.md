# Laptop Apollo Client Cleanup — Handoff (2026-08-04)

## Mission

You are the agent on **laptop**. Three jobs, in order: stop the laptop from
stranding phantom virtual displays on other machines, re-pair it with the
Apollo host that now exists for it, and prove teardown is clean.

Context: d1 (the 4090 workstation) now runs **two** Apollo instances — a
primary serving d2's ultrawide, and a second one created specifically for you.
d2 was fully set up on 2026-08-04 and works end to end. You are the last client
that has not been brought over.

Parent record, read it first:
`docs/superpowers/specs/2026-08-03-apollo-virtual-display-mesh-handoff.md`.
This doc is the laptop-side slice of its loose ends 5b and 5c; it does not
replace it.

**This repo is public.** No tailnet addresses, tailnet DNS names, Windows
hostnames, SSIDs, or account names appear here, and none may be added.
Discover addresses at runtime (`tailscale status`, then probe port `47989`).

### The three machines

| Name | Role |
|---|---|
| **d1** | 4090 workstation. Runs two Apollo instances: primary at port base `47989`, and one named `laptop` at port base `48989`. |
| **d2** | Office machine, ultrawide. Apollo host (serves you today) AND a Moonlight client of d1. Fully working as of 2026-08-04. |
| **laptop** | You. Moonlight client only. |

Names are lowercase everywhere — Austen standardized this 2026-08-03. Do not
reintroduce `Desktop1`, `D1`, or any capitalized variant.

## Done — verified

All of this happened **on d2**, not on the laptop. It is here because it
determines what you do. Phase work was machine configuration, so the commits
are documentation only — the evidence is command output, reproduced because it
is not recoverable from git.

1. **d1's two Apollo instances renamed at the source** (commit `f3a096205f`).
   The second instance was named `d1-laptop`, which reads as two conflicting
   machines in every client's host list. Austen (2026-08-04): *"there should
   only be three devices ... d1 ... d2 ... laptop."* Renamed via each
   instance's own `sunshine_name` so it propagates to every client rather than
   being a per-client alias. Verified by reading each instance's `serverinfo`
   back: `<hostname>d1</hostname>` on port base `47989`,
   `<hostname>laptop</hostname>` on `48989`.

2. **d2 re-paired with d1's primary Apollo** (commit `f3a096205f`). Apollo
   generated a fresh CA when it replaced Sunshine, invalidating every prior
   pairing. Full handshake completed: getservercert → clientchallenge →
   serverchallengeresp → clientpairingsecret → HTTPS pairchallenge. Verified
   from both ends — d1's `/api/clients/list` returned a named cert `d2`, and
   d2's Moonlight registry showed 3 apps under the `d1` host.

3. **Virtual display proven end to end from d2** (commit `9ddcf8c4bf`).
   d1's own Apollo log for the run:
   ```
   Display mode for client [d2] overriden to [3440x1440x120]
   Virtual Display created at \\.\DISPLAY11
   Capture size       : 3440x1440
   Desktop resolution [3440x1440]
   Virtual Display removed successfully
   ```
   Client side: `Video stream is 3440x1440x60`, AV1, D3D11VA hardware decode.
   A screenshot of d2's panel showed d1's wallpaper and taskbar on an empty
   extended desktop filling the ultrawide, 1:1, no scaling.

4. **`quitAppAfter = true` set on d2, and proven to fix phantom displays**
   (commit `6e592a490d`). Closing the stream window normally, with no explicit
   quit command, produced this in d1's log:
   ```
   17:17:31.254  CLIENT DISCONNECTED
   17:17:31.349  Session pausing for app [...]
   17:17:31.428  Virtual Display removed successfully
   ```
   79 ms. This is the exact change you need to make locally — see Loose end #1.

5. **d2's own Apollo renamed** `D2` → `d2` in its `sunshine.conf`, service
   restarted, readback confirmed.

## Believed done — unverified

- **The `laptop` Apollo instance on d1 has never been streamed from.** Built on
  d1 2026-08-03, confirmed listening on `48984/48989/48990/49010` from d2 on
  2026-08-04, dashboard answering on `48990`. But nobody has ever run a session
  through it. Its virtual-display behaviour, resolution handling, and whether
  it collides with the primary instance when both are live are all **unknown**.
  You are the first to find out.
- **Both d1 instances now need updating together.** Instance 2 is a directory
  clone at `C:\Program Files\Apollo2`, so an Apollo upgrade applied to only one
  directory silently leaves the other behind.
- **Nothing on the laptop itself has been inspected this session.** Its
  Moonlight version, settings, pairing state, and host list are all assumed,
  not observed. Verify before changing anything.
- **Whether the laptop should use d1's `laptop` instance or keep using d2** is
  undecided. See Loose end #2.

## In flight

Nothing. No branch, no worktree, no uncommitted work. All three commits are on
`main` and pushed: `f3a096205f`, `9ddcf8c4bf`, `6e592a490d`.

## Laptop-side status (2026-08-04, evening)

All six loose ends are closed. The laptop session had independently done 2 to 6
before this handoff was read, so the entries below record evidence rather than
plans. One finding contradicts this doc and is called out in #1.

| # | State | Evidence |
|---|---|---|
| 1 | **Done, with a correction** | `quitAppAfter` alone was NOT sufficient. See #1. |
| 2 | Done | Paired to instance 2 (`48989`), the instance named `laptop`. |
| 3 | Done | `apps` subkey populated with `Desktop`, `Steam Big Picture`, `Virtual Display`; host `/api/clients/list` shows a named cert `laptop`. |
| 4 | Done | `Video stream is 1920x1200x60`; screenshot showed an empty extended desktop at native size; teardown proven under #1. |
| 5 | Done, and rewritten | Installed, then the card was rebuilt in WPF to match Agent Hub and made machine-agnostic. |
| 6 | Done | Exactly three tiles: `d1`, `d2`, `laptop`. |

**Completed beyond this handoff's scope:** instance 2 pinned to d1's LEFT panel
and instance 1 pinned to the RIGHT panel, so Mirror mode is correct on both
machines; and d2's client record had `always_use_virtual_display` turned off,
without which it could not mirror a physical panel at all.

## Loose ends (ranked)

### 1. Set `quitAppAfter = true` in the laptop's Moonlight — DONE, with a correction

**The registry setting alone does not fix this.** It was set to `true` with
Moonlight closed exactly as instructed below, then a stream was closed
gracefully via `CloseMainWindow()`, and the host still logged only
`Session pausing`. The phantom display survived.

CLI-launched streams need **`--quit-after` on the command line**. With it the
sequence completes:

```
17:36:37.275  CLIENT DISCONNECTED
17:36:37.353  Session pausing for app [Virtual Display].
17:36:37.439  Virtual Display removed successfully
```

86ms. `launchers/moonlight-hub.ps1` now passes `--quit-after` on every mode, so
the gap this doc flags under #5 is closed at the source. Keep the registry
setting as well, for streams started from Moonlight's own UI.

**Second trap found here:** a paused session is *resumed*, not replaced. A
request for `Virtual Display` came back as `Session resuming for app [Desktop]`
because a stale paused Desktop session existed, which is why the first teardown
test looked like the fix had failed rather than like the wrong app running.
Clear it with `moonlight quit <host>:<port>`, which answers `<cancel>1</cancel>`
and returns the host to `SUNSHINE_SERVER_FREE`.

The original instructions follow, retained because the registry half is still
required.

This is the highest-value item and the direct cause of a real problem: the
laptop stranded a phantom virtual display on d2 **twice** on 2026-08-04,
including once while Austen was working, which read to him as "my display
settings are stuck."

Apollo pauses a session on client disconnect and *deliberately* holds the
virtual display open for resume. Nothing reclaims it until the app is
terminated. Your Moonlight currently disconnects without terminating.

```powershell
# Moonlight rewrites its settings on exit - close it FIRST or the edit is
# silently discarded.
Get-Process Moonlight -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$k = 'HKCU:\Software\Moonlight Game Streaming Project\Moonlight'
(Get-ItemProperty $k).quitAppAfter          # read before
Set-ItemProperty $k -Name quitAppAfter -Value 'true'
(Get-ItemProperty $k).quitAppAfter          # read back - must be 'true'
```

Equivalent GUI path: Moonlight settings → "Quit app after ending stream".

**Verification (required, do not skip):** stream something, close the window
normally, then confirm the host removed the display. From the host's dashboard
API, `GET /api/logs` returns the full Apollo log over the network and should
show `CLIENT DISCONNECTED` → `Session pausing` → `Virtual Display removed
successfully` within a second. If instead it stops at `Session pausing`, the
setting did not take — check that Moonlight was closed when you wrote it.

### 2. Pair with d1's `laptop` instance — DONE (not with d2)

Already decided, do not re-litigate: Austen ruled on 2026-08-03 that clients
**must not chain** laptop → d2 → d1. Each client pairs straight to its own d1
instance. Chaining double-encodes your pane and nests input capture. So you
pair with d1's `laptop` instance (port base `48989`), and you stop using d2 as
a host.

That instance is a full directory clone of Apollo on d1 — `C:\Program
Files\Apollo2`, service `Apollo2Service`, its own firewall rule and its own
identity (certs were regenerated, not copied). Its dashboard is on `48990` and
takes the **same login as d1's primary dashboard** — instance 2 was seeded with
instance 1's credential hashes. Reachable directly over the tailnet from
another machine with no port proxy; d2 confirmed that on 2026-08-04.

Once both you and d2 are streaming, the two virtual displays coexist on d1's
desktop and get arranged side by side in d1's Windows display settings. Input
unifies on d1 — d2's mouse drives both halves, your pane is passive.

### 3. Re-pair — DONE

Apollo's fresh CA invalidated the laptop's old pairing exactly as it did d2's.
Assume you are unpaired regardless of what the UI suggests — see Gotchas on
stale `srvcert`.

Pairing needs a PIN typed into the host's dashboard, which needs a login.
**Austen has those credentials; ask him.** They are deliberately not in this
public repo.

The scripted flow that worked on d2 (adapt the host name and dashboard URL):

```powershell
# 1. Log in to the host dashboard, keep the session cookie.
$r = Invoke-WebRequest "https://<dashboard>/api/login" -Method POST `
     -Body (@{username='<user>';password='<pass>'} | ConvertTo-Json) `
     -ContentType 'application/json' -SkipCertificateCheck -SessionVariable s
# 2. Start the client pairing with a PIN you choose.
$p = Start-Process "C:\Program Files\Moonlight Game Streaming\Moonlight.exe" `
     -ArgumentList 'pair','--pin','4721','<hostname>' -PassThru
# 3. Poll the PIN endpoint until it accepts. {"status":false} just means the
#    client has not called yet - it is not an error.
Invoke-WebRequest "https://<dashboard>/api/pin" -Method POST -WebSession $s `
  -Body '{"pin":"4721","name":"laptop"}' -ContentType 'application/json' `
  -SkipCertificateCheck
```

**Verify pairing properly:** the trustworthy signal is a populated `apps`
subkey under
`HKCU:\Software\Moonlight Game Streaming Project\Moonlight\hosts\<n>\apps`,
plus the host's `/api/clients/list` showing a named cert for you. `paired=True`
in the registry means nothing (see Gotchas).

### 4. Prove the virtual display works, then prove teardown — DONE

Stream, screenshot, confirm you get a new extended display at the laptop's
native resolution rather than a downscale of d1's monitors. Then close it and
confirm removal in the host log. Both halves, or it is not done.

### 5. Install Moonlight Hub — DONE, and since rebuilt

`launchers/moonlight-hub.ps1` landed on `main` on 2026-08-04 from the d1
session and is **already parameterized for the laptop**: `$HostPort = 48989`,
1920x1200, with a comment reading "instance 2 (this laptop)". Do not hand-roll
launchers — install this instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\launchers\install-moonlight-hub.ps1
```

It gives a pinned taskbar card with numbered modes: **1 = Extended** (the
`Virtual Display` app, a new 1:1 screen on d1) and **2 = Mirror** (the
`Desktop` app, a downscaled copy of one of d1's 4K panels). It discovers d1's
address by probing the tailnet and caches it, so nothing is hardcoded.

**Gap you must close:** the hub does not set `quitAppAfter` and does not pass
`--quit-after`. Loose end #1 is therefore still required — installing the hub
does not fix the phantom-display problem on its own.

Companion script on the host side: `launchers/pin-apollo-display.ps1` pins an
Apollo instance to a specific physical panel by desktop X coordinate (both of
d1's monitors are identical 4K, so `friendly_name` cannot distinguish them).
That only matters for **Mirror** mode. Extended mode creates a new display and
does not care. It runs elevated **on d1**, not on the laptop.

### 6. Clean up the laptop's Moonlight host list — DONE

Austen's standing requirement (2026-08-04): Moonlight shows exactly three
entries — `d1`, `d2`, `laptop` — and nothing else. *"quit screwing around and
just make it so those three devices [are] the only things that I see."*

If the laptop's list has stale or renamed leftovers, delete every host key
under `HKCU:\Software\Moonlight Game Streaming Project\Moonlight\hosts` with
Moonlight closed, then relaunch and let mDNS rediscover. That is what produced
a clean three-entry list on d2. Names now come from each host's own
`sunshine_name`, so rediscovery yields the correct ones with no local aliasing.

## Decisions already made

Do not re-litigate these.

- **Machine names are lowercase `d1` / `d2` / `laptop`** (Austen, 2026-08-03).
- **Exactly three entries in Moonlight, nothing else** (Austen, 2026-08-04).
  He gave explicit blanket authority for the cleanup: *"You have full autonomy
  to go into my account delete whatever the fuck you need."*
- **Instance names must not mash a machine and a client together.** `d1-laptop`
  was rejected for exactly this: *"it should pick one or the other because
  those two are conflicting things."* The instance on d1 is therefore plain
  `laptop`.
- **Virtual display beats NVIDIA Surround** for the extended-monitor effect.
  Rationale and pixel arithmetic are in the parent doc; Austen was shown it and
  accepted it.
- **60fps on Wi-Fi, 100fps only when wired.** Measured jitter on d2's link
  spikes to 11ms, which blows the 10ms frame budget at 100fps. Re-measure on
  the laptop's own link rather than inheriting this number.

## Gotchas

Things you cannot derive from the code or from the parent runbook.

- **Stream the app named `Virtual Display`, not `Desktop`.** `Desktop` captures
  the host's real monitors, which is the downscale outcome this whole project
  exists to avoid. `Virtual Display` creates a new panel sized to you.
- **`Virtual Display` is invisible to `/api/apps`.** It is an Apollo built-in,
  absent from `apps.json`, so the API returns only `Desktop` and `Steam Big
  Picture` and looks complete. `moonlight list <host> --csv` reveals all three.
  Launching `Desktop` while `Virtual Display` runs also raises a blocking "Are
  you sure you want to quit Virtual Display?" dialog.
- **A stale `srvcert` in the registry survives everything**, including a
  Moonlight uninstall, so `paired=True` can be read from a dead pairing and
  means nothing. Worse, it makes the CLI fail with a misleading error:
  `"serverinfo" request failed with error:
  QNetworkReply::OperationCanceledError`, even while plain HTTP `serverinfo`
  from PowerShell answers instantly. The pinned pre-Apollo certificate is the
  cause. Deleting the host keys and letting mDNS rediscover fixes it. This cost
  real time on d2 — recognise it immediately.
- **Never target d1 by bare IP.** Both Apollo instances share one address, and
  `moonlight pair <ip>` was observed on d2 silently pairing with port `48989`
  instead of `47989` — the wrong instance, with no error. Use the **host name**
  (`pair laptop`) or an explicit **`<ip>:48989`**. A bare IP picks whichever
  instance Moonlight matched first. `moonlight-hub.ps1` is safe here: it always
  passes an explicit port.
- **Quote app names containing spaces when using `Start-Process
  -ArgumentList`.** `'Virtual Display'` as a bare array element arrives split
  and Moonlight fails with `Failed to find application Virtual`. Pass
  `'"Virtual Display"'`.
- **Apollo's API is session-cookie based, not Basic auth.** Basic returns 401
  on every `/api/*` route. `POST /api/login` returns an `auth` cookie; send it
  on subsequent calls. **`POST /api/restart` invalidates the session** — log in
  again after any restart.
- **`GET /api/logs` returns the host's full Apollo log over the network.** It is
  the best remote diagnostic available when you have no shell on the host, and
  it is what proved the teardown fix. Expect noise: the virtual audio sink
  re-inits in a tight loop and dominates the tail.
- **Apollo keeps the binary name `sunshine.exe`.** It looks like a stray
  Sunshine install and has nearly been shut off by mistake once. It is not.
- **Port `47990` is occupied on any machine running Apollo**, so the parent
  runbook's Step 4 port-proxy instructions need a different listen port. d2
  uses `47991`.
- **UAC is the main source of friction.** Anything under `C:\Program
  Files\Apollo\config\` or any `Restart-Service` needs elevation; four separate
  prompts were canceled on d2 on 2026-08-04. Batch every elevated action into
  one prompt and tell Austen a prompt is coming *before* firing it.
- **Do not query processes from Git Bash on these machines** (project
  `CLAUDE.md` → Bash Gotchas). PowerShell only.
- **Moonlight rewrites its settings on exit.** Close it completely before any
  registry edit or the edit is silently discarded. This applies to loose end #1
  and #5 both.

## Related

- `docs/superpowers/specs/2026-08-03-apollo-virtual-display-mesh-handoff.md`
  — the parent record; read it first
- `docs/reference/moonlight-client-setup.md` — the client runbook
- Apollo: <https://github.com/ClassicOldSong/Apollo>
