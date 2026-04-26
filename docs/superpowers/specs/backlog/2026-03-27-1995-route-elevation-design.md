---
status: backlog
value: 3
effort: XL
remaining: Wire all 10 apps to real DI services
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# /1995 Route Elevation: From Cute to Wow

**Date:** 2026-03-27
**Status:** Approved for implementation

## Problem

The /1995 route is a faithful Windows 95 OS emulator with 10 desktop apps, full window management, CRT effects, and easter eggs. The chrome is impressive. The content is a movie set — mock data, hardcoded sequences, no real functionality. Someone clicks around for 30 seconds and moves on.

## Goal

Make /1995 a fully functional parallel client for TKA. Same Firebase auth, same data, same generation, same library. Every app does real work. The Win95 shell stops being a novelty and becomes a real interface that happens to look like 1995.

The reaction shifts from "oh that's fun" to "wait, this actually works?"

## Architecture: Multi-Era View Contract

/1995 is the first of four era-themed routes, each a complete client:

| Route | Year | OS | App Name | Lore Author |
|-------|------|----|----------|-------------|
| `/1989` | 1989 | DOS terminal | TKAUTIL.COM | The Order (Bellweather) |
| `/1995` | 1995 | Windows 95 | TKA Notation System | The Order (Bellweather) |
| `/1998` | 1998 | Windows 98 | TKA Constructor | Free Scribe Collective |
| `/2003` | 2003 | Windows XP | OpenTKA | Open Source Community |
| `/` | 2026 | Modern web | TKA Composer | — |

Every era supports full functionality. The clunkiness of the era's UI paradigm forced onto modern capabilities is the charm.

### Layer Diagram

```
┌─────────────────────────────────────────────┐
│              Era View Layer                  │
│  /1989 (DOS)  /1995 (Win95)  /1998  /2003   │
│  Each era: components, sounds, lore, chrome  │
├─────────────────────────────────────────────┤
│           Era Adapter Layer                  │
│  Maps platform capabilities to era UI needs  │
│  "list sequences" → DOS dir listing          │
│  "list sequences" → Win95 file grid          │
├─────────────────────────────────────────────┤
│          State Factories (shared)            │
│  createSequenceState(), createLibraryState() │
│  createAuthState(), createGenerationState()  │
│  Era-agnostic. Reactive. Same for everyone.  │
├─────────────────────────────────────────────┤
│          DI Container (shared)               │
│  SequencePersister, LibraryRepository,       │
│  GenerationOrchestrator, Firebase Auth...    │
│  Business logic. No UI knowledge.            │
└─────────────────────────────────────────────┘
```

**Key principle:** The service layer and state factories are era-agnostic. The modern app at `/` is architecturally just another era. Adding a feature to the service/state layer surfaces in all eras automatically. The era adapter is thin — it translates data shapes into era-appropriate rendering.

## App Wiring: Every App Is Real

Auth must be wired first. Everything else depends on it.

### Auth

Win95-styled login dialog appears after boot sequence (unless already authenticated from the same browser session). Username/password fields, "Log In" button. Calls the same Firebase auth the modern app uses. On success, desktop loads. On failure, period-appropriate error dialog.

### TKA Notation System (main composer, was SCRIBE.EXE)

The single biggest "wait, this actually works?" moment.

- Generate tab calls the real generation orchestrator
- Construct tab builds real beat data
- Sequence state is the same `createSequenceState()` the modern app uses
- Save persists to Firebase
- Status bar shows real beat count from real data
- File > Open loads real saved sequences
- File > Save As prompts with retro dialog, saves to real library

### FILEMGR.EXE (file manager)

Your real library rendered as DOS filenames.

- Calls `LibraryRepository.list()` for real sequences
- `FileNameConverter` (already exists) generates 8.3 names from sequence words
- Directory tree maps to real organizational structure (user folders, community sequences)
- Double-click a .SEQ file opens it in TKA Notation System window
- Right-click > Delete actually deletes (with period-accurate confirmation dialog)
- File sizes derived from actual sequence beat count
- Sorting by name/date/size works against real data

### CARDS.EXE (choreo card viewer)

- Pulls from real saved sequences
- PixelRenderer draws real pictograph data (renderer exists, needs real data piped in)
- Navigation browses actual card collection
- Print shows "LPT1: not found" (sacred)

### TUTOR.EXE (educational app)

- Concepts tab pulls from the same data the modern Learn module uses
- Quiz generates questions from real domain data
- Codex shows real TKA letter reference from cached alphabet data

### CONTROL.EXE (control panel)

Already partially real (CRT toggles work). Expand:

- Display settings persist to Firebase user prefs
- Sound settings control the real sound manager with working volume slider
- About tab shows version info

### UPGRADE.EXE (shareware/premium)

The shareware nag becomes the real premium gate. If not premium: period-accurate registration prompt that's both a joke and a functional upsell. If premium: "REGISTERED TO: [username]" with smug thank-you.

### README.TXT, HELP.HLP, RECYCLE BIN

- README and HELP contain actual documentation for using the apps
- Recycle Bin shows recently deleted sequences with option to restore
- Backed by real soft-delete in the data layer (sequences flagged as deleted, not removed from Firebase). Restore reverses the flag. Permanent purge after 30 days or manual "Empty Recycle Bin."

## Sound Design

Full soundscape. Every UI interaction has audio feedback.

| Event | Sound |
|-------|-------|
| Boot complete | Startup chime (slightly lower fidelity — Bellweather's budget) |
| Window open | Short ascending chord |
| Window close | Short descending chord |
| Window minimize | Quick whoosh down |
| Window maximize | Quick whoosh up |
| Button click | Crisp tactile click |
| Menu open | Soft pop |
| Error dialog | The iconic ding |
| BSOD | Hard drive death rattle |
| Start menu open | Subtle chime |
| Sequence generated | Floppy drive seek noise, then success ding |
| File delete | Crunch (recycle bin) |
| Clippy appears | Spring boing |
| Login success | Welcome jingle |
| Login fail | Access denied buzz |
| Screensaver activate | Quiet power-down hum |

**Implementation:** Real .mp3 files at period-accurate quality (8-bit depth, 22kHz). Lazy-loaded on first user interaction (browser autoplay policy). Volume controlled by Control Panel, persisted to Firebase.

## Fidelity

**Guiding rule:** Keep design-era constraints, skip hardware-era constraints. 1995 aesthetics with 2026 responsiveness. An alternate timeline where someone who cared about UX shipped Win95 software.

### Keep (authentic feel, good UX)

- Sharp pixel font rendering — no antialiasing, no ClearType
- Icon XOR invert on selection
- CRT barrel distortion (slight convex warp on edges)
- Phosphor glow on bright elements (subtle bloom)
- Color fringing on high-contrast edges (1px red/blue offset)
- Keyboard shortcuts: Alt+F4 close, Ctrl+Esc start menu, Alt activates menu bar, arrow keys navigate menus
- Double-click title bar icon to close window
- Taskbar text truncation with ellipsis
- Desktop selection rectangle (click-drag to select icons)
- Tab/Shift+Tab focus cycling in dialogs

### Soften (authentic nod, don't punish)

- Boot sequence: 8-10 seconds. Long enough for mood, short enough nobody thinks it's broken. Skip-on-click.
- Live window resize (not rubber band outlines — authentic but infuriating)
- Smooth, responsive window dragging — no simulated lag

### Skip (hardware constraints nobody appreciates)

- 30+ second boot
- Simulated slow rendering
- Artificial delays on file operations
- Any interaction that makes the user wait for "realism"

## Lore: Decoration, Not the Meal

Normal software text everywhere. Error messages are clear. Dialogs are functional. Menus say what they do.

Lore lives only in places a user would go looking for it:

- **About dialog** — who made this software
- **README.TXT** — if you choose to open it
- **HELP.HLP** — if you choose to open it
- **The clock** — reads 3:47 PM. Always.

Everything else is just a good Win95 app.

## Easter Eggs

Each is self-contained and funny without context. No required lore knowledge.

### DOOM.EXE (the showstopper)

Typing `DOOM` anywhere opens a RetroWindow with actual playable DOOM. Uses js-dos (~1MB) fetching the shareware DOOM1.WAD (~4MB) from the js-dos CDN at runtime — nothing bundled in the repo. Lazy-loaded only when triggered. The window title bar says "DOOM.EXE" with working minimize/maximize/close. Play DOOM, then alt-tab back to composing sequences.

### Already built (polish)

- BSOD on My Computer click
- Clippy with googly eye tracking
- Screensaver on idle timeout
- DEFRAG.EXE animation
- "LPT1: not found" when printing

### New

| Trigger | Result |
|---------|--------|
| Drag window off screen edge | Wraps to other side, Asteroids-style |
| Right-click Recycle Bin 5 times | Icon tips over (rotates 45 degrees) |
| Click the clock | "3:47 PM. Always." — no explanation |
| Set clock in Control Panel | Input exists but snaps back to 3:47 on Apply |
| Open 10+ windows | Fake slowdown, dialog: "System running low on memory. Close some windows. Or don't. I'm a dialog, not a cop." |
| Ctrl+Alt+Delete | Task Manager where every process is "NOTATION.DLL" |
| Drag icon onto Recycle Bin | Confirmation, removes from desktop (reappears on reboot) |

## Implementation Order

1. **Auth** — Login dialog, Firebase auth wiring. Unlocks everything.
2. **TKA Notation System** — Real generation, real save/load. The biggest wow moment.
3. **FILEMGR.EXE** — Real library browsing. "Those are MY sequences."
4. **CARDS.EXE** — Real card rendering from real data.
5. **Sound** — Full soundscape wired to UI events.
6. **DOOM.EXE** — js-dos integration.
7. **TUTOR/CONTROL/UPGRADE** — Real data for remaining apps.
8. **Fidelity polish** — CRT barrel distortion, keyboard shortcuts, icon behaviors.
9. **Easter eggs** — New discoveries layered in.
10. **Rename** — SCRIBE.EXE references → TKA Notation System throughout.

## What This Achieves

Someone opens /1995 expecting a novelty. They realize it's a real app. They generate a real sequence inside a Win95 window inside a CRT monitor. They browse their actual library as DOS filenames. They open DOOM. They show their friend.

The architecture they build for /1995 becomes the template for /1989, /1998, and /2003. Four fully functional clients, four eras, one data layer.
