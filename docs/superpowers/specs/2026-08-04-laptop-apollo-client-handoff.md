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

- **The `laptop` Apollo instance on d1 has never been used by anyone.** It was
  found already running on 2026-08-04 at port base `48989`, answering on
  `48984/48989/48990/49010` over the tailnet, and its dashboard accepts the
  same credentials as d1's primary. Nobody has streamed from it. Its
  virtual-display behaviour, resolution handling, and whether it collides with
  the primary instance when both are live are all **unknown**. You are the
  first to find out.
- **Nothing on the laptop itself has been inspected this session.** Its
  Moonlight version, settings, pairing state, and host list are all assumed,
  not observed. Verify before changing anything.
- **Whether the laptop should use d1's `laptop` instance or keep using d2** is
  undecided. See Loose end #2.

## In flight

Nothing. No branch, no worktree, no uncommitted work. All three commits are on
`main` and pushed: `f3a096205f`, `9ddcf8c4bf`, `6e592a490d`.

## Loose ends (ranked)

### 1. Set `quitAppAfter = true` in the laptop's Moonlight — START HERE

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

### 2. Decide and confirm which host the laptop uses

d1 now has an instance named `laptop` dedicated to you. d2 also still serves
you. Both cannot own your display sensibly. **Ask Austen which he wants**
before pairing — this is a genuine either/or, not something to infer:

- **d1's `laptop` instance** — puts your screen on the 4090, consistent with
  the mesh's whole point, and it is why the instance exists. Untested.
- **Keep d2** — known-working today, but d2 is itself a client of d1, so you
  would be a client of a client.

Whichever he picks, the other should stop being used, not left as a silent
second option.

### 3. Re-pair

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

### 4. Prove the virtual display works, then prove teardown

Stream, screenshot, confirm you get a new extended display at the laptop's
native resolution rather than a downscale of d1's monitors. Then close it and
confirm removal in the host log. Both halves, or it is not done.

### 5. Clean up the laptop's Moonlight host list

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
- **Never target d1 by IP.** Both Apollo instances share one address, and
  `moonlight pair <ip>` was observed silently pairing with port `48989`
  instead of `47989`. Target by **name** — the CLI accepts "computer name,
  UUID, or IP address" and only the name is unambiguous.
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
