# Apollo Virtual Display Mesh — Handoff (2026-08-03)

## Mission

Turn Austen's machines into one workspace: the 4090 workstation does the
compute, and every other screen in the house acts as a genuinely attached
extended monitor of it. Phase 1 (done) built **d2** — the office
machine — into a Moonlight client of **d1**, the 4090, following
`docs/reference/moonlight-client-setup.md`. Phase 2 (next) installs **Apollo**
on d1 so it can serve *virtual* extended displays back out to d2's
ultrawide and the laptop, the same way d2 already serves one to the
laptop today.

Prerequisite runbook: `docs/reference/moonlight-client-setup.md` (commit
`eee7edc913`). Read it first — this handoff records the deltas from it, not a
replacement for it.

### Machine naming used throughout

Lowercase `d1` / `d2` / `laptop`, always — matching the tailnet hostnames.
Austen standardized this 2026-08-03; do not reintroduce `Desktop1`, `D1`, or
any capitalized variant in docs or scripts.

| Name | Role | Notes |
|---|---|---|
| **d1** | The 4090 workstation. Sunshine host. | Two identical 4K monitors (Austen's statement, not independently verified). |
| **d2** | Office machine. RTX 3070 Ti. | Phase 1 subject. Runs Apollo as a host for the laptop AND is now a Moonlight client of d1. |
| **laptop** | Existing Moonlight client. | Consumes a virtual display served by d2's Apollo. |

**This repo is public.** Per the runbook's own policy, no tailnet addresses,
tailnet DNS names, Windows hostnames, SSIDs, or account names appear in this
doc. Every address is discovered at runtime via the runbook's Step 2 (probe
tailnet peers for a listener on port `47989`). Do not add them in a future
edit.

## Done — verified

All on `main`. Note that **Phase 1 produced no repository changes** — it was
machine configuration on d2, so there are no code commits to cite. The
evidence is command output, reproduced here because it is not recoverable from
git.

1. **Tailscale + Moonlight installed on d2.**
   `winget` reported `Successfully installed` for Tailscale `1.98.10` and
   Moonlight `6.1.0.0`. Confirmed on disk:
   `Test-Path "C:\Program Files\Moonlight Game Streaming\Moonlight.exe"` → `True`.

2. **d2 joined the tailnet, node name pinned.**
   `tailscale set --hostname=desktop2` applied. `tailscale status` lists the
   node plus two peers.

3. **d1 discovered by port fingerprint, not by guessing.**
   Peer probe on `47989` returned `True` for exactly one peer. Full port set
   verified — `47984`, `47989`, `47990`, `48010`, `3389` all `True`.

4. **Network path is direct, not DERP.**
   `tailscale ping` → `pong ... via 192.168.x.x:41641 in 2ms`. A private-LAN
   endpoint in the reply is the proof it is not relayed.

5. **Sunshine dashboard proxied to localhost — on port 47991, not 47990.**
   `netsh interface portproxy show v4tov4` shows one entry,
   `127.0.0.1:47991 → <d1>:47990`. `Invoke-WebRequest https://127.0.0.1:47991`
   returns **401 Unauthorized**, which is the dashboard answering and demanding
   Basic auth. See Gotchas for why 47990 was unavailable.

6. **Pairing completed.** PIN `5923` entered via the proxied dashboard.
   Verified by reading the app list back out of the registry —
   `HKCU:\Software\Moonlight Game Streaming Project\Moonlight\hosts\<n>\apps`
   returned `Desktop` and `Steam Big Picture`, exactly what the runbook
   predicts. That list can only be populated from a paired session.

7. **Step 6 settings applied**, readback confirmed:
   `width=3440 height=1440 fps=60 bitrate=40000 quitAppAfter=false
   keepawake=true hostaudio=false mouseacceleration=false videocfg=0 videodec=0`.

8. **Three launchers written to d2's Desktop** (filenames predate the
   lowercase naming; they are literally named this on disk):
   `Stream Desktop1 (LAN ultrawide).cmd` (3440x1440@60, AV1, 40 Mbps),
   `Stream Desktop1 (Wired 100fps).cmd` (3440x1440@100, AV1, 50 Mbps),
   `Stream Desktop1 (Away).cmd` (2560x1080@60, HEVC, 5 Mbps).

9. **Display corrected 50Hz → 100Hz.** `ChangeDisplaySettingsEx` returned `0`;
   re-query confirmed `3440x1440 @ 100Hz` where it previously read `@ 50Hz`.

10. **AV1 hardware decode confirmed end to end.** d2's GPU is an
    RTX 3070 Ti (GA104), which has a hardware AV1 decoder; d1's 4090 (Ada)
    has an AV1 *encoder*. Ampere cannot encode AV1, which does not matter — the
    client only decodes.

11. **Wi-Fi characterized.** 40 ICMP samples to d1 over the LAN:
    `avg 1.38ms / min 0 / max 11 / stddev 1.84`. Adapter is
    `Intel Wireless-AC 9260`, 802.11ac, 5 GHz, 90% signal, 780/867 Mbps link.

12. **Austen confirmed the stream is good.** Verbatim (2026-08-03): *"that
    worked really really well the extended display was exactly what I needed."*

13. **Apollo installed on d1** (2026-08-03, later session, Austen's
    explicit "do it!"). Apollo v0.4.6 from the official GitHub release,
    silent NSIS install. Verified: `ApolloService` Running/Automatic;
    `SunshineService` Stopped/Disabled; listener on 47984/47989/47990/48010 is
    `C:\Program Files\Apollo\Sunshine.exe`; SudoMaker Virtual Display Adapter
    present with Status OK; Apollo firewall rules Enabled, old Sunshine rules
    disabled. Dashboard on `https://localhost:47990` returns 200 with the
    first-run credential-setup page. **Consequences:** Apollo generated a
    fresh CA (`config\credentials\cacert.pem`), so every client paired against
    the old Sunshine host (d2, laptop) must pair again; and the
    dashboard has no credentials until Austen sets them at the host.

14. **Instance names fixed at the source, and d2's host list cleaned to three**
    (2026-08-04, from d2). Austen: *"there should only be three devices ...
    d1 ... d2 ... laptop ... those are the only three devices."*
    - d1 runs **two** Apollo instances: the primary on port base `47989`, and a
      second on port base `48989` (offset +1000) created to serve the laptop.
      The second one was named `d1-laptop`, which reads as two conflicting
      machines in every client's host list.
    - Renamed via each instance's own `sunshine_name`, so the fix propagates to
      every client instead of being a per-client alias: primary → `d1`,
      second → `laptop`. Verified by reading each instance's `serverinfo` back:
      `<hostname>d1</hostname>` on `47989`, `<hostname>laptop</hostname>` on
      `48989`.
    - Deleted every Moonlight host entry on d2 (they carried stale
      pre-Apollo `srvcert` values) and let mDNS rediscover. Result: exactly
      three entries — `d1`, `d2`, `laptop`.
    - d2's own instance still has `sunshine_name = D2` in its
      `sunshine.conf`; it is aliased to `d2` in d2's Moonlight
      (`customname = true`) because three separate UAC prompts to edit
      `C:\Program Files\Apollo\config\` were canceled. Cosmetic, and only on
      other clients' host lists.

15. **d2 re-paired with d1's Apollo** (2026-08-04). Handshake completed
    getservercert → clientchallenge → serverchallengeresp → clientpairingsecret
    → HTTPS pairchallenge. Verified from both ends: d1's
    `/api/clients/list` lists a named cert `d2`, and d2's Moonlight registry
    shows 3 apps under the `d1` host.

16. **Virtual display enabled for the d2 client** on d1's primary Apollo —
    `always_use_virtual_display: true`, `display_mode: "3440x1440x120"` — and
    **proven end to end** (2026-08-04). Phase 2's goal is met: d2's ultrawide
    is a genuinely attached 3440x1440 extended display of d1, 1:1, no scaling.
    d1's own Apollo log for the run:
    ```
    Display mode for client [d2] overriden to [3440x1440x120]
    Virtual Display created at \\.\DISPLAY11
    Capture size       : 3440x1440
    Desktop resolution [3440x1440]
    Virtual Display removed successfully
    ```
    Client side: `Video stream is 3440x1440x60`, AV1, D3D11VA hardware decode.
    A screenshot of d2's panel shows d1's wallpaper and taskbar on an empty
    extended desktop filling the ultrawide.

    **Step 8 overlay captured** (closes the long-open loose end). Idle desktop,
    Wi-Fi, 40 Mbps AV1. Frame rate reads 37.44 because Apollo only sends frames
    on change — that is an idle desktop, not a shortfall.

    | Metric | d2 (this run) | laptop baseline |
    |---|---|---|
    | Host processing latency (avg) | 3.7 ms (min 3.4 / max 6.8) | 2.1 ms |
    | Network latency | 1 ms (variance 0) | 3 ms |
    | Decode time | 0.21 ms | 0.76 ms |
    | Render time (incl. V-sync) | 0.04 ms | 0.59 ms |
    | Frames dropped — network | 0.00% | 0.00% |
    | Frames dropped — jitter | 0.00% | — |

    Better than baseline everywhere except host processing latency, which is
    higher because d1 is encoding a 3440x1440 virtual display rather than
    capturing an existing panel. No regression hiding behind the subjective
    "worked really well" from Phase 1.

17. **Virtual-display teardown solved, and the earlier diagnosis corrected.**
    d1 and d2 behave identically; the difference was the *client*. Apollo
    pauses a session on disconnect and holds the display for resume — only
    terminating the app reclaims it. Setting `quitAppAfter = true` in d2's
    Moonlight makes a normal window close terminate it, verified in d1's log
    (`CLIENT DISCONNECTED` → `Session pausing` → `Virtual Display removed
    successfully`, 79 ms). Full explanation in Gotchas.

18. **d2's stream launchers rewritten and tested.** Two fixes:
    - Target the host by name (`stream d1`) instead of by IP. An IP is
      genuinely ambiguous now that two Apollo instances share d1's address: a
      pair attempt against the raw IP was observed going to port `48989` (the
      `laptop` instance) instead of `47989`.
    - **Stream the `Virtual Display` app, not `Desktop`.** The old launchers
      said `Desktop`, which captures d1's existing monitors — the exact
      downscale-of-two-4K-panels outcome Phase 2 exists to avoid.
    Files renamed `Stream Desktop1 (...)` → `Stream d1 (...)`. The LAN
    ultrawide launcher was executed and screenshotted, not just written.

## Believed done — unverified

- ~~**Step 8 formal verification was never captured.**~~ **CAPTURED
  2026-08-04** — numbers in Done item 16. No decode-time regression; decode is
  in fact 3.6x faster than the laptop baseline.
- **d1's monitors are two identical 4K panels** — Austen's statement
  (2026-08-03), not independently verified. All the pixel arithmetic under
  Decisions depends on it. Confirm before acting on it.
- **d1's network link type is unknown.** Never checked whether it is on
  Ethernet or Wi-Fi. Matters for the switch plan.
- **d2's Apollo → laptop path** was pre-existing and worked before this
  session. Not tested by this session; do not assume this session's changes
  left it intact.

## In flight

Nothing. No branch, no worktree, no uncommitted work belonging to this task.

`.claude/settings.local.json` shows modified in `git status` but **belongs to
another session** — it was already dirty at the start of this one. It was
deliberately excluded from this handoff's commit. Leave it alone.

## Loose ends (ranked)

1. ~~**Install Apollo on d1.**~~ **DONE 2026-08-03** — see Done item 13.
   Credentials are set on BOTH instances (2026-08-04, from d1): instance 2 was
   seeded with instance 1's `username`/`salt`/`password` hashes only — identity
   was NOT copied, Apollo2 generated its own `uniqueid`/certs. One login works
   for both dashboards, confirmed from d2.
   **d2 paired 2026-08-04** (Done item 15). **The laptop has not** — Apollo's
   fresh CA invalidated its old pairing too. Its handoff is
   `docs/superpowers/specs/2026-08-04-laptop-apollo-client-handoff.md`.

   > A d1-authored version of this entry said "instance 1 has ZERO paired
   > devices" as of 2026-08-04. That was true when written and is now stale —
   > `/api/clients/list` on instance 1 returns a named cert `d2`.

2. ~~**Get ONE virtual display working office → bedroom.**~~ **DONE and proven
   2026-08-04** — Done item 16. Teardown is clean once the client sets
   `quitAppAfter` (Done item 17).
3. ~~**Second Apollo instance on d1 for the laptop.**~~ **DONE 2026-08-03**,
   and renamed `d1-laptop` → `laptop` on 2026-08-04 (Done item 14).
   Built on d1 as a full directory clone: `C:\Program Files\Apollo2`, service
   `Apollo2Service` (auto-start), `port = 48989` (so TCP
   48984/48989/48990/49010, UDP 48998-49010), own firewall rule, fresh identity
   (state + credentials deleted from the clone per Apollo discussion #325 —
   never copy them). Verified: both instances listening simultaneously,
   instance 2 dashboard 200 on `https://localhost:48990`, and reachable
   directly from d2 over the tailnet on 48990 with no port proxy needed.
   **The gotcha that broke its first start:** Apollo's service wrapper
   (`tools\sunshinesvc.exe`) hardcodes its log to `%TEMP%\sunshine.log`
   (`C:\Windows\Temp` for services) with write-exclusive sharing, so a second
   wrapper dies with a sharing violation. Fix: per-service environment —
   `HKLM\SYSTEM\CurrentControlSet\Services\Apollo2Service\Environment`
   (REG_MULTI_SZ) sets `TMP`/`TEMP` to `C:\Program Files\Apollo2\svctemp`.
   **Apollo updates must now be applied to BOTH directories.**
   Still untested end to end; the laptop has to pair with it.
3a. **Arrange the two virtual displays on d1** once both clients stream. They
   land on d1's desktop; put them side by side in d1's Windows display settings
   to match the office desk layout. Input unifies on d1 — drive both halves
   from d2's mouse, with the laptop as a passive pane.
4. **Ethernet.** Austen's gateway has two LAN ports, both occupied. Plan agreed:
   an 8-port unmanaged gigabit switch, with **d1 and d2 on the same
   switch** so their traffic switches locally and never reaches the gateway.
   This is the single largest quality win available and it gates the 100fps
   launcher.
5. ~~**Run the Step 8 overlay pass**~~ **DONE 2026-08-04** — table in Done
   item 16. Worth re-running once d1 and d2 are both on the switch, to see
   whether host processing latency drops and 100fps becomes viable.
5a. ~~**Rename d2's own Apollo instance from `D2` to `d2`.**~~ **DONE
   2026-08-04** — `sunshine_name = d2` in d2's `sunshine.conf`, service
   restarted.
5b. **Set `quitAppAfter = true` in the LAPTOP's Moonlight.** Highest-value
   remaining item and the direct cause of the stranded display on d2. Done on
   d2 already; the laptop is the one still stranding displays. See Gotchas.
5c. **The laptop still has to re-pair** — with the `laptop` instance on d1
   (port base `48989`) and/or with d2, depending on which host it should use
   now that d1 serves a dedicated instance. Untested this session.
5d. **d2's Apollo dashboard password is NOT the same as d1's.** Its
   `sunshine_state.json` shows username `austen`; neither that nor
   `austencloud` with d1's password authenticates. Unknown, and it blocks
   API-driven fixes on d2 (e.g. closing a paused session without elevation).
6. **Amend `docs/reference/moonlight-client-setup.md`.** Its Step 4 assumes port
   `47990` is free on the client. That is false whenever the client runs
   Sunshine or Apollo, which is now normal in this house. The doc should carry
   the "pick a free port" variant and the reason. Real gap; it cost time today.
7. **Decide the fate of the `47991` port proxy.** It persists across reboots and
   is currently the only route to d1's dashboard from d2. Keep it,
   but it is undocumented outside this handoff.

## Decisions already made

Do not re-litigate these.

- **Virtual display beats NVIDIA Surround for the two-monitor effect.** Two 4K
  panels side by side is 7680x2160 = 16.6M pixels; d2's ultrawide is
  3440x1440 = 4.95M. That is 3.35x more pixels than the panel can show, landing
  each host monitor at 1720x967 — a 0.45x scale factor at which text is
  illegible. A virtual display sized to the client is 1:1 instead. Austen was
  shown this arithmetic and accepted it.
- **60fps on Wi-Fi, 100fps only when wired.** Measured jitter spikes to 11ms.
  At 100fps the frame budget is 10ms, so an 11ms spike drops a frame; at 60fps
  the 16.7ms budget absorbs it. Counterintuitive but measured: on this link,
  60fps looks *smoother* than 100. The wired launcher exists for after the
  switch lands.
- **Switch, not a splitter.** A passive RJ45 "Ethernet splitter" caps at
  100 Mbps and needs a matching unit at both ends. Unmanaged gigabit switch,
  plug-and-play, DHCP still from the gateway. Never uplink the switch to the
  gateway twice — that is a loop.
- **Do NOT chain laptop → d2 → d1** (Austen asked, 2026-08-03). Each client
  pairs straight to its own d1 instance; the split-screen unification happens
  on d1's desktop, not between clients. Chaining double-encodes the laptop pane
  and nests input capture. This settles which host the laptop uses: **d1's
  `laptop` instance, not d2.**
- **d2's Apollo install stays untouched.** It was mistaken early in the
  session for a stray Sunshine install and nearly shut off. It is deliberate and
  serves the laptop.
- **Refresh rate 50Hz → 100Hz on d2** — Austen approved (2026-08-03).
- **Launchers target 3440x1440**, not the runbook's 3840x2160. That value is the
  laptop's panel; d2 is a 21:9 ultrawide.

## Gotchas

Things the next agent cannot derive from the code or the runbook.

- **Port 47990 is occupied on d2 by Apollo.** Apollo is a Sunshine fork
  and *keeps the binary name `sunshine.exe`*, which is actively misleading —
  it looks like a stray Sunshine install. The runbook's Step 4 port proxy must
  therefore listen on **47991**. Sunshine's origin check passes on a non-standard
  port because the browser still sends a `localhost` Host header.
- **Moonlight defaults to 1280x720 when its registry values are unset.** This
  was the session's biggest red herring: the first stream looked like garbage on
  the ultrawide and was misread as an aspect-ratio problem. It was a 2.7x upscale
  from 720p. The log line `SDL Info (0): Video stream is 1280x720x60` is the
  tell. **Always apply Step 6 before judging image quality.**
- **Moonlight rewrites its settings on exit.** Close it completely before any
  registry edit or the edit is silently discarded.
- **A stale `srvcert` in the registry survives uninstalling Moonlight**, so
  `paired=True` can be read from a previous install and means nothing. The
  trustworthy signal is a populated `apps` subkey.
- **The pairing prompt is misleading.** Moonlight says *"Please enter '<PIN>' on
  <HOSTNAME>"*, which reads as "go walk to the other machine." The PIN actually
  goes into the *proxied dashboard tab on the client*. Austen hit this; say it
  plainly up front.
- **UAC prompts are the main source of friction on d2.** Several
  elevation requests were declined or timed out (`winget` exit 1602, and
  `Start-Process -Verb RunAs` reporting "operation was canceled by the user").
  Tell Austen a prompt is coming *before* firing it.
- **Long `netsh` commands wrap when pasted into PowerShell** and the tail
  becomes a second command (`connectport=47990 : The term ... is not
  recognized`). Give commands short enough not to wrap, and remember a
  successful `netsh portproxy add` prints nothing at all.
- **One Apollo instance serves exactly one virtual display.** A second client
  gets the display replaced rather than added, and Windows still sees only one
  extra monitor — [Apollo #874](https://github.com/ClassicOldSong/Apollo/issues/874),
  [#1198](https://github.com/ClassicOldSong/Apollo/issues/1198). Multiple
  instances with separate configs is the documented workaround.
- **One Moonlight instance cannot drive multiple monitors** —
  [moonlight-qt#1904](https://github.com/moonlight-stream/moonlight-qt/issues/1904),
  open. But *two* Moonlight instances against *two* Apollo instances does work
  ([Apollo #325](https://github.com/ClassicOldSong/Apollo/discussions/325)).
  Do not repeat this session's initial error of calling it impossible.
- **spacedesk and Deskreen extend to multiple clients from a single instance**,
  which Apollo cannot. That is the fallback if two Apollo instances prove
  unmanageable; the cost is a less tuned video pipeline and more input lag.
- **The phantom virtual display is a CLIENT setting, not an Apollo bug.**
  This was misdiagnosed twice on 2026-08-04 before the logs settled it. On
  client disconnect Apollo logs `Session pausing for app [...]` and
  deliberately holds the virtual display open so the client can resume. It is
  never reclaimed until the app is *terminated*. Windows then parks windows on
  the orphaned monitor, which reads as "my display settings are stuck."

  What terminates it: `moonlight quit <host>`, or Moonlight's **"quit app
  after ending stream"** (`quitAppAfter`), which makes a normal window close
  do it. Proven on d2 2026-08-04 — with `quitAppAfter = true`, closing the
  stream window produced
  `CLIENT DISCONNECTED` → `Session pausing` → `Virtual Display removed
  successfully` 79 ms later. **Every Moonlight client in the house should have
  `quitAppAfter = true`** (registry
  `HKCU:\Software\Moonlight Game Streaming Project\Moonlight`; close Moonlight
  first, it rewrites on exit). Set on d2; **the laptop still has it off**,
  which is what stranded the `Generic Monitor (lap)` display on d2 twice.

  To clear one that is already stuck without the client: `Restart-Service
  ApolloService` (needs elevation). Verify with
  `[System.Windows.Forms.Screen]::AllScreens` and
  `Get-PnpDevice -Class Monitor`. The stale entries accumulate one UID per
  cycle (`...&UID256/257/258/259`), all `Unknown` except the live one — a
  quick tell for how many times it has happened.
- **Two Apollo instances on one machine make an IP a useless target.** d1 hosts
  both `47989` and `48989`. `moonlight pair <ip>` was observed picking `48989`
  and pairing with the wrong instance. **Target hosts by name**
  (`moonlight pair d1`, `moonlight stream d1 Desktop`) — the CLI accepts
  "computer name, UUID, or IP address" and the name is the only unambiguous
  one.
- **A stale `srvcert` makes the CLI fail with a misleading error.** Before the
  host entries were deleted, `moonlight pair` died on
  `"serverinfo" request failed with error: QNetworkReply::OperationCanceledError`
  while plain HTTP `serverinfo` from PowerShell answered instantly. The pinned
  pre-Apollo certificate was the cause. Deleting
  `HKCU:\...\Moonlight\hosts\*` and letting mDNS rediscover fixed it.
- **The app you want is `Virtual Display`, and it is invisible to
  `/api/apps`.** Apollo ships it as a built-in, so it is absent from
  `apps.json` and from the `/api/apps` response — that response lists only
  `Desktop` and `Steam Big Picture` and looks complete. `moonlight list d1 --csv`
  reveals all three. Streaming `Desktop` captures d1's real monitors (the
  downscale outcome Phase 2 exists to avoid); `Virtual Display` creates the
  new extended panel. Launching `Desktop` while `Virtual Display` runs also
  triggers a blocking "Are you sure you want to quit Virtual Display?" prompt.
- **Quote app names with spaces when using `Start-Process -ArgumentList`.**
  `'Virtual Display'` as a bare array element arrives split, and Moonlight
  fails with `Failed to find application Virtual`. Pass `'"Virtual Display"'`.
- **`GET /api/logs` returns d1's full Apollo log over the network** — the best
  remote diagnostic available from another machine, since there is no shell on
  d1. It is what proved virtual-display create/remove. Expect noise: the
  virtual audio sink re-inits in a tight loop and dominates the tail.
- **Apollo's dashboard API is session-cookie based, not Basic auth.** Basic
  returns 401 on every `/api/*` route. `POST /api/login` with
  `{"username","password"}` returns an `auth` cookie; send that cookie on
  subsequent calls. **`POST /api/restart` invalidates the session**, so
  re-login after any restart. Handy routes: `/api/config` (GET returns only
  non-default keys — POST back the whole object minus
  `platform`/`status`/`version`/`vdisplayStatus`), `/api/clients/list`,
  `/api/clients/update`, `/api/pin`.
- **`POST /api/pin` returns `{"status":false}` when no pairing request is
  pending.** That is not an error — it means the client has not called yet.
  Launch the client's pair command first, then poll the PIN endpoint.
- **UAC on d2 is the recurring blocker, still.** Three separate elevation
  prompts were canceled on 2026-08-04. Anything under
  `C:\Program Files\Apollo\config\` or `Restart-Service` needs it. Batch every
  elevated action into one prompt and tell Austen before firing it.
- **Do not query processes from Git Bash on these machines** (project
  `CLAUDE.md` → Bash Gotchas). PowerShell only.

## Related

- `docs/reference/moonlight-client-setup.md` — the client runbook, and the
  document this session executed
- `docs/superpowers/specs/2026-07-19-remote-4090-workstation-laptop-handoff.md`
  — the d1 host build record and open-items ledger
- Apollo: <https://github.com/ClassicOldSong/Apollo>
