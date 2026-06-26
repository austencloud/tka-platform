# Practice Focused Mode — Cockpit Bar

**Date:** 2026-06-26
**Status:** Design — building
**Area:** `src/lib/shared/sequence-viewer/`
**Builds on:** `2026-06-24-viewer-practice-restore-design.md`

## Problem

Practice currently runs as a floating HUD pill bolted onto the full viewer
chrome. The viewer's other views (3D / Mandala / Tunnel / Card / 2D) are
irrelevant during practice — you're locked to Side-by-Side anyway. The pill is
cramped and read-mostly. Practice deserves a focused layout with a real control
bar.

## Decisions (locked with user)

- **Focused state, not a separate route.** When `practiceActive`, the viewer
  enters a focused layout. No new route/module — reuses the existing
  chrome-hiding pattern (`toggleImmersive`).
- **Cockpit bottom bar** replaces the floating pill.
- **Auto is the new default** progression mode.

## Design

### Focused layout (when `ctx.practiceActive`)

- **Hide the content rail** (drawer desktop): `{#if showRail && !ctx.practiceActive}`.
  The mode switcher disappears — you're locked to Side-by-Side (already forced
  on start).
- Header stays (back/exit, favorite, the Practice toggle itself which now reads
  "Stop"). No mode controls live there, so nothing else to strip.
- **Dock the cockpit bar** at the bottom of the viewer container, replacing the
  floating `PracticeProgressIndicator`.

### Cockpit bar — `PracticeBar.svelte` (new)

Full-width docked strip. Left→right:

1. **Exit** — stops practice (`onStop`). `fa-stop`.
2. **Play/Pause** — `onPlayPause` / `isPlaying` (`ctx.handlePlaybackToggle`,
   `ctx.isPlayingLocal`).
3. **BPM** — value + `−`/`+` nudge (`ctx.handleBpmChange`, `ctx.bpmLocal`).
   `tabular-nums` (no layout shift).
4. **Loop progress** — `●●●○○` dots (completed/total) + label: Auto shows
   "N to next" counting down; Manual shows "Level up ready" at threshold.
5. **Level Up** — always tappable, jumps a level now (`onAdvance` →
   `ctx.handlePracticeAdvance`). Glows in Manual once the level completes.

Responsive: desktop shows all; narrow widths drop the BPM nudge label and
play/pause label, keep icons. Min 44px targets. No checkboxes.

New component justified: the existing `PracticeProgressIndicator` is a compact
read-only HUD; a docked cockpit with transport + tempo controls is a different
layout. `PracticeProgressIndicator` is fully superseded and **deleted** (only
consumers were the two hosts).

### Progress data

`TempoPracticeProgress` gains:
- `loopsCompleted: number` — loops done at the current level (0..roundsPerLevel).
- `loopsRemaining: number` — `max(0, roundsPerLevel - loopsCompleted)`.

Drives the dots + countdown without the consumer reverse-engineering the
1-based `currentRound`.

### Auto default

`DEFAULT_CONFIG.progressionMode = "auto"`. In Auto the bar's countdown drives
the ramp (amps at 0); Level Up jumps early. Manual still available via the
config popover (holds + glowing Level Up). Persisted `userConfig` overrides for
existing users. Config popover fallback display → `"auto"`. Unit test updated.

## Files

**New:** `components/PracticeBar.svelte` (cockpit). Grep: no docked practice
control bar exists; the pill is a compact HUD, different layout.

**Modify:**
- `services/tempo-practice-orchestrator.ts` — `loopsCompleted`/`loopsRemaining`
  in progress; default `progressionMode: "auto"`.
- `state/tempo-practice-state.svelte.ts` — progress defaults incl. new fields;
  default mode auto.
- `components/SequenceViewerDrawerHost.svelte` — hide rail when practiceActive;
  render `PracticeBar` instead of the pill.
- `routes/sequence/[id]/+page.svelte` — render `PracticeBar` instead of the pill.
- `components/PracticeConfigPopover.svelte` — fallback `"auto"`.
- `tests/unit/sequence-viewer/tempo-practice-orchestrator.test.ts` — default
  auto; `loopsRemaining` assertions.

**Delete:** `components/PracticeProgressIndicator.svelte` (superseded).

## Verification

- `npm run check` green; orchestrator unit tests green.
- DevTools: enter practice → rail gone, cockpit bar docked at bottom, BPM/dots/
  countdown correct, play/pause + BPM nudge + Level Up work, Auto amps at the
  threshold, exit restores the rail.

## Out of scope

Per-rep audio/haptic metronome cues; a literal separate route.
