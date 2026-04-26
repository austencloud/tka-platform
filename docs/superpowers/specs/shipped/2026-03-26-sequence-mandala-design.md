# Sequence Mandala Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Summary

Every LOOP sequence produces a unique mandala by tracing the prop tip paths through one full loop cycle. Blue hand traces one set of curves, red traces another, overlay = mandala. This mandala becomes a first-class visual identity for sequences: the hero element on card backs, a standalone gallery view, an animated draw-on during playback, and a decomposed educational view showing how each hand contributes.

## Motivation

VTG (Vulcan Tech Gospel) practitioners already know flower patterns — the petal shapes traced by spinning props. TKA sequences produce these same shapes. By rendering them as static 2D mandalas, we:

- Give every choreo card a unique front AND back
- Demonstrate the flower patterns people know from VTG
- Create an array of beautiful kinetic alphabet mandalas
- Bridge old ways of thinking (VTG flowers) with TKA notation

## Scope

- LOOP sequences only. Non-LOOP sequences do not get mandalas.
- Printing is only planned for LOOP sequences.

---

## Architecture

### New Services

**`MandalaGeometryCalculator`**
- Replicates the animation engine's interpolation math headlessly
- Input: `SequenceData` (step array + prop types)
- Output: `MandalaPaths { blue: SVGPathData[], red: SVGPathData[] }`
- Each `SVGPathData = { d: string, endType: 0 | 1 }`

**`MandalaRenderer`**
- Takes `MandalaPaths` + render options
- Outputs SVG element string or Svelte snippet
- Handles stroke vs filled modes, grid dots, sizing

### New Component

**`SequenceMandala.svelte`**
- Props: `sequence`, `mode`, `style`, `showGridDots`, `size`
- Calls calculator via DI container
- Renders SVG with appropriate styling per context

### DI Registration

New `sequence-mandala-container.ts` in `src/lib/shared/di/containers/` with:
- `mandalaGeometryCalculator`
- `mandalaRenderer`

Note: `mandala-container.ts` already exists for the Arrow Mandalas lab experiment. The new container uses a distinct name to avoid collision.

### Existing Module Rename

The existing `mandala-generator` module (arrow arrangement tool) gets renamed to "Arrow Mandalas" in lab navigation. Different concept, stays as a lab experiment.

---

## Headless Interpolation Pipeline

The `MandalaGeometryCalculator` replicates the exact math from these existing services:

### Endpoint Calculation (from `EndpointCalculator`)

Per step, computes:
- `startCenterAngle`, `targetCenterAngle` — hand path start/end on the grid circle
- `startStaffAngle` — prop orientation at step start
- `staffRotationDelta` — total prop rotation during the step

Rotation delta formulas per motion type:
- **PRO:** `staffDelta = centerMovement + (dir * turns * PI)`
- **ANTI:** `staffDelta = -centerMovement + (dir * turns * PI)`
- **STATIC (with turns):** `staffDelta = dir * turns * PI` (no center movement, prop rotates in place)
- **STATIC (no turns):** `staffDelta = normalizeAngleSigned(targetStaffAngle - startStaffAngle)` (shortest-path orientation change)
- **DASH (with turns):** `staffDelta = dir * turns * PI` (hand path is Cartesian lerp, prop rotates)
- **DASH (no turns):** `staffDelta = normalizeAngleSigned(targetStaffAngle - startStaffAngle)` (orientation-only)
- **FLOAT:** `staffDelta = 0`

Where `dir = +1` for CW, `-1` for CCW. 1 turn = PI radians (180 degrees).

### Interpolation (from `PropInterpolator`)

For each sample point at `t = 0.0 -> 1.0`:

**Circular motions (PRO, ANTI):**
```
centerAngle = lerpAngle(startCenterAngle, targetCenterAngle, t)
handX = cos(centerAngle) * R
handY = sin(centerAngle) * R
```

Always use arc interpolation (the default). The `PropInterpolator.shouldUseLinear()` toggle depends on animation visibility state that doesn't exist in the headless context. Arc mode is the canonical representation.

**STATIC / FLOAT motions:**
```
handX = cos(startCenterAngle) * R    // Hand stays at start position
handY = sin(startCenterAngle) * R
```

The hand does not move. For STATIC, the prop rotates via `staffRotationDelta`. For FLOAT, the prop also does not rotate (`staffDelta = 0`), so the tip traces no path — it produces a single point (omit from mandala output).

**DASH motions:**
```
x = cos(startCenterAngle) + (cos(targetCenterAngle) - cos(startCenterAngle)) * t
y = sin(startCenterAngle) + (sin(targetCenterAngle) - sin(startCenterAngle)) * t
handX = x * R
handY = y * R
```

Note: DASH radius varies — drops to 0 at center when hand crosses through middle.

**Staff angle (all types):**
```
staffAngle = startStaffAngle + staffRotationDelta * t
```

**Angle interpolation** uses shortest-path signed normalization (same as `AngleCalculator.lerpAngle`):
```
lerpAngle(a, b, t) = normalizePositive(a + normalizeAngleSigned(b - a) * t)
```

### Tip Position (from `FireTipTracker` / `PropPositionCalculator`)

```
tipX = handX + (dx * cos(staffAngle) - dy * sin(staffAngle))
tipY = handY + (dx * sin(staffAngle) + dy * cos(staffAngle))
```

Where `(dx, dy)` comes from the prop's tip point definition.

### Tip Selection

Uses the existing **trail tip assignment system**, not the full tip point registry. Props can have many tip points (fan has 5, hoop has 5, doublestar has 4), but the trail system assigns exactly 2 endpoints (left and right) per prop via `getTrailPointConfig(propType)`. The mandala traces these same 2 trail endpoints, not all available tips.

Resolution per prop:
1. Check `getTrailPointConfig(propType)` for admin-configured assignments
2. If no config, fall back to defaults: left = tip index 0, right = tip index 1 (or 0 if single-tip)
3. **Bilateral props** (staff, buugeng): left and right are different tips → 2 paths per hand → 4 total (blue-left, blue-right, red-left, red-right)
4. **Unilateral props** (fan, club): both left and right are forced to the same tip → 1 unique path per hand → 2 total (blue, red)

This matches `TrailOverlayCanvas`'s 4 ring buffer model exactly.

### Sampling

- Base rate: 64 points per beat per tip
- Adaptive: for high-turn motions (1.5+ turns per beat), increase to `64 * ceil(turns)` to maintain curve fidelity at high curvature
- 4-beat LOOP at base rate: 256 points per path
- 8-beat LOOP at base rate: 512 points per path
- Points converted to SVG cubic bezier paths using Catmull-Rom to Bezier conversion (same spline family the trail renderer already uses in `Canvas2DTrailRenderer`)

---

## Rendering

### Two Visual Styles (Toggle)

**Stroke overlay (default):**
- Blue paths: stroke `#2e3192`
- Red paths: stroke `#ed1c24`
- Line width scales with mandala size
- Bilateral props produce denser patterns (4 curves instead of 2)

**Filled petals:**
- Same paths, closed and filled with semi-transparent color
- Blue: `rgba(46, 49, 146, 0.2)`
- Red: `rgba(237, 28, 36, 0.2)`
- Overlapping regions blend naturally

### Grid Dots (Context-Dependent)

- **Card back:** No dots. The mandala stands alone as art.
- **Gallery / animated views:** 8 cardinal/intercardinal dots + center dot. Educational reference frame matching VTG tradition.

---

## Integration Points

### Card Back (V5)

The mandala integrates into the existing V5 card back layout ("Deck" theme):

- **Layout:** Word at top, mandala as center hero, LOOP explanation text below
- **Style:** Stroke-only, no grid dots
- **Sizing:** Mandala fills available center space (~300px diameter in the 500x700 card)
- **Corner badges preserved:** Level (top-left), LOOP icons (top-right), step count (bottom-left), start position (bottom-right)
- **Only for LOOP sequences** — non-LOOP cards keep existing V5 layout without mandala

### Gallery / Browser View

- Standalone `SequenceMandala` alongside or instead of the pictograph grid
- Toggle between stroke and filled rendering modes
- Grid dots visible
- Decomposed equation view available: three mandalas side by side (blue-only + red-only = combined)

### Animation Player

- Mandala draws progressively during playback using SVG `stroke-dasharray` + `stroke-dashoffset`
- Path draws beat by beat, synced to the animation player's current step progress
- `SequenceMandala` receives `currentStep: number` (0.0 to totalSteps) as a prop from the player, maps it to a `stroke-dashoffset` percentage
- Full mandala visible when loop completes
- Resets on loop restart

### Decomposed Equation View (Gallery Only)

- Three `SequenceMandala` instances: blue-only, red-only, combined
- Shows how each hand's path contributes to the final shape
- Educational context for understanding hand independence in VTG tradition
- Not on card back — too space-constrained

---

## File Structure

```
src/lib/shared/mandala/
  services/
    contracts/
      IMandalaGeometryCalculator.ts
      IMandalaRenderer.ts
    implementations/
      MandalaGeometryCalculator.ts
      MandalaRenderer.ts
  domain/
    mandala-types.ts          # MandalaPaths, SVGPathData, RenderOptions
  components/
    SequenceMandala.svelte    # Main component

src/lib/shared/di/containers/
  sequence-mandala-container.ts   # DI registration (distinct from existing mandala-container.ts)
```

### Key Dependencies

| New Service | Depends On |
|-------------|------------|
| MandalaGeometryCalculator | AngleCalculator (reuse), getTipPoints(), getTrailPointConfig() |
| MandalaRenderer | MandalaGeometryCalculator |
| SequenceMandala.svelte | MandalaRenderer via DI |

### Existing Files Modified

| File | Change |
|------|--------|
| `CardBackV5.svelte` | Add `SequenceMandala` in center content area for LOOP sequences |
| `module-definitions.ts` | Rename mandala-generator label to "Arrow Mandalas" |
| `MandalaGeneratorModule.svelte` | Update heading/description to clarify "Arrow Mandalas" concept |
| `src/lib/shared/di/index.ts` | Wire sequence-mandala-container into composition root |
| `src/lib/shared/di/container-types.ts` | Add SequenceMandalaContainer type |

---

## Design Decisions

### Shared Math vs Replicated Math

The `MandalaGeometryCalculator` replicates interpolation math from `EndpointCalculator` and `PropInterpolator`. Ideally, the pure math functions would be extracted into shared utilities that both the animation engine and mandala calculator call. However, the animation engine services have UI/animation state dependencies (easing, visibility manager, effort presets). The mandala calculator needs the pure math without those dependencies.

**Decision:** Replicate the core math (angle lerp, endpoint calculation, tip transform) in the mandala calculator. Reuse `AngleCalculator` directly since it's already pure. If the interpolation math changes in the animation engine, the mandala calculator must be updated to match. Document this coupling in code comments.

### Card Back Rendering Pipeline

The `CardBackV5.svelte` Svelte component can embed SVG directly for on-screen display. However, the print pipeline uses `CardBackCanvasRenderer` (Canvas 2D API, no DOM/SVG). For print:

- The `MandalaRenderer` must also output Canvas 2D path commands (not just SVG strings)
- Or: rasterize the SVG to an `Image` element, then draw on canvas via `ctx.drawImage()`
- **Decision:** Support both output modes in `MandalaRenderer` — SVG string for Svelte component, Canvas 2D draw commands for print renderer. The geometry calculator output (point arrays) is format-agnostic; the renderer adapts to the target.

### Geometry Caching

Mandala geometry is deterministic given sequence data + prop type. Computing hundreds of trig calls per render is cheap for a single mandala, but card galleries showing dozens of card backs benefit from caching.

**Decision:** Cache geometry keyed on `sequenceId + propType` hash. LRU cache with reasonable limit (e.g., 50 entries). Invalidate on prop type change.

---

## Non-Goals

- Mandala for non-LOOP sequences
- Replacing the existing Arrow Mandalas lab experiment
- Server-side pre-generation (future optimization, not in initial scope)
- Mathematical/idealized spirograph curves — we replicate the engine's actual interpolation
