# Known issues

## 1. The popover animation can play twice ("double pop")

**Status:** open, cosmetic. Happens when clicking a pin while the popover is
already open.

### Mechanism (proven from `host.log`)

```
14:09:58.917  ready=true                popover open (click A)
14:09:59.490  Deactivated -> HideIt     click B MOUSEDOWN steals focus, popover hides
14:09:59.643  pipe recv -> ShowFor      click B's stub ping lands 153ms later
14:09:59.664  ready=true                popover pops AGAIN
```

One physical click produces hide + re-pop, which reads as the intro animation
playing twice. Stub latency measured 114-162ms consistently.

The single-show path itself is clean. Three frame-by-frame screen captures
(synthetic pipe ping, real stub launch, high-speed ~60fps) all show one monotonic
grow animation with no OS-layer flash. An earlier genuine rendering artifact -
a layered window flashing its first composited frame at full size - was fixed by
setting `Window.Opacity = 0` and positioning off-screen before `Show()`, then
animating window opacity. That fix is in place and working.

### Fixes attempted

1. **OS-layer flash fix.** Described above. Kept. Necessary but not sufficient.

2. **Toggle-suppression** (currently deployed). `Deactivated` records the hide
   time and project; `ShowFor` swallows a ping for the same project arriving
   under 450ms after a deactivate-hide. Every close-ping in live use was
   swallowed correctly. It still reads as a double because the interaction is
   usually two clicks: click 1 closes, click 2 reopens with the full intro.
   Vanish plus re-pop across two clicks looks the same as the original bug.

3. **Keep-open model** (built, reverted). Pin click means "be open", never
   toggle. `Deactivated` checked whether the cursor was over a taskbar
   (`WindowFromPoint` -> `GetAncestor(GA_ROOT)` -> class `Shell_TrayWnd` or
   `Shell_SecondaryTrayWnd`); if so it started a 900ms pending-hide instead of
   hiding, and `ShowFor` for the same project while visible was a no-op that
   just re-activated. Synthetic tests passed on the primary taskbar. It failed
   in live use.

### Where to look next

- **Taskbar detection is the prime suspect for fix 3's failure.** Pins on a
  secondary-monitor taskbar may not root to `Shell_SecondaryTrayWnd` on Windows
  11, whose taskbar is XamlExplorerHost-based (`TopLevelWindowForOverflowXamlIsland`,
  `Windows.UI.Core.CoreWindow`, or the island host). If the predicate returns
  false, the popover hides instantly and the double is guaranteed. Cheap
  experiment: log the detected root class in `Deactivated`, click a pin once,
  read the log. If the class is wrong, replace the class check with geometry -
  enumerate `Shell_TrayWnd` plus every `Shell_SecondaryTrayWnd`, take their
  `GetWindowRect`, and hit-test the cursor. Rect-based is robust to XAML
  internals.
- **Stub latency tail.** If a ping ever lands more than 450ms after the
  deactivate-hide (cold stub, antivirus scan), fix 2's swallow misses. Not yet
  observed - all measurements were under 170ms - but 450ms is a guess.

### Belt-and-suspenders fallback

Kill the perception rather than the race: if `ShowFor` runs within ~1.5s of the
previous `HideIt`, skip the intro entirely - clear the animations with
`BeginAnimation(prop, null)`, set scale to 1 and opacity to 1, show in place.
Then even when every heuristic misses, the worst case is the popover reappearing
instantly, because there is no second animation to see. Track `_lastHideTicks`
in `HideIt`. This has not been tried.

### Ruled out

- Not two pipe pings per click. The log shows exactly one ping per stub launch.
- Not a second host instance. Single-instance mutex verified; all log lines
  share one pid.
- Not a WPF or DWM rendering artifact. Frame captures are clean.
- Unrelated to `Prewarm()`, the off-screen show/hide that warms layout at startup.

## 2. Resolved: agents opened in the classic console

The host now launches `wt.exe -w new` explicitly through
`AgentTerminalLauncher.exe`. It no longer depends on the system's default
console host. The same launcher assigns one unused background tint across
Claude and Codex, and `AgentTerminalSession.exe` holds that tint lease for the
life of the session.

### Retired: hidden terminal pre-warming

An earlier version kept hidden pre-booted agent sessions so a pick was instant.
It was removed on 2026-07-20 and should not be restored as-built. Two reasons:

- Consoles spawned by a background process do not get delegated to Windows
  Terminal. They come up as classic conhost (`ConsoleWindowClass`), never
  `CASCADIA_HOSTING_WINDOW_CLASS`, and there is no API to migrate a live
  console session into Terminal afterward.
- Attempts to pre-spawn Windows Terminal windows instead took foreground focus,
  so terminals appeared to pop up on their own.

If someone revisits this, the untested idea is one named hidden Terminal window
per warm session (`wt -w warm-<project>-<agent> nt -d <project> cmd /c <bat>`),
spawned far off-screen, captured by `CASCADIA_HOSTING_WINDOW_CLASS` plus title,
hidden with `SW_HIDE`, then shown on pick. The open question is whether the
initial spawn can be made to never steal focus. If it cannot, the feature is not
worth it - the bar is zero visible artifacts.

The off-screen WPF prewarm (`Prewarm()`) is unrelated and stays. It only realizes
the chooser window, fonts, and layout at startup.

## 3. Resolved: terminal tints could turn black

The color lease was healthy. The live console palette was not. On Windows
Terminal 1.24.11911.0, a disposable window launched with
`--colorScheme "Agent Hub Session 01"` still reported ANSI palette entry 0 as
the stock `#0C0C0C` three seconds after startup. The assigned scheme defines
that entry as `#002A2C`. A TUI that paints ANSI-black cells therefore covers the
tinted background with stock black.

`AgentTerminalSession.exe` now reads palette entry 0 before starting Claude or
Codex. It writes the assigned background and ANSI-black value when they differ,
then checks every two seconds while the agent is alive. Healthy checks are
read-only. Each repair is recorded in
`%LOCALAPPDATA%\AgentHub\terminal-color-recoveries.log` with the observed color
and settings timestamps.

The resident `AgentTerminalColorWatchdog.exe` checks all discoverable sessions
every five seconds. It covers terminals opened with an older session helper;
new sessions also monitor themselves so elevated consoles do not depend on a
lower-integrity process.

The installer also compares the Terminal fragment before writing it. An
unchanged install no longer touches `settings.json`, because that reloads every
open Terminal window and can discard per-tab appearance state.

## Diagnostic tools

`diag/` holds the scripts used to investigate the double pop. They were written
against the original install path (`E:\launchers`) and may need paths adjusted.

| Script | What it does |
|---|---|
| `capture-pop.ps1` | Synthetic pipe ping plus ~60fps screen capture around the cursor, with a per-frame diff and bounding-box table. Finds pops and flashes objectively. |
| `capture-pop2.ps1`, `capture-pop3.ps1` | Same, but launching the real stub the way a pin does, cursor parked on the taskbar. `pop3` is the high-speed variant. |
| `capture-live.ps1` | 120s motion-triggered recorder of the taskbar strip, for catching real clicks. Records the primary monitor only. |
| `warm-watch.ps1` | Watches for windows spawned by the retired warm pool and flags any that become visible. Only useful if that feature is revisited. |

Open the popover without clicking anything:

```powershell
$c = New-Object System.IO.Pipes.NamedPipeClientStream('.','AgentChooserPipe','Out')
$c.Connect(2000)
$w = New-Object System.IO.StreamWriter($c)
$w.WriteLine('E:\tka-platform|TKA Platform|' + $env:LOCALAPPDATA + '\AgentHub\icons\tka-platform.ico||' + [DateTime]::Now.Ticks)
$w.Flush(); $w.Dispose()
```

Turn on logging first - it is off unless the debug flag exists:

```powershell
New-Item -ItemType File "$env:LOCALAPPDATA\AgentHub\debug.flag" -Force
Get-Content "$env:LOCALAPPDATA\AgentHub\host.log" -Tail 40
```
