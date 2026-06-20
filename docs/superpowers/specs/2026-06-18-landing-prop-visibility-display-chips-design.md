# Landing Prop Visibility + Display Chips — Design

**Date:** 2026-06-18
**Surface:** Landing page "Infinite Spinner" (`PlayWithItInner.svelte`) → AnimationPanel Display section.

## Problem

On the landing spinner there is no way to show/hide the blue or red prop
independently (the sequence viewer solves this with the red/blue header
buttons). Separately, the Display section renders iOS-style toggle indicators
where the rest of the app uses chips.

Two independent variables the user wants exposed:
- **Prop existence** per color (blue / red) — the spinning prop + its trail.
- **Path-line existence** per color — already exists (`bluePathLines` /
  `redPathLines` chips), must stay orthogonal.

## Key realization — reuse the viewer mechanism, build nothing new

The sequence viewer already implements per-color prop visibility:

- `SequenceViewerVisibilityState` (`blueMotion` / `redMotion`, `toggleBlue/Red`)
  is provided via `viewer-visibility-context`.
- `CanvasSurface.svelte` (lines ~197–204) reads the context with
  `tryGetViewerVisibilityContext()` and calls
  `engine.setMotionVisibility(blueMotion, redMotion)`.
- `animation-render-loop.ts` gates **both the prop and its trail** on
  `blueMotionVisible` / `redMotionVisible`
  (`visibility.blueMotionVisible && props.blueProp !== null`). Path lines
  (`PathLinesOverlay`) are driven separately by the `bluePathLines` /
  `redPathLines` visibility keys, so they remain independent.
- The shared **`MotionColorChips`** component (Left = blue, Right = red) is the
  control the viewer renders for this.

The landing simply never provides `viewer-visibility-context`, so
`setMotionVisibility` is never called and both props are always visible.

## Decisions (locked)

1. **Both props may be off at once** (fully independent), diverging from the
   viewer's at-least-one rule.
2. **Replace** the single master "Props" toggle with the Left/Right pair on the
   landing (where the per-color context exists).
3. **Labels: Left / Right** — reuse `MotionColorChips` verbatim.

## Changes (4 files, all reuse)

### 1. `sequence-viewer/state/viewer-visibility-state.svelte.ts`

Add an opt-in to allow the empty (both-off) state:

```ts
constructor(private allowNone = false) {}
```

In `setBlueMotion` / `setRedMotion`, skip the "flip the other back on" guard
when `allowNone` is true:

```ts
setBlueMotion(visible: boolean): void {
  if (!visible && !this.redMotion && !this.allowNone) {
    this.blueMotion = false; this.redMotion = true; return;
  }
  this.blueMotion = visible;
}
```

(`reset()` still restores both true.) Viewer behavior unchanged — it constructs
with no argument, so `allowNone` defaults `false`.

### 2. `routes/landing/components/PlayWithItInner.svelte`

Provide the context once, ephemeral to this surface:

```ts
import { SequenceViewerVisibilityState } from "$lib/shared/sequence-viewer/state/viewer-visibility-state.svelte";
import { setViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";

setViewerVisibilityContext(new SequenceViewerVisibilityState(true)); // allowNone
```

No other landing change — `CanvasSurface` already consumes it and gates the
prop + trail.

### 3. `animation-engine/components/settings-panels/DisplayPanel.svelte`

- `const viewerVis = tryGetViewerVisibilityContext();`
- When `viewerVis` is present: render a `MotionColorChips`
  (`showBlue={viewerVis.blueMotion}` / `showRed={viewerVis.redMotion}`,
  `onToggleBlue={() => viewerVis.toggleBlue()}` / red), and **omit** the master
  `props` entry from the toggle list. When absent: keep the `props` entry,
  render no MotionColorChips (other surfaces unchanged).
- Convert the remaining display toggles (Grid, TKA Glyph, Step #, Word,
  Progress, Blue path, Red path) from the hand-rolled `rt-chip` buttons and the
  iOS `toggle-row` indicators to **`FilterChipBase mode="toggle"`**
  (chip-primitives rule). Both `variant="rows"` and `variant="chips"` render the
  same `FilterChipBase` flow (sidebar wraps); the iOS toggle indicator markup is
  removed.

### 4. `MotionColorChips.svelte`

Reused verbatim. No change.

## Data flow

Left/Right chip → `viewerVis.toggle*` → `CanvasSurface` `$effect` →
`engine.setMotionVisibility` → render loop gates prop + trail. "Blue path" /
"Red path" chips → `bluePathLines` / `redPathLines` vm keys → `PathLinesOverlay`.
The two paths never touch, so prop-off/path-on and prop-on/path-off both hold.

## Testing

- Unit: `SequenceViewerVisibilityState(true)` permits both-off
  (`setBlueMotion(false)` with red already off leaves both false); default
  (no arg) still flips the other on. Existing reset semantics unchanged.
- Manual (user): landing spinner Display section shows Left/Right prop chips +
  chip-style display toggles (no iOS sliders); toggling Left/Right hides that
  prop + its trail while the matching path line still obeys its own chip.

## Out of scope

- No change to the real sequence viewer's at-least-one behavior.
- No new visibility-manager keys (prop gating rides the existing
  motion-visibility render path, not the `props` key).
