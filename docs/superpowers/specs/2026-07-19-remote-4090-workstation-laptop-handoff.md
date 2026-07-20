# Remote 4090 Workstation Laptop Completion — Handoff (2026-07-19)

## Mission

Finish the laptop side of Austen's private remote-work setup so he can work from his girlfriend's home while the applications and compute remain on `DESKTOP-TJLLGPG`. The desktop is a Ryzen 9 7950X, RTX 4090, 127 GiB Windows 11 Pro host. The chosen stack is Tailscale for private transport, Sunshine/Moonlight for the responsive full desktop, VS Code Remote Tunnels for development without streaming the Windows GUI, RDP for boot and recovery, and RustDesk as an independent fallback. There is no separate design spec. This document is the operating spec and evidence ledger.

## Done — verified

The items in this section are Windows host configuration, so their repository commit is `N/A`. They live outside Git. The only repository change from this session is this handoff document.

### Desktop identity and hardware

- Host: `DESKTOP-TJLLGPG`
- OS: Windows 11 Pro `10.0.26100`
- CPU: AMD Ryzen 9 7950X, 16 cores and 32 logical processors
- Memory: 127 GiB reported by Windows
- GPUs: NVIDIA GeForce RTX 4090 plus AMD integrated graphics
- Network: wired Ethernet at 1 Gbps
- Displays: two LG HDR 4K displays; Sunshine reports the primary display at 3840x2160
- Evidence captured 2026-07-19 20:36 CDT: `Get-CimInstance Win32_Processor`, `Win32_ComputerSystem`, `Win32_VideoController`, `Win32_OperatingSystem`, and `Get-NetAdapter` returned the values above.

### Tailscale private transport

- Tailscale `1.98.9` is installed.
- The Windows service is `Running` with `StartMode=Auto`.
- Unattended mode was reasserted with `tailscale up --unattended=true`; exit code was `0` on 2026-07-19.
- The node is online as `desktop-tjllgpg.tailcc2921.ts.net`.
- Tailnet IPv4: `100.75.226.74`
- Tailnet IPv6: `fd7a:115c:a1e0::9401:e2db`
- Node key expiry: `2027-01-16T00:11:17Z`
- Evidence: `tailscale status --json` returned `BackendState=Running`, `Self.Online=true`, the names and addresses above, and the expiry timestamp.

### Tailnet-only firewall boundary

- Custom inbound rules are enabled for RDP TCP/UDP `3389`, Sunshine TCP `47984,47989,48010`, and Sunshine UDP `47998-48010`.
- Every custom rule is limited to Tailscale address space: `100.64.0.0/10` and `fd7a:115c:a1e0::/48`.
- The broad built-in Remote Desktop rules are disabled.
- Both broad Sunshine installer rules are disabled.
- Sunshine's admin page on TCP `47990` is intentionally not exposed through the custom tailnet firewall rules.
- Evidence: `Get-NetFirewallRule`, `Get-NetFirewallPortFilter`, and `Get-NetFirewallAddressFilter` returned the four enabled `TKA ... (Tailscale only)` rules and showed all five broad rules as `Enabled=False`.

### Sunshine and RTX 4090 streaming host

- Sunshine `2026.516.143833` is installed from the signed LizardByte Windows MSI.
- `SunshineService` is `Running` with `StartMode=Auto`.
- The local administration page is `https://localhost:47990` and has credentials configured. Austen confirmed dashboard access. Do not store or request those credentials.
- The post-restart Sunshine log dated 2026-07-19 20:15 CDT reports both LG HDR 4K displays, NVIDIA GeForce RTX 4090 capture at 3840x2160, and working `h264_nvenc`, `hevc_nvenc`, and `av1_nvenc` encoders.
- Tailnet TCP probes to `100.75.226.74` on `47984`, `47989`, and `48010` all returned `True`.
- Credential state exists at `C:\Program Files\Sunshine\config\sunshine_state.json`; only its existence and metadata were inspected.
- Evidence: the current startup section of `C:\Program Files\Sunshine\config\sunshine.log`, `Get-Service SunshineService`, and `Test-NetConnection` produced the results above.

### Controller support

- ViGEmBus `1.21.442` is installed, Microsoft-signed, registered at `C:\Windows\System32\drivers\ViGEmBus.sys`, and running with system start mode.
- Sunshine was restarted after ViGEmBus installation. The current Sunshine startup section no longer contains the old missing-ViGEm fatal message.
- Evidence: `Get-CimInstance Win32_SystemDriver -Filter "Name='ViGEmBus'"` returned `State=Running` and `StartMode=System`; `pnputil /enum-drivers` reported signer `Microsoft Windows Hardware Compatibility Publisher`.

### RDP recovery path

- Remote Desktop is enabled and listening on TCP `3389`.
- Network Level Authentication is enabled.
- The tailnet probe to `100.75.226.74:3389` returned `True`.
- Austen set a password on the local Windows account `Austen` at 2026-07-19 20:25 CDT. The password itself was never read or recorded.
- Evidence: the Terminal Server registry values returned `fDenyTSConnections=0` and `UserAuthentication=1`; `Get-NetTCPConnection` found the listener; `Get-LocalUser Austen` returned `PasswordLastSet=2026-07-19 20:25:25 CDT`.

### VS Code Remote Tunnel

- VS Code `1.106.1` is authenticated with Austen's GitHub account.
- Austen explicitly authorized acceptance of the VS Code Server license terms on 2026-07-19.
- The tunnel service is installed under the name `austen-4090-desktop`.
- `code tunnel status --log error` returned `tunnel=Connected`, `service_installed=true`, `last_disconnected_at=null`, and `last_fail_reason=null`.
- `C:\Users\Austen\.vscode\cli\tunnel-service.log` reports a successful Microsoft Dev Tunnels SSH handshake, an established host relay session, and `Visual Studio Code Server is listening for incoming connections`.
- The Windows implementation registered `Visual Studio Code Tunnel` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- Direct web entry for the repo: `https://vscode.dev/tunnel/austen-4090-desktop/e:/tka-platform`
- Evidence: `code tunnel user show`, `code tunnel status`, the tunnel log, and the HKCU Run value returned the results above.

### Power, wake, bandwidth protection, and fallback

- Active Windows power plan: High performance.
- AC sleep and hibernate timeouts both report `0x00000000`, meaning disabled.
- Realtek adapter settings `Wake on Magic Packet` and `Shutdown Wake-On-Lan` are enabled.
- qBittorrent's alternative remote-work profile is enabled with `AlternativeGlobalUPSpeedLimit=128` KiB/s and protocol overhead included. Its normal global limit remains `0`, so the turtle/alternative-speed toggle is the reversible boundary.
- RustDesk `1.4.9+67` is running and its Authenticode signature is valid. A Startup shortcut launches it with `--tray` after Austen signs in.
- Google Drive is running again with two `GoogleDriveFS` processes. Do not suspend its processes; see Gotchas.
- Current network sample on 2026-07-19: wired 1 Gbps, eight pings to `1.1.1.1`, 0 loss, 15 ms minimum, 32.4 ms average, 79 ms maximum.
- Current ISP identification: `AS21928 T-Mobile USA, Inc.` from `https://ipinfo.io/org`.
- Evidence: `powercfg`, `Get-NetAdapterAdvancedProperty`, selected qBittorrent INI lines, RustDesk process/signature/shortcut queries, process queries, `Test-Connection`, and `curl.exe https://ipinfo.io/org`.

### Reproducibility artifacts on the desktop

- `C:\Users\Austen\Desktop\TKA-Remote-Host-Setup.ps1`
- `C:\Users\Austen\Desktop\Finish TKA Remote Setup.cmd`
- `C:\Users\Austen\Desktop\TKA-Remote-Host-Setup.log`
- The transcript ends with `TKA remote host installation completed.` at 2026-07-19 19:51 CDT.
- These files are outside the repository. They are repair evidence, not instructions to rerun the setup blindly.

## Believed done — unverified

- The Sunshine username/password is usable beyond the dashboard session Austen opened. The state file exists and the dashboard opened, but no automated credential test was performed because credentials must not enter logs or chat.
- The qBittorrent cap is persisted in its INI and was observed live earlier in the setup session. It has not been verified against a sustained Moonlight stream because no laptop stream exists yet.
- Wake-on-LAN is enabled at the NIC level. A real wake from shutdown or sleep has not been tested, and there is no proven always-on tailnet peer that could deliver a wake packet after this PC is offline.
- RDP configuration and reachability are verified, but the new Windows password has not been used in an end-to-end remote login test.
- Sunshine input, audio, dual-monitor selection, and controller behavior have not been tested from Moonlight.
- No post-reboot recovery drill has been performed.

## In flight

- Current branch is `main`. Immediately before this handoff was created, `main` and `origin/main` were aligned at `acf4a537e2bc77d0d0bc0ec83a51079fe96fa42f`.
- This session's only repository file is this handoff. It must be committed and pushed with this exact path only.
- The shared checkout contains a large number of staged, modified, deleted, and untracked files owned by other sessions. Do not stage, unstage, revert, commit, rename, or clean any of them. Use an explicit pathspec for every commit.
- No laptop-side installation has started in this session because the tools are operating on the desktop.

## Loose ends (ranked)

### 1. Install the laptop clients

On the laptop, install Tailscale and Moonlight from their official sites. Do not install Sunshine on the laptop.

- Tailscale: sign into the same tailnet account as the desktop.
- Moonlight: no shared Sunshine account is involved. Moonlight uses a device-specific pairing.
- If VS Code is needed, install VS Code and sign into the same GitHub account used by the desktop tunnel.

Official references:

- Tailscale downloads: `https://tailscale.com/download`
- Moonlight downloads: `https://moonlight-stream.org/`
- Sunshine pairing: `https://github.com/LizardByte/Sunshine/blob/master/docs/getting_started.md`
- VS Code Remote Tunnels: `https://code.visualstudio.com/docs/remote/tunnels`

### 2. Prove the Tailscale path is direct from an external network

Connect the laptop through the girlfriend's network or a phone hotspot, not the desktop's home LAN. Run:

```powershell
tailscale ping desktop-tjllgpg
tailscale netcheck
```

Success means the final ping uses a direct IP-and-port path. A persistent `via DERP(...)` result is not good enough for Moonlight streaming. Record the latency and whether the route becomes direct. Do not expose router ports as the first response to a relay result. Tailscale's connection-type reference is `https://tailscale.com/docs/reference/connection-types`.

### 3. Pair Moonlight with Sunshine

1. In Moonlight, add the PC manually as `100.75.226.74`.
2. Select the desktop entry to obtain the four-digit pairing PIN.
3. On the desktop's Sunshine dashboard, open **PIN**, enter the PIN, and name the client `Austen Laptop` or another clear device name.
4. Do not enter the Sunshine dashboard username/password into Moonlight.

Pair while physically at the desktop if possible. If pairing must happen remotely, use the already-configured RustDesk console session to reach `https://localhost:47990`. The Sunshine web administration port is deliberately not exposed through the tailnet firewall.

### 4. Start with a conservative Moonlight profile and measure

Initial client profile:

- 1920x1080
- 60 FPS
- 5 Mbps
- HEVC when the laptop has hardware HEVC decoding
- HDR off
- Frame pacing on
- Performance statistics overlay on during testing

Run a real desktop session and record network latency, host processing latency, decode latency, dropped frames, audio behavior, mouse/keyboard behavior, and controller input. Raise bitrate only after the external path is stable. Use VS Code Tunnel or RDP for text-heavy work if the video path is unstable.

### 5. Prove the no-GUI development path

On the laptop:

1. Open `https://vscode.dev/tunnel/austen-4090-desktop/e:/tka-platform`, or run **Remote Tunnels: Connect to Tunnel** from desktop VS Code.
2. Select `austen-4090-desktop`.
3. Open `E:\tka-platform`.
4. Prove a terminal command executes on `DESKTOP-TJLLGPG` and that the repo files come from the desktop.

All source, terminals, extensions, builds, and Codex work should execute on the host. The laptop is the interface.

### 6. Test RDP as the boot door

From the laptop, connect to `100.75.226.74` with username `DESKTOP-TJLLGPG\Austen` and the Windows password Austen set locally. Confirm Network Level Authentication succeeds. RDP is the recovery path after reboot, not the preferred Sunshine streaming session.

### 7. Run a controlled reboot recovery drill

Do this only while someone can physically recover the desktop:

1. Reboot the desktop.
2. Confirm Tailscale comes online before user login.
3. Confirm RDP reaches the Windows sign-in screen through the tailnet.
4. Sign in as Austen.
5. Confirm the VS Code tunnel and RustDesk start after sign-in.
6. Confirm Sunshine is available and Moonlight reconnects.

The VS Code tunnel and portable RustDesk are user-startup items. They do not provide pre-login access. Tailscale, Sunshine, and RDP are the pre-login recovery layer.

### 8. Remove the Tailscale expiry risk

The desktop node key currently expires at `2027-01-16T00:11:17Z`. In the Tailscale admin console, disable key expiry for `DESKTOP-TJLLGPG` if this machine should remain reachable without periodic reauthentication. Record the admin-console result.

### 9. Decide power-loss recovery

For reliable unattended use, add a UPS and set the motherboard's **Restore on AC Power Loss** behavior to power on. BIOS behavior was not inspected or changed. Wake-on-LAN alone does not solve a complete power loss, and this T-Mobile connection has no proven external wake relay.

## Laptop completion session — 2026-07-19 evening (HP OmniBook 7 Flip)

The laptop side was executed the same evening from the laptop itself (Windows
hostname `DESKTOP-RD3FE2K`, renamed to `HP-OMNIBOOK7` effective next reboot;
tailnet name already `hp-omnibook7`). Evidence for every claim was tool output
or an on-screen capture in the session transcript.

### Done — verified from the laptop

- **Rank 1 complete.** Tailscale `1.98.9` and Moonlight `6.1.0` installed via
  winget official packages (hash-verified, exit 0 both). VS Code `1.113.0` was
  already present with `ms-vscode.remote-server` installed. Laptop joined the
  tailnet as `hp-omnibook7` (`100.92.211.107`); `tailscale set
  --hostname=hp-omnibook7` pins the name independent of the pending Windows
  rename.
- **Rank 2, on-LAN half.** `tailscale ping desktop-tjllgpg` → direct path pong
  in 2–14 ms via `192.168.12.121:41641` (LAN endpoint — the laptop was on the
  same home network, so this does NOT satisfy the external-network gate).
  `tailscale netcheck` from this T-Mobile connection: UDP true, IPv4+IPv6 both
  reachable, `MappingVariesByDestIP: false`, nearest DERP Toronto ~85 ms. Those
  are favorable preconditions for a direct path from outside. The external test
  remains open and takes two commands from any non-home network.
- **Rank 3 complete.** Moonlight paired with Sunshine (client name `Austen
  Laptop`, PIN flow). Pairing state verified in the laptop registry
  (`HKCU\Software\Moonlight Game Streaming Project\Moonlight\hosts\1` with
  `srvcert`; apps synced: `Desktop`, `Steam Big Picture`).
- **Rank 4 complete (on-LAN baseline).** First real stream ran with the
  conservative profile via CLI flags (`stream 100.75.226.74 Desktop
  --resolution 1920x1080 --fps 60 --bitrate 5000 --video-codec HEVC
  --frame-pacing --performance-overlay`). Overlay readings: host processing
  2.1 ms avg, network latency 3 ms, decode 0.76 ms (hardware HEVC), render
  0.59 ms, 0.00% dropped frames. Numbers are the on-LAN baseline; re-measure
  from the external network.
- **Rank 5 complete.** VS Code on the laptop connected to tunnel
  `austen-4090-desktop` with the desktop's `E:\tka-platform` open; `code
  --status` reports `Remote: austen-4090-desktop`, remote OS `10.0.26100`
  (desktop build; laptop is 26200), >22k files served from the desktop.
- **Rank 6 pre-staged.** `C:\Users\Austen\Desktop\Desktop-4090.rdp` on the
  laptop targets `100.75.226.74` as `DESKTOP-TJLLGPG\Austen`, prompts for
  credentials. End-to-end login test still requires Austen's password entry.

### Divergences found while auditing the desktop claims

- **Sunshine admin TCP `47990` IS reachable over the tailnet** from the laptop
  (TcpTestSucceeded true), contradicting "intentionally not exposed through the
  custom tailnet firewall rules." The custom rules indeed omit it; reachability
  is most likely Tailscale's own inbound allowance on the tailnet interface
  preempting the scoped Windows Firewall rules — which would also mean the
  four custom "(Tailscale only)" rules are not what is actually admitting
  tailnet traffic. Auth still gates the dashboard, and only tailnet devices can
  reach it. Decision recorded: accepted for now (it is what made remote pairing
  possible); revisit only if the tailnet ever grows beyond Austen's own devices.
- All other audited claims held: node online at `100.75.226.74`, RDP `3389` and
  Sunshine `47984/47989/48010` reachable from a tailnet peer, Sunshine
  `serverinfo` answers with `hostname DESKTOP-TJLLGPG`, `state
  SUNSHINE_SERVER_FREE`.

### Gotchas discovered (laptop side)

- **Sunshine CSRF blocks PIN submission from a non-localhost origin.** Browsing
  the dashboard at `https://100.75.226.74:47990` and submitting the PIN fails
  with a CSRF Protection Error. Fix in place: a persistent netsh portproxy on
  the laptop (`127.0.0.1:47990 → 100.75.226.74:47990`), so the dashboard is
  always `https://localhost:47990` on the laptop — default origin, no CSRF,
  works from any network over the tailnet. Alternative (not applied): add the
  tailnet origin to `csrf_allowed_origins` in the desktop's sunshine.conf.
- **Moonlight stores everything in the registry, not an INI**
  (`HKCU\Software\Moonlight Game Streaming Project\Moonlight` — QSettings
  native format). Automation watching for pairing/settings must poll the
  registry.
- **`Moonlight.exe pair` requests expire and the process exits** after several
  minutes unpaired. Arm the pairing immediately before entering the PIN, not
  minutes ahead.
- The laptop's VS Code also registered its own tunnel host (name
  `DESKTOP-RD3FE2K`, stale after rename). Harmless; rename or remove it if the
  list gets confusing.

### Still open (all need Austen's hands or an external network)

1. **Rank 2 external gate:** from the girlfriend's network or a hotspot, run
   `tailscale ping desktop-tjllgpg` and `tailscale netcheck`; require a direct
   (non-DERP) final path, then re-run the Moonlight stream and re-read the
   overlay.
2. **Rank 6:** double-click `Desktop-4090.rdp`, enter the Windows password,
   confirm NLA login reaches the desktop session.
3. **Rank 7 reboot drill:** deferred deliberately — the desktop had multiple
   active agent sessions on screen during this window; rebooting it kills
   in-flight work. Run the drill from the checklist in rank 7 when the desktop
   is quiet and someone can physically recover it.
4. **Rank 8:** NOT yet done as of 21:20 CDT — `tailscale status --json` still
   shows KeyExpiry `2027-01-16` for both machines. Machines page → row `⋯` →
   Disable key expiry, for `desktop-tjllgpg` and `hp-omnibook7`.
5. **Rank 9:** unchanged recommendation — UPS plus BIOS "Restore on AC Power
   Loss = Power On" for unattended resilience; both are physical/BIOS actions.

## Decisions already made

- On 2026-07-19, Austen asked for the most reliable use of the desktop's hardware from his laptop while away. Reliability matters more than forcing one product to cover every failure mode.
- The laptop is a thin client. Arbitrary Windows laptop processes do not transparently borrow the desktop CPU/GPU. Workloads must run through a remote desktop, remote development server, or a deliberately exposed application service.
- Sunshine/Moonlight is the primary full-GUI and GPU path.
- VS Code Remote Tunnels is the primary development path when the full Windows GUI is unnecessary.
- RDP is the boot and recovery path.
- RustDesk remains installed as an independent fallback.
- No public router port forwarding is part of this design. RDP and Sunshine streaming ports are tailnet-only.
- The desktop stays awake on AC. This is more dependable than relying on unproven remote wake behavior.
- qBittorrent uses its alternative-speed profile during remote work so upstream saturation does not destroy interactive latency.
- Austen explicitly accepted the VS Code Server terms on 2026-07-19.
- Credentials stay out of the repository and agent chat. Austen set the Windows and Sunshine passwords locally.

## Gotchas

- Zero latency is impossible over the internet. The target is low and stable latency with a direct path, hardware encoding, and protected upload bandwidth.
- The home connection is T-Mobile (`AS21928`). T-Mobile networks can interfere with WireGuard UDP traversal. Treat `tailscale ping` from the laptop's real external network as the gate for Moonlight.
- A Tailscale DERP relay remains end-to-end encrypted, but it is the wrong performance path for sustained Moonlight video. Use VS Code Tunnel, RDP, or RustDesk while diagnosing a persistent relay.
- Sunshine's latest startup probe logs two AV1 YUV444 errors. Sunshine immediately marks encoder-probe errors as ignorable, and standard AV1, HEVC, and H.264 NVENC discovery succeeds. Do not treat those two probe lines as a streaming failure.
- ViGEmBus was missing on the first Sunshine start, then installed and verified. Do not reinstall it unless its current driver/service check fails.
- The Sunshine administration page uses a self-signed certificate and HTTP Basic Authentication. Embedded viewers may show raw `401 Unauthorized` JSON instead of a login prompt. Use an external browser for `https://localhost:47990`.
- TCP `47990` is local administration only under the current firewall policy. Moonlight streaming ports are the ones allowed from the tailnet.
- Windows OpenSSH Server installation failed with capability error `0x800f0950`. The host setup intentionally continued without SSH, and VS Code Remote Tunnels replaced that path. Do not spend the laptop setup session reinstalling OpenSSH unless a separate requirement appears.
- The VS Code `service` on this Windows build is registered in the Austen user's HKCU Run key. It starts after Austen logs in, not at the pre-login screen.
- RustDesk is the signed portable build and starts from Austen's Startup folder with `--tray`. It also requires a user session.
- RDP can leave the physical console locked. If Sunshine returns a lock screen or black screen after RDP recovery, use RustDesk or physically unlock the console before treating Sunshine as broken.
- qBittorrent's current remote-work cap is the alternative/turtle profile at 128 KiB/s. Turning off alternative speed limits restores the normal unlimited profile and can bring upload saturation back.
- Google Drive was accidentally suspended during bandwidth diagnosis and PowerShell became unresponsive. Austen ended the Google Drive processes in Task Manager, after which Google Drive was restarted and verified running. Never suspend processes to identify bandwidth consumers again; use byte counters and application-level limits.
- Port `5173` is Austen's existing HTTPS/2 VS Code dev server. Do not start, stop, or kill it. Local checks use `https://localhost:5173`, not HTTP.
- The repository checkout is extremely dirty because several agents are active. Scope every commit with `git commit -m "..." -- <exact-paths>` and never use broad add, clean, stash, reset, or checkout commands.
