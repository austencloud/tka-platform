# Assemble Tab: Idle State Layout Redesign

**Date:** 2026-03-22
**Status:** Approved
**Feedback:** rmbwjBwnaDpmoW1fvJ0d

## Problem

The assemble tab's idle state is a giant opaque gray square with "Tap a starting point" at the top. There's no guidance, no warmth, and massive wasted space on desktop. A first-time user has no idea what's about to happen or how the two-hand build process works.

## Design

### Desktop Idle State: Side-by-Side Layout

When the builder is idle (no steps placed), the layout splits into two columns:

- **Left panel (~35-40% width):** Guidance + configuration
- **Right panel (~60-65% width):** Interactive grid with pulsing hit targets

#### Left Panel Contents (top to bottom)

1. **Title:** "Build a Sequence" or similar short heading
2. **How-it-works blurb:** 2-3 short sentences explaining the process:
   - Tap a point to place your first prop
   - Tap another point to create a motion
   - Build blue hand, then switch to red
3. **Grid mode picker:** The existing pills (Diamond / Box / Merged) + Center toggle
4. **Hand switcher:** Blue/Red toggle (pre-positioned but starts on Blue)

The panel uses `var(--theme-panel-bg)` background with the standard card styling. No opaque walls — it should feel like it belongs with the background.

#### Right Panel

The existing InteractiveGrid, but with a more transparent background. The current 0.9 opacity dark gradient creates the "gray square" feeling. In idle state, we can reduce this significantly so the app's background bleeds through, making it feel less like a foreign object.

### Transition: Idle → Building

When the user taps their first grid point:

1. Left panel slides out (or fades) over ~200ms
2. Grid expands to fill the full width
3. Instruction text + hand switcher move to their current top-center positions (BuilderInstructionHeader)
4. Grid mode picker disappears (mode is locked)

This transition should use `prefers-reduced-motion` — if reduced motion, just swap instantly.

### Mobile Idle State

Side-by-side doesn't work on narrow screens. Instead:

- Guidance content renders as a compact card above the grid
- Grid mode picker + short blurb in the card
- Once building starts, the card collapses and the grid takes full height
- Falls back to current mobile overlay behavior (BuilderControls)

### Building State (Unchanged)

Once building, everything works exactly as it does today:
- Grid fills available space
- BuilderInstructionHeader shows phase instruction + hand switcher (desktop)
- BuilderControls overlay handles mobile interactions
- Grid mode is locked, picker hidden

## What This Does NOT Include

- Premium badges or gating UI
- Level progression checks
- Tutorial wizard or multi-step onboarding
- Changes to the grid's interactive behavior
- Changes to the turn bar or step strip

## Files to Change

- `AssembleToolPanel.svelte` — new idle-state layout wrapper
- `AssembleLabModule.svelte` — same for standalone lab
- `BuilderInstructionHeader.svelte` — hide during idle (guidance panel handles it)
- `InteractiveGrid.svelte` — reduce background opacity in idle
- New: `AssembleIdlePanel.svelte` — the left/top guidance panel
