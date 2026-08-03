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

## Believed done — unverified

- **Step 8 formal verification was never captured.** The runbook wants
  performance-overlay numbers — host processing latency, network latency,
  decode time, render time, dropped-frame percentage — compared against the
  laptop's baseline (2.1ms / 3ms / 0.76ms / 0.59ms / 0.00%). Austen's
  subjective "worked really well" is the only evidence on record. **Run the
  overlay before treating Phase 1 as closed**; a soft decode-time regression
  would be invisible otherwise.
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
   Remaining first-boot steps: Austen sets dashboard credentials at
   `https://localhost:47990` on d1, then d2 and the laptop re-pair
   (d2 via its existing `47991` port proxy, which still points at
   d1:47990 and now lands on Apollo's dashboard).
2. **Get ONE virtual display working office → bedroom.** Apollo auto-creates the
   virtual display at the *client's* native resolution/aspect/refresh, so
   d2's ultrawide should get a 3440x1440 display with zero scaling.
   Prove one before adding a second.
3. **Second Apollo instance on d1 for the laptop.** Required, not
   optional — see Gotchas on the one-display-per-instance limit.
4. **Ethernet.** Austen's gateway has two LAN ports, both occupied. Plan agreed:
   an 8-port unmanaged gigabit switch, with **d1 and d2 on the same
   switch** so their traffic switches locally and never reaches the gateway.
   This is the single largest quality win available and it gates the 100fps
   launcher.
5. **Run the Step 8 overlay pass** and record the numbers (see Believed done).
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
- **Do not query processes from Git Bash on these machines** (project
  `CLAUDE.md` → Bash Gotchas). PowerShell only.

## Related

- `docs/reference/moonlight-client-setup.md` — the client runbook, and the
  document this session executed
- `docs/superpowers/specs/2026-07-19-remote-4090-workstation-laptop-handoff.md`
  — the d1 host build record and open-items ledger
- Apollo: <https://github.com/ClassicOldSong/Apollo>
