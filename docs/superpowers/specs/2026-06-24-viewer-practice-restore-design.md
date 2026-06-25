# Viewer Practice Mode — Restore + Interactive Upgrade

**Date:** 2026-06-24
**Status:** Design — awaiting review
**Area:** `src/lib/shared/sequence-viewer/`

## Problem

Practice mode (progressive tempo training) was built, then its entry point was
withheld in commit `9a72182` ("withhold practice entry point until ready"). The
button vanished from every surface, but the entire engine stayed intact and
unreachable. Users have no way to practice. It was useful and should come back —
re-surfaced as a clear toolbar button, and upgraded from passive autopilot into
something interactive.

## What Practice Is (ground truth from code)

Practice is a **tempo ramp**, not a separate stepper. Hitting it:
1. Loops the sequence starting at a slow BPM (default 15 — ~4s per beat, slow
   enough to follow each step. This slowness is the "learn it step by step" feel).
2. After N clean loops (default 5), bumps BPM by an increment (default 5).
3. Repeats until a max cap, then stops.

It is **orthogonal to the view** — runs in any viewer mode. It pairs naturally
with Side-by-Side (animation + step grid visible together).

Confirmed intact and functional:
- `services/tempo-practice-orchestrator.ts` — the ramp state machine.
- `components/playback-controller.svelte.ts` — `handlePracticeStart` (l.190),
  `handlePracticeStop` (l.224), `practiceActive` getter (l.285), loop-complete wiring.
- `state/tempo-practice-state.svelte.ts` — persisted config + (to be removed) bests.
- `components/PracticeProgressIndicator.svelte` — the progress pill (still mounts on
  `practiceActive`, DrawerHost l.654).
- The toggle button JSX still lives in `ViewerOverflowMenu` (l.169), `ViewerContentRail`
  (l.28), `ViewerModeBottomBar` (l.51), and the (orphaned) footer controls — all
  guarded on a handler prop that is no longer passed.

The orchestrator already exposes everything needed: `ctx.practiceActive`,
`ctx.handlePracticeStart`, `ctx.handlePracticeStop`, `ctx.practiceState`
(`SequenceViewerOrchestrator.svelte` l.1104/1189/1190).

## Decisions (locked with user)

- **Desktop placement:** inline icon button in the header action cluster (next
  to Remix/Save/Favorite).
- **Mobile placement:** item in the overflow (⋯) menu.
- **On start:** if the current view has no live animation pane (card / mandala /
  tunnel / videos), switch to Side-by-Side via `setViewerMode('split')` so the
  steps are actually visible. Otherwise stay in the current view.
- **Cut personal best entirely.** We don't track props, so "best BPM" just means
  "highest I dragged the slider to" — a hollow, gameable metric. Remove the
  recording path and the "(new best!)" toast.
- **Upgrade to interactive:** a config popover (tune the ramp) + a self-paced
  Auto/Manual progression toggle.

## Design

### 1. Re-surface the toggle (the bulk of the work — wiring, not new code)

Re-pass the practice handler props the withhold commit cut. The button code is
already present in each consumer.

| Surface | Component | Change |
|---|---|---|
| Route header (desktop) | `RouteViewerHeader.svelte` | Render an inline Practice icon button in `header-right` (props `practiceActive`/`onPracticeToggle` already declared, l.33/37/58/62, currently unused). `fa-signal` → `fa-stop` when active. |
| Route overflow (mobile) | `RouteViewerHeader.svelte` → `ViewerOverflowMenu` | Re-pass `{practiceActive} {onPracticeToggle}` to the overflow menu (removed by `9a72182`). |
| Drawer overflow (all sizes) | `SequenceViewerDrawerHost.svelte` `overflowMenu` snippet (l.321) | Re-pass `practiceActive` + `onPracticeToggle` to `ViewerOverflowMenu`. |
| Drawer content rail (desktop) | `SequenceViewerDrawerHost.svelte` → `ViewerContentRail` (l.470 region) | Re-pass `practiceActive` + `onPracticeToggle` (its native home). |

Mode bottom bar (`ViewerModeBottomBar`) is **left without** the practice toggle —
mobile uses overflow per the decision above.

The progress pill (`PracticeProgressIndicator`) already renders on
`ctx.practiceActive` in both hosts. Stop is reachable from the button, the pill,
and the overflow.

### 2. Auto-switch to Side-by-Side

In the orchestrator's `handlePracticeStart` wrapper
(`SequenceViewerOrchestrator.svelte` l.1189), before delegating to the playback
controller: if `viewerState.viewerMode` ∈ {`card`, `mandala`, `tunnel`, `videos`}
(no live animation), call `viewerState.setViewerMode('split')`. Otherwise leave
the mode alone. `setViewerMode` already exists (`viewer-state.svelte.ts` l.26).

### 3. Cut personal best

In `state/tempo-practice-state.svelte.ts`: remove `bests`, `loadBests`,
`saveBests`, `recordPersonalBest`, `getPersonalBest`, `PersonalBest`,
`STORAGE_KEY_BESTS`. In `playback-controller.svelte.ts` `handlePracticeStop`
(l.224): drop the best lookup/record and the "(new best!)" branch. Completion
toast becomes honest: `Practice complete — reached ${finalBpm} BPM`.
`showCompletion` keeps its plain "Reached N BPM" message.

### 4. Config popover (interactive tuning)

New `components/PracticeConfigPopover.svelte`. Anchored to the desktop header
Practice button (a small caret/settings affordance beside it opens it); on mobile
it opens from a settings glyph on the progress pill. One component, two anchors.

Contents:
- Three compact numeric steppers: **start BPM**, **increment**, **rounds per level**.
- A two-option **Auto / Manual** progression control.

Writes through `practiceState.updateConfig(...)` (already exists, persists to
`tka-practice-config`). The orchestrator passes `practiceState.userConfig` into
`practiceOrchestrator.start()` — already wired (`playback-controller` l.199).

**Primitive reuse (per never-hand-roll):**
- Steppers: reuse the +/- hold-to-repeat adjuster pattern from
  `TempoControl.svelte` (l.97–126, `.adjust-btn`). The `StepperCard` family
  (`shared/components/stepper-card/`) is heavy card UI for the generate flow —
  too large for a compact popover. Extract a minimal shared adjuster only if the
  three instances justify it (grep at impl time).
- Auto/Manual: **`SegmentedControl`**
  (`src/lib/shared/3d/components/controls/SegmentedControl.svelte`) — single-select,
  exactly-one-active is its job (per chip-primitives rule). No checkboxes.
- Popover container: **`ViewerPopover`**
  (`src/lib/shared/3d/components/controls/ViewerPopover.svelte`), or the
  inline-expand pattern `TempoControl` already uses (l.279–308). Confirm API at impl.

### 5. Self-paced progression (Auto / Manual)

Add `progressionMode: 'auto' | 'manual'` to `TempoPracticeConfig`
(`tempo-practice-orchestrator.ts`), default **manual**, persisted in `userConfig`.

- **Auto:** unchanged — `onLoopComplete()` bumps BPM after `roundsPerLevel`.
- **Manual:** `onLoopComplete()` increments the round counter but does **not**
  change BPM. When the round counter reaches `roundsPerLevel`, set a
  `readyToAdvance` flag on the progress object. The user taps a **Speed Up**
  button on the pill → new orchestrator method `advanceLevel()` bumps one
  increment (reusing `handleBpmChange`), resets the round counter, clears the flag.

`TempoPracticeProgress` gains `readyToAdvance: boolean` and `progressionMode`.
`PracticeProgressIndicator` renders a **Speed Up** button (next to Stop) only when
`progress.progressionMode === 'manual' && progress.readyToAdvance`. Auto mode is
visually unchanged.

## Components / files

**New:**
- `components/PracticeConfigPopover.svelte` — config + Auto/Manual. *Grep found no
  practice-config UI; the persisted config has never had one.*

**Modify:**
- `services/tempo-practice-orchestrator.ts` — `progressionMode`, `advanceLevel()`,
  manual `onLoopComplete`, `readyToAdvance` in progress.
- `state/tempo-practice-state.svelte.ts` — remove bests; `progressionMode` in config.
- `components/playback-controller.svelte.ts` — manual-mode handling, `advanceLevel`
  passthrough, strip best/toast.
- `components/SequenceViewerOrchestrator.svelte` — auto-switch-to-split in
  `handlePracticeStart`; expose `userConfig` / `updateConfig` / `advanceLevel` on ctx.
- `components/RouteViewerHeader.svelte` — inline desktop button + config anchor +
  re-pass to overflow.
- `routes/sequence/[id]/+page.svelte` — pass config/advance handlers.
- `components/SequenceViewerDrawerHost.svelte` — re-pass practice to overflow + rail.
- `components/PracticeProgressIndicator.svelte` — Speed Up button (manual).

**Unchanged (already correct):** `ViewerOverflowMenu`, `ViewerContentRail` — their
practice JSX just needs the props flowing again.

## Out of scope (flagged)

- **Orphaned dead code:** `ViewerFooter.svelte` + `DesktopFooterControls` /
  `MidFooterControls` / `LandscapeFooterControls` have no importers (grep confirmed).
  Their practice buttons are a red herring. Deleting them is a separate cleanup.
- A manual step-gated / quiz mode — overlaps the Train tab's practice
  (`features/train/components/practice/`), which is a distinct full-tab system.
  Not what a toolbar button implies.

## Verification plan

- `npm run check` green.
- Runtime (DevTools, with permission): on `/sequence/[id]` desktop, Practice button
  visible in header; click → starts at configured start BPM, loops, pill shows
  round progress. From mandala/tunnel, start auto-switches to Side-by-Side. Manual
  mode: BPM holds; Speed Up appears at round cap; tap bumps one increment. Stop →
  honest completion toast, no "best." Config popover persists across reload.
- Mobile width: Practice in overflow; config reachable from the pill.

## Open questions

None. Decisions locked above.
