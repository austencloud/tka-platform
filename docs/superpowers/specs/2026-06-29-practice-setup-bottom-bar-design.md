# Practice Setup → Bottom Bar Layout — Design

**Date:** 2026-06-29
**Status:** Approved (brainstormed 2026-06-29)

## Goal

Stop the practice SETUP screen from wasting space. Move the tempo config out of a
small card floating in a mostly-empty right column and into the already-reserved
bottom bar, with the read-ahead lane filling the right column in both phases. The
canvas stays a fixed 50% the whole time, so Start never jars it.

## Problem

On wide/4K displays the setup screen is mostly black:

- Canvas holds the left ~50%.
- The tempo-config card (`PracticeSetupPane`) floats in a mostly-empty right ~50%.
- The bottom bar row is **already reserved** (128px, for the running cockpit) but
  sits **empty** during setup — the cockpit only slides into it on Start.

So setup wastes both the right column *and* an empty bottom row. The right column
only earns its width during *running* (the read-ahead lane lives there).

## Decision (user-selected)

**Config to bottom bar, canvas fixed.** Chosen over "full-width canvas in setup +
glide on Start" because it honors the no-jar-on-Start constraint we deliberately
built (constant `practiceCanvasFraction = 0.5`).

## Design

### Layout — swap what lives where

| Region | Today | New |
|---|---|---|
| Right column | conveyor: setup-card ↔ lane | **lane always** (setup = static preview strip, running = live) |
| Bottom bar | cockpit only (slides in on Start) | **config ↔ cockpit** conveyor |
| Canvas | 50% fixed | 50% fixed (unchanged) |

Nothing resizes the canvas at Start. The only Start motion is the bottom bar's
config→cockpit swap. The lane is present in both phases (no appear/disappear).

### Components

- **New `PracticeSetupBar.svelte`** — horizontal config bar, ~128px tall (same
  height as the cockpit so the canvas never shifts vertically). Layout:
  `[ Creep · Staircase · Custom ]   hint text…   [ ⚙ ]   [ Start ▶ ]`
  - Reuses the existing preset logic from `PracticeSetupPane` (`matchPreset`,
    `PRESETS`, `pick`, `presetHint`) — moved in, not duplicated.
  - Segmented control: `SegmentedControl` (existing primitive), `size="sm"`.
  - **Custom** → opens `PracticeConfigPopover` (existing) anchored above the bar
    for the full ramp form. Picking Custom auto-opens it; the gear is also there
    for fine-tuning any preset. (Requires adding a bindable `open` prop to
    `PracticeConfigPopover`.) No inline form in the bar → bar height stays fixed.
  - Drops the redundant "Practice / Pick how the tempo climbs" title (the header
    already reads "Practice Mode").
- **`PracticeSetupPane.svelte`** — deleted. Only consumer was `ViewerSplitPane`'s
  right-column deck; nothing else imports it (grep-verified).
- **`PracticeConfigPopover.svelte`** — add a bindable `open?: boolean` prop so the
  bar can open it on Custom. Otherwise unchanged.

### Transitions

- **Practice enter (off→setup):** bottom bar slides in from the right carrying the
  config (the existing `.practice-bar-rise` reveal, now gated on `practiceActive`
  instead of `practiceRunning` so it shows in setup). Right-column lane slides in
  (existing `slideInRight`). Canvas glides into its practice size (unchanged work).
- **Start (setup→running):** inside the bottom bar, the config pane slides out left
  while the cockpit slides in from the right — same rightward conveyor the deck
  used, now in the bar. Lane stays put. Canvas stays put. All on `--ws-dur` /
  `wsEase`.
- **Reduced motion:** no slides (panes snap), per existing `prefers-reduced-motion`
  blocks.

### Bottom bar conveyor (both hosts)

`.practice-bar-rise` becomes a 2-pane conveyor (mirrors the deck pattern):

- Reserved (height) + translateX(0) when `practiceActive` (was: `practiceRunning`).
- `config-pane`: `translateX(0)` in setup, `translateX(-100%)` in running.
- `cockpit-pane`: `translateX(100%)` in setup, `translateX(0)` in running.
- `inert` per pane (config interactive in setup, cockpit in running).

## Files

- **Create:** `src/lib/shared/sequence-viewer/components/PracticeSetupBar.svelte`
- **Delete:** `src/lib/shared/sequence-viewer/components/PracticeSetupPane.svelte`
- **Edit:** `ViewerSplitPane.svelte` — right column → lane-always; drop the deck
  conveyor + `PracticeSetupPane`; remove now-unused `practiceConfig` /
  `onPracticeSetConfig` / `onPracticeStart` props (they flow host→bar now).
- **Edit:** `SequenceViewerDrawerHost.svelte` + route `+page.svelte` — bottom bar
  becomes the config↔cockpit conveyor; render `PracticeSetupBar` (config) +
  `PracticeBar` (cockpit); pass config props to the bar.
- **Edit:** `PracticeConfigPopover.svelte` — add bindable `open` prop.

## Constraints (must hold)

1. **No canvas resize at Start** — `practiceCanvasFraction` stays constant; bottom
   bar height constant between config and cockpit (both ~128px).
2. **No layout shift** — config↔cockpit swap is composited transform only; bar
   height never animates on Start (`no-layout-shift.md`).
3. **Reuse, don't hand-roll** — `SegmentedControl`, `PracticeConfigPopover`,
   `RampConfigForm`, `BeatStrip`/`PracticeLanePane` are existing; only
   `PracticeSetupBar` is new (a horizontal host for existing pieces).
4. **No checkboxes** — Custom/goal toggles use the button+indicator pattern
   (already true in `PracticeConfigPopover`).

## Out of scope

- The "full-width canvas in setup + glide on Start" alternative (rejected).
- Changing the tempo ramp model or the cockpit's running controls.
- Mobile/portrait practice layout (separate; this targets the wide split). Verify
  it doesn't regress, but no redesign here.

## Verification

- `npm run check` clean on all touched files.
- DevTools: enter practice → config bar present in bottom (not a floating card),
  right column shows lane preview, canvas at 50%. Start → config slides to cockpit,
  canvas + lane do not move (sample geometry: canvas box unchanged across Start).
- Reduced-motion: panes snap, no animation.
