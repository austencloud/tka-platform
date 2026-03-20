# Fuse Tab: Proper Hand Path / Solo Prop Rendering

**Date:** 2026-03-20
**Status:** Ready for implementation
**Depends on:** Fuse tab shuffle UX (implemented), backfilled artifact data (done)

## Problem

The Fuse tab currently renders hand paths by loading a full source sequence, stripping one color's motions via `filterSoloMotions()`, and rendering the remainder through the standard ChoreoCard pipeline. This produces broken results:

1. **Letters shown in header** — letters are defined by what BOTH hands do together. One hand alone doesn't produce a letter. The word "BBLF" is meaningless when viewing only the blue hand.
2. **Arrow rotation errors** — the renderer expects paired motion context. Solo rendering produces incorrect SVG rotations.
3. **Dashes showing 0.5 turns** — source sequence turn data carries through but is irrelevant to hand trajectory visualization.
4. **Burdened by source sequence data** — we're rendering a mutilated full sequence, not a clean hand path.

## What a Hand Path Actually Is

A hand path is a list of grid locations: `[s, w, n, e, s, w, n, w]`. That's it.

When rendering a hand path, you should see:
- A hand icon at the starting grid location
- An arrow showing the direction of movement to the next location
- The grid dots for spatial context
- Beat numbers for temporal reference

What you should NOT see:
- Letters (those require two hands)
- Orientation arrows (in/out/cw/ccw) — not relevant to trajectory
- Turn values — not relevant to trajectory
- Prop-specific rendering (staffs, fans, clubs) — just a hand dot
- The source sequence's word

## Solution

Two rendering modes for the Fuse tab shuffle cards:

### Mode 1: Solo Prop Path (current "Prop Paths" toggle)

Shows one prop's full motion data (location, motion type, orientation, turns) rendered through the existing pipeline. This is close to what we have but needs:

- **Remove word/letters from header** — show "Blue Prop Path" or "Red Prop Path" instead
- **Remove letter labels under each beat** — replace with location labels (N, E, S, W, etc.)
- **Keep the existing prop rendering** (arrows, rotation, orientation) since that's what distinguishes prop paths from hand paths

### Mode 2: Hand Path (current "Hand Paths" toggle)

Shows only the trajectory through grid locations. This needs a new rendering approach:

- **No props rendered** — just a colored dot at the grid location
- **Arrow between consecutive locations** showing direction of travel
- **Beat numbers** at each position
- **Grid dots** for spatial context
- **Start position highlighted** (e.g., green dot or ring)

This could be implemented as:
1. A new `handPathMode` rendering in the existing pictograph renderer (it already has a `handPathMode` prop)
2. OR a simpler dedicated component that just draws dots + arrows on a grid

## Existing Infrastructure

### Already implemented:
- `ChoreoCard.svelte` accepts `handPathMode?: boolean` prop (line 111)
- `ChoreoCard.svelte` accepts `browseViewMode?: BrowseViewMode` prop (just added)
- `PreviewCellRenderer.filterSoloMotions()` strips one color's motions
- `AnimatorCanvas` accepts `blueProp={null}` / `redProp={null}` to hide one prop
- `handPathMode` flag is threaded through the thumbnail rendering pipeline (recent commits show this)
- The Fuse tab shuffle loads full sequences and passes `browseViewMode` with `granularity: "solo"` and `color: "blue"|"red"`

### Key files:
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` — the choreo card component
- `src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts` — renders individual pictograph cells, has `filterSoloMotions()` and `browseViewMode` support
- `src/lib/features/fuse/components/FuseSequenceBrowser.svelte` — the shuffle card that renders ChoreoCard
- `src/lib/features/fuse/components/FuseAnimationPreview.svelte` — the post-pick animation preview, already has `propColor` prop that nulls out one prop
- `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` — split canvas rendering for solo props already exists (used in disassemble)

### Data available:
- `SoloPropData` — has steps with startLocation, endLocation, motionType, orientation, turns
- `HandPathData` — has `locations: string[]` (the pure trajectory), contentHash, startLocation, endLocation, length, impliedGridMode
- `SoloPropStepData` — has startLocation, endLocation, startOrientation, endOrientation, motionType, rotationDirection, turns
- All backfilled: 612 hand paths + 828 solo props in user's collection, 617 + 811 in public

## Implementation Plan

### Task 1: Fix ChoreoCard Header for Solo/Hand Mode

**Files:** `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

When `browseViewMode?.granularity === "solo"`:
- Hide the sequence word from the header (or show "Blue Prop" / "Red Prop" based on `browseViewMode.color`)
- Hide letter labels under each beat cell (letters are meaningless for solo rendering)
- Hide difficulty level badge
- Hide LOOP glyph (LOOP is a dual-prop concept)

When `browseViewMode?.subject === "hands"`:
- Additionally hide orientation arrows and turn indicators
- Show only location dots and movement direction

### Task 2: Fix Arrow Rendering for Solo Props

**Files:** `src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts`

Investigate why arrow rotations are incorrect when one color is stripped. The `filterSoloMotions()` method deletes `motions.red` or `motions.blue`, but the renderer might use the missing color's data for relative calculations. Fix the renderer to gracefully handle single-color motion data.

### Task 3: Location Labels Instead of Letters

**Files:** `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

When in solo mode, replace the letter label under each beat with the end location of that beat's motion (e.g., "N", "E", "SW"). This gives useful information about where the hand/prop ends up each beat.

### Task 4: Hand Path Mode Rendering

**Files:** Investigate `handPathMode` flag already in the pipeline

The `handPathMode` prop already exists on ChoreoCard and is threaded through to render options. Research what it currently does:
- Search for `handPathMode` usage in the renderer
- Check if it already produces a simplified hand-path visualization
- If so, wire it into the Fuse tab when `mode === "handPaths"`

If `handPathMode` already works correctly, this task is just wiring it in the Fuse tab.

### Task 5: Animation Preview Single-Prop Fix

**Files:** `src/lib/features/fuse/components/FuseAnimationPreview.svelte`

The animation preview already passes `propColor` to null out one prop in AnimatorCanvas. Verify this works correctly:
- Blue panel should show only blue prop animating
- Red panel should show only red prop animating
- No "skipping beat without motion data" warnings (those came from feeding SoloPropData, now we feed full SequenceData)

### Task 6: Refresh Navigation Fix

**Files:** `src/lib/shared/navigation-coordinator/navigation-coordinator.svelte.ts` (already fixed — "fuse" added to TAB_ORDERS)

Debug why refreshing on `/create/fuse` bounces to construct:
- The URL parsing at line 279-285 in navigation-state.svelte.ts should set `activeTab = "fuse"`
- Check if CreateModule initialization overrides this
- Check if `module-state.ts` line 144-160 `canAccessTab` check is failing
- Add console.log to trace the exact tab value through initialization

### Task 7: Individual LOOP Detection for Hand Paths

**Files:** New — this is a discovery feature

Some individual hand paths are LOOPs on their own (visiting all grid points and returning home). Add a flag or filter to identify these. The existing LOOP detection logic can be adapted for single-hand paths:
- A hand path is a solo LOOP if it visits all 4 cardinal locations (for diamond) or all 4 intercardinal locations (for box) and returns to start
- This enables a "Show only LOOPs" filter in the shuffle

## Key Insight: Source Sequence vs Clean Hand Path

The current approach loads source sequences and strips one color. This works for prop path mode but is wrong for hand path mode. For hand paths:

**Option A (simpler):** Keep loading source sequences, but in hand path mode, extract just the location sequence from the steps and render with the simplified hand-path renderer. The data is: `steps.map(s => s.motions[color].endLocation)`.

**Option B (cleaner):** Load `HandPathData` directly from the hand path repository. It has a `locations` array which is the pure trajectory. But this data doesn't have the structure ChoreoCard expects, so it needs either:
- A dedicated hand path card component (different from ChoreoCard)
- Or an adapter that wraps HandPathData into the format ChoreoCard needs

**Recommendation:** Option A for now, Option B later. Option A lets us ship quickly using existing infrastructure. The `handPathMode` flag on ChoreoCard was designed for exactly this purpose.
