---
status: backlog
value: 3
effort: XL
remaining: "Auth (LOGIN/LOGOUT/WHOAMI) + GENERATE wiring + easter eggs shipped. Next: SAVE/LOAD/DELETE commands, filesystem wiring (real library in SEQUENCES dir), construct, browse+cards, tutorial+config"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-05-04
---
# /1989 Route Elevation: TKAUTIL.COM as a Real CLI Client

**Date:** 2026-03-27
**Status:** Draft

## Problem

The /1989 route is a complete DOS terminal emulator running TKAUTIL.COM v1.0 — 22 files, ~2,500 lines. It has a real command parser, real keyboard input, an ASCII art pictograph renderer, 7 SCRIBE apps, PC speaker emulation, and a boot sequence. The chrome is production-grade. The data is all mock: deterministic fake pictographs, a hardcoded filesystem, static tutorial content.

## Goal

Make /1989 a fully functional CLI client for TKA. Same Firebase auth, same data, same generation engine as /1995 and the modern app. Every command does real work. Typing `GENERATE BOOK` at a DOS prompt produces a real sequence rendered in ASCII art.

The reaction shifts from "cool retro terminal" to "wait, I just generated a real sequence from a DOS command line?"

## Relationship to /1995

Both routes share the same architecture from the multi-era view contract:

```
Era View Layer (/1989 DOS terminal, /1995 Win95 GUI, /1998, /2003)
    ↓
Era Adapter Layer (translates platform capabilities → era UI)
    ↓
State Factories (shared, era-agnostic)
    ↓
DI Container (shared services: auth, generation, library, settings)
```

The /1995 plan creates the shared infrastructure (retro init path, DI wiring, soft-delete). The /1989 plan reuses all of that. The only new work is the DOS-specific adapters that translate DI service calls into terminal output.

**Depends on:** Plan 1 Task 1 (retro init path) from the /1995 elevation. Once that's done, /1989 gets Firebase + auth + DI for free.

## Naming

The app is called **TKAUTIL.COM** in this era. The Order named it a "utility" — clinical, institutional. It catalogs notation. It doesn't create. (That's what they think.)

The SCRIBE submenu becomes the **Notation Utility** menu. References to "Scribe" in the DOS route become "Notation Utility" or just the menu system.

## What Exists Today (Real vs Mock)

| Aspect | Status | Notes |
|--------|--------|-------|
| Terminal emulation | Real | Keyboard input, output buffer, mode routing |
| Command parser | Real | 12 commands, proper error handling |
| Filesystem | Mock | Fake C:\BELLWTHR\ tree with hardcoded files |
| Pictograph rendering | Mock | Deterministic data → real ASCII art renderer |
| Sequence generation | Mock | Fake processing animation, random output |
| Sequence construction | Mock | In-memory array, no persistence |
| Library browsing | Mock | 5 hardcoded .SEQ files |
| Choreo cards | Mock | Same 5 hardcoded cards as /1995 |
| Tutorial content | Mock | 5 static lessons |
| Sound | Real | Web Audio PC speaker emulation |
| Boot sequence | Real | Timed POST animation |
| CRT effects | Real | Green/amber phosphor, scanlines |
| Settings | Real (session) | Lost on page refresh |

## App Wiring: Every Command Is Real

### Auth

New command: `LOGIN`. Prompts for email and password at the DOS prompt. Calls Firebase auth. On success: `Welcome, [display name]. Access granted.` On failure: `ACCESS DENIED: Credentials not recognized.`

If already authenticated (same browser session), skip login. Show `Authenticated as [name]` after boot.

New command: `LOGOUT`. Signs out of Firebase. Returns to unauthenticated state.

The prompt changes to show the user: `C:\BELLWTHR [austencloud]>`

### Filesystem → Real Library

Replace `DosFileSystem.ts` mock tree with a hybrid:

**Static directories stay:** `C:\SYSTEM\`, `C:\TEMP\`, and system files (KINETIC.SYS, SPIRAL.DRV, etc.) remain static. They're decoration.

**`C:\BELLWTHR\SEQUENCES\` becomes real:**
- `DIR C:\BELLWTHR\SEQUENCES` calls `LibraryRepository.getSequences()` and formats as DOS file listing
- File sizes derived from beat count (128 bytes per beat)
- Dates from sequence `updatedAt` timestamps, formatted as MM-DD-YY
- Filenames via `FileNameConverter` (8.3 format from sequence names)
- `DIR /SEQ` filter works against real data

**New directory: `C:\BELLWTHR\DELETED\`**
- Lists soft-deleted sequences (recycle bin equivalent)
- `UNDELETE <filename>` restores a soft-deleted sequence

### Generate → Real GenerationOrchestrator

`GENERATE <word>` and SCRIBE menu option 1:
- Calls real `GenerationOrchestrator` with `constraintPreset: "smooth"`
- The "Computing kinetic path..........." animation runs in parallel with real generation
- Result rendered as ASCII art via `AsciiRenderer` (already production-grade, just needs real data)
- Options: `GENERATE <word> /SMOOTH`, `GENERATE <word> /REVERSAL`, `GENERATE <word> /LENGTH:8`

Freeform generation (no word):
- `GENERATE /FREEFORM /LENGTH:8 /LEVEL:2`
- Maps to GenerationOrchestrator's freeform mode

### Construct → Real Beat Building

SCRIBE menu option 2:
- [A]dd beat calls real option picker logic to get valid next letters
- Available letters come from the real `OptionFilter`/`OptionSorter` services (not charcode-seeded fakes)
- Built sequence is real `SequenceData` that can be saved
- [S]ave prompts for filename, calls `LibraryRepository.saveSequence()`

### Spell → Real Letter Data

SCRIBE menu option 3:
- Each letter rendered with real pictograph data from `Codex.getPictographByLetter()`
- ASCII renderer gets real `RetroPictographData` instead of mock

### Browse → Real Library

SCRIBE menu option 4:
- Lists real sequences from `LibraryRepository.getSequences()`
- Selecting a file loads and renders the real sequence
- `DELETE <filename>` calls `softDeleteSequence()`
- `TYPE <filename>` displays sequence metadata (word, beat count, constraint, date)

### Cards → Real Library Data

SCRIBE menu option 5:
- Loads real sequences from library (same adapter as /1995 cards)
- Box-drawn card display with real metadata
- Navigation through real card collection

### Tutorial → Real Concepts

SCRIBE menu option 6:
- Same concept data as /1995 tutor adapter (shared content)
- 6 lessons rendered as paginated DOS text
- Quiz questions from real `MOTION_QUIZ_QUESTIONS` data

### Config → Real Settings Persistence

SCRIBE menu option 7:
- Display mode (green/amber), sound, CRT effects persist to Firebase
- Uses same `retro` settings key as /1995 Control Panel
- Settings survive page refresh

### New Commands

| Command | Action |
|---------|--------|
| `LOGIN` | Firebase auth login prompt |
| `LOGOUT` | Sign out |
| `SAVE <filename>` | Save current/last generated sequence to library |
| `LOAD <filename>` | Load sequence from library |
| `DELETE <filename>` | Soft-delete sequence |
| `UNDELETE <filename>` | Restore from deleted |
| `SEARCH <query>` | Search library by word/name |
| `INFO <filename>` | Show sequence metadata |
| `WHOAMI` | Show current user info |
| `REGISTER` | Still the shareware easter egg — but now checks real premium status |

Existing commands stay: `DIR`, `CD`, `TYPE`, `CLS`, `VER`, `HELP`, `SCRIBE`, `GENERATE`, `SPELL`.

## Sound

PC speaker emulation stays. The existing `DosSoundManager` is appropriate for the era. No audio files needed — square wave synthesis is period-accurate for 1989.

Add sounds for:
- Login success: ascending three-tone
- Login fail: descending buzzer
- Sequence generated: cheerful beep pattern
- File saved: confirmation tone
- File deleted: low tone

## Fidelity

The DOS terminal is already high-fidelity. Minor additions:

- **Phosphor persistence:** When text scrolls, faint afterimage of previous lines (CSS opacity transition on removed lines). Subtle.
- **Typing sound:** Optional keyclick on every keystroke (already exists in DosSoundManager, just needs wiring)
- **Boot memory test:** Show actual count of sequences in library during POST: `Notation Archives...........347 sequences`

## Lore: Same Rule as /1995

Decoration, not the meal. Normal DOS error messages. Normal command responses. Lore lives in:
- `README.TXT` (if you TYPE it)
- `ORDER7.DOC` (access denied — always)
- Boot sequence Bellweather branding
- `VER` command version string

Everything else is just a good DOS utility.

## Easter Eggs

| Trigger | Result |
|---------|--------|
| `DOOM` | "DOOM.EXE not found. Insufficient memory. Nice try." |
| `FORMAT C:` | Fake format progress that aborts at 99%: "FORMAT ABORTED: Cannot format active notation archive." |
| `DEL *.*` | "All files in C:\BELLWTHR\SEQUENCES\? Are you sure (Y/N)?" → on Y: "ERROR: Notation archives are protected by Order Directive 7." |
| `ORDER7.DOC` (TYPE) | "ACCESS DENIED: Clearance Level 7 required. Contact your Bellweather supervisor." |
| `REGISTER` | Prompts for serial number. All inputs rejected. "Invalid registration key. Contact Bellweather Technical Institute." |
| `HELP /LETHE` | "Command not recognized." (but it logs to console: "Nice try.") |
| `EDIT CONFIG.SYS` | Shows the config with a line: `NOTATION_SUPPRESS=TRUE  ; DO NOT MODIFY - ORDER DIRECTIVE 7` |

## Implementation Order

1. **Auth commands** (LOGIN/LOGOUT/WHOAMI) — unlocks everything
2. **Filesystem wiring** (real library in SEQUENCES directory)
3. **Generate wiring** (real GenerationOrchestrator)
4. **Save/Load/Delete** (real persistence commands)
5. **Construct wiring** (real option picker)
6. **Browse + Cards** (real library data)
7. **Tutorial + Config** (real concepts, persistent settings)
8. **New commands** (SEARCH, INFO, UNDELETE)
9. **Easter eggs**
10. **Rename** (SCRIBE references → Notation Utility)

## Shared Infrastructure (from /1995)

These are NOT new work — they're already built by Plan 1 of the /1995 elevation:

- `retro-init.ts` — Firebase + auth + DI bootstrap for retro routes
- `+layout.svelte` retro init path — loads DI container for /1989
- Soft-delete on `LibraryRepository` — used by DELETE/UNDELETE commands
- `FileNameConverter` — DOS 8.3 filenames from sequence names
- Settings adapter — `retro` key in AppSettings for persistent config
- Tutor adapter — shared concept/quiz data

The /1989 adapters are new but thin — they call the same DI services and format output for terminal display instead of Win95 GUI.

## What This Achieves

Someone opens /1989 expecting a cute DOS toy. They type `LOGIN`, authenticate, type `DIR`, see their real sequences as .SEQ files, type `GENERATE BOOK`, watch the fake processing dots while the real engine runs, and see their real sequence rendered in ASCII art. They type `SAVE BOOK.SEQ` and it persists to Firebase. They switch to /1995 or the modern app and see the same sequence in their library.

Four eras, one data layer. A DOS prompt, a Win95 desktop, and a modern web app all showing the same library, the same sequences, the same user.
