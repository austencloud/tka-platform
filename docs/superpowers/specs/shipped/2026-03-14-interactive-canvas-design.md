# InteractiveCanvas — Unified Builder Surface

> Replace all builder grids with a single composable component: AnimatorCanvas (rendering) + HitTargetOverlay (click detection). One rendering surface, every builder.

**Goal:** Every interactive builder in TKA (assemble tab, hand path builder, future builders) renders through AnimatorCanvas and captures clicks through a shared SVG overlay. Business logic stays in the parent. The canvas is dumb.

**Architecture:** Composition, not modification. AnimatorCanvas stays untouched. A new `InteractiveCanvas` wrapper layers a transparent SVG hit target overlay on top. Parents construct `PropState` objects and minimal `StepData` to tell the canvas what to render, and handle `onPointClick` to decide what clicks mean.

---

## Layer Stack

```
z-index 10:  HitTargetOverlay (SVG, pointer-events: auto on circles)
z-index  5:  GlyphOverlay (existing — step numbers, TKA glyph)
z-index  0:  Canvas2D (existing — props, effects, grid, trails)
```

All layers share `.canvas-wrapper` as their positioning context (`position: relative`). Each overlay is `position: absolute; top: 0; left: 0; width: 100%; height: 100%` with `viewBox="0 0 950 950"`.

---

## New Components

### `src/lib/shared/interactive-canvas/InteractiveCanvas.svelte`

Thin wrapper. Renders AnimatorCanvas and HitTargetOverlay as siblings inside a container.

**InteractiveCanvas-specific props:**

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `interactive` | `boolean` | `true` | Show/hide hit target overlay |
| `gridMode` | `GridMode` | `GridMode.DIAMOND` | Grid mode for both grid rendering and hit target placement |
| `onPointClick` | `(location: GridLocation) => void` | — | Emitted when user taps a grid point |
| `activePhaseColor` | `"blue" \| "red" \| null` | `null` | Which color the hit targets pulse (null = neutral) |
| `currentPosition` | `GridLocation \| null` | `null` | Which hit target shows the "selected" ring |
| `disabled` | `boolean` | `false` | Disable all hit targets (e.g., during animation) |
| `animationLayer` | `Snippet` | — | Optional SVG overlay for prop animation (z-index 8) |

**AnimatorCanvas props passed through (builder-relevant subset):**

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `stepData` | `StartPositionData \| StepData \| null` | `null` | Metadata for glyph overlay (letter, beat number) |
| `blueProp` | `PropState \| null` | `null` | Blue prop position + rotation |
| `redProp` | `PropState \| null` | `null` | Red prop position + rotation |
| `gridVisible` | `boolean` | `true` | Show/hide grid lines |
| `backgroundAlpha` | `number` | `1` | Background opacity |

All other AnimatorCanvas props (sequenceData, fire/LED/trail configs, isPlaying, etc.) are passed through via `{...restProps}` for consumers that need them (e.g., effects preview).

The component does NOT contain business logic. It does not know what "assemble" or "hand path" means. It renders and emits.

**Template structure:**

```svelte
<div class="interactive-canvas-wrapper">
  <AnimatorCanvas
    {gridMode}
    {gridVisible}
    {stepData}
    {blueProp}
    {redProp}
    {...restProps}
  />
  {#if animationLayer}
    <svg class="animation-overlay" viewBox="0 0 950 950" style="z-index: 8;">
      {@render animationLayer()}
    </svg>
  {/if}
  {#if interactive}
    <HitTargetOverlay
      {gridMode}
      {activePhaseColor}
      {currentPosition}
      {disabled}
      {onPointClick}
    />
  {/if}
</div>
```

### `src/lib/shared/interactive-canvas/components/HitTargetOverlay.svelte`

Transparent SVG layer with clickable circles at grid positions.

**Props:**

| Prop | Type | Purpose |
|------|------|---------|
| `gridMode` | `GridMode` | Determines which grid points to show |
| `activePhaseColor` | `"blue" \| "red" \| null` | Pulse color for available targets |
| `currentPosition` | `GridLocation \| null` | Highlighted position |
| `disabled` | `boolean` | Disable all interaction |
| `onPointClick` | `(location: GridLocation) => void` | Click callback |

**Rendering:**
- Uses `GridHitTargetCalculator.getHitTargets(gridMode)` for positions
- Uses `GridHitTargetCalculator.getHitTargetRadius()` for circle size
- Each circle: `role="button"`, `tabindex="0"`, `aria-label`, keyboard handler
- Phase-colored pulse animation on available targets (same CSS as current InteractiveGrid)
- `pointer-events: none` on the SVG root, `pointer-events: auto` on each circle

---

## Data Flow

### How AnimatorCanvas Renders Props

AnimatorCanvas renders props via two separate input channels:

1. **`blueProp` / `redProp` (`PropState`)** — Drives prop position and rotation on the Canvas2D surface. This is what makes the prop appear at a grid location.
2. **`stepData` (`StepData`)** — Provides metadata for the glyph overlay (letter, beat number, turns tuple). Does NOT directly control prop position.

```typescript
// PropState (from animation-engine/domain/PropState.ts)
interface PropState {
  centerPathAngle: number;    // Angular position on the grid circle
  staffRotationAngle: number; // Rotation of the prop itself
  x?: number;                 // Cartesian X (only for dash motions)
  y?: number;                 // Cartesian Y (only for dash motions)
}
```

For hand path builders, `staffRotationAngle` is always 0 (hands don't rotate).

### Hand Path Builder

```
User taps South
  → HitTargetOverlay emits onPointClick(GridLocation.SOUTH)
  → HandPathBuilderLab.handleClick(loc):
      1. If previous location exists, animate hand from prev → loc
         (HandPathAnimator on animation overlay, effort easing, arc/linear path)
      2. After animation: builderState.addLocation(loc)
      3. Construct PropState for each hand:
         blueProp = { centerPathAngle: LOCATION_ANGLES[blueLoc], staffRotationAngle: 0 }
         redProp = { centerPathAngle: LOCATION_ANGLES[redLoc], staffRotationAngle: 0 }
         (For dashes: use x/y Cartesian instead of centerPathAngle)
      4. Pass blueProp + redProp to InteractiveCanvas
  → AnimatorCanvas renders hand at new position
```

### Assemble Tab

```
User taps East
  → HitTargetOverlay emits onPointClick(GridLocation.EAST)
  → AssembleLabModule.handleClick(loc):
      1. builderState.handlePointClick(loc)
         (adds motion step with rotation direction, orientation)
      2. Animate prop via SvgPropAnimator (animation overlay layer)
      3. Construct PropState from latest builder step:
         blueProp = { centerPathAngle, staffRotationAngle }
         redProp = { centerPathAngle, staffRotationAngle }
      4. Construct minimal StepData for glyph overlay (letter, beat number)
      5. Pass blueProp + redProp + stepData to InteractiveCanvas
  → AnimatorCanvas renders prop at new position with correct rotation
```

### PropState Construction

Each builder parent creates a factory that converts its state into `PropState` objects. This is the primary rendering input — it controls where props appear and how they're rotated.

**Hand path builder (`HandPropStateFactory`):**

```typescript
// src/lib/features/hand-path-builder/services/HandPropStateFactory.ts
import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";

function locationToPropState(loc: GridLocation): PropState {
  return {
    centerPathAngle: LOCATION_ANGLES[loc],
    staffRotationAngle: 0, // Hands never rotate
  };
}
```

Trivial — one function, ~20 lines. Hands don't rotate, so `staffRotationAngle` is always 0. For dashes (opposite locations), the existing `HandPathAnimator` already handles Cartesian coordinates during animation.

**Assemble tab:** Already computes prop rotation internally via `PropRotAngleManager`. The existing logic maps directly to `PropState.staffRotationAngle`.

**StepData (optional, for glyph overlay):**

StepData is only needed when the builder wants the glyph overlay to show a letter or beat number. For the hand path builder, this is not needed in Phase 1. For the assemble tab, the existing step data construction already produces valid `StepData`.

### Ghost Prop Handling (Phase 2)

The assemble tab shows a "ghost" of the inactive hand at its current position. With InteractiveCanvas, this maps naturally to `blueProp` + `redProp` — both are always set, one for the active hand and one for the inactive hand. The inactive hand's `PropState` simply doesn't change when the active hand moves. No special ghost rendering needed.

---

## Animation Overlay

Prop animation (the hand or prop moving between locations) cannot happen inside the Canvas2D layer — that's a full re-render per frame. Instead, animation uses an SVG `<g>` element overlaid on the canvas, same as the current InteractiveGrid approach.

InteractiveCanvas accepts an optional `animationLayer` snippet/slot that parents can use to render animated SVG elements on top of the canvas. The animation overlay sits at z-index 8 (between GlyphOverlay at 5 and HitTargetOverlay at 10).

After animation completes, the parent updates `stepData` so the Canvas2D renderer shows the prop at its final position, and the SVG animation element is removed.

---

## Migration Path

### Phase 1: InteractiveCanvas + Hand Path Builder

1. Create `InteractiveCanvas.svelte` and `HitTargetOverlay.svelte`
2. Create `HandPropStateFactory.ts` — converts builder locations to PropState
3. Replace `BuilderGrid.svelte` with InteractiveCanvas in `HandPathBuilderLab.svelte`
4. Hand path builder now renders through AnimatorCanvas with effects

### Phase 2: Assemble Tab Migration

1. Replace `InteractiveGrid.svelte` usage in `AssembleLabModule.svelte` with InteractiveCanvas
2. Move prop animation logic (SvgPropAnimator) to the animation overlay layer
3. Move ghost prop rendering to synthetic StepData (canvas renders both hands)
4. Delete `InteractiveGrid.svelte` (754 lines)

### Phase 3: Cleanup

1. Remove BuilderGrid.svelte and HandPathAnimator.ts (animation moves to overlay pattern)
2. Audit and remove any orphaned SVG-only rendering code
3. Update tests

---

## What Stays the Same

- **AnimatorCanvas:** Zero changes. Pure renderer, no new props.
- **GridHitTargetCalculator:** Reused as-is. Currently lives in `assemble-lab/services/`. HitTargetOverlay imports it cross-feature, which is acceptable because: (a) it's a pure calculator with no assemble-lab dependencies, and (b) moving it to `shared/` is a Phase 3 cleanup task, not a blocker.
- **State factories:** Each builder keeps its own state pattern.
- **Context pattern:** Unchanged.
- **Effects:** Fire, LED, trails work automatically because AnimatorCanvas renders them.
- **GridSvg:** Still renders inside AnimatorCanvas as it does today.

## What's New

| Component | Lines (est.) | Purpose |
|-----------|-------------|---------|
| `InteractiveCanvas.svelte` | ~80 | Wrapper: AnimatorCanvas + overlay |
| `HitTargetOverlay.svelte` | ~120 | SVG click targets |
| `HandPropStateFactory.ts` | ~30 | Builder locations → PropState |

## What's Deleted (Phase 2+)

| Component | Lines | Replaced by |
|-----------|-------|-------------|
| `InteractiveGrid.svelte` | 754 | InteractiveCanvas + parent logic |
| `BuilderGrid.svelte` | 250 | InteractiveCanvas + parent logic |

Net: ~260 lines added, ~1000 lines deleted.

---

## File Structure

```
src/lib/shared/interactive-canvas/
  InteractiveCanvas.svelte
  components/
    HitTargetOverlay.svelte

src/lib/features/hand-path-builder/
  services/
    HandPropStateFactory.ts      (new — locations → PropState)
    HandPathAnimator.ts          (existing, used for overlay animation)
```

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| AnimatorCanvas perf with frequent StepData updates | Canvas only re-renders on prop state change, not every frame. Static frames are cheap. |
| Hit target alignment with canvas grid | Both use 950x950 coordinate system + GridHitTargetCalculator. Already proven by GlyphOverlay. |
| Breaking existing AnimatorCanvas consumers | Zero changes to AnimatorCanvas. Pure composition. |
| Assemble tab regression during Phase 2 | Phase 2 is separate. Hand path builder validates the pattern first. |
