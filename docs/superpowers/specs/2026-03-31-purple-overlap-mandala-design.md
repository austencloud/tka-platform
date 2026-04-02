# Purple Overlap Blending for Mandala Rendering

**Date:** 2026-03-31
**Status:** Design
**Scope:** `src/lib/shared/mandala/`

---

## Problem

Mandalas render blue hand paths first, then red hand paths on top. When both hands trace overlapping regions, red occludes blue entirely. The viewer loses information about where hands share space vs. diverge. For sequences with significant hand convergence (same-direction elements like Earth, Water, Sun), the mandala looks mostly red despite both hands contributing equally.

## Goal

Where blue and red paths overlap, render purple instead. The mandala becomes a three-color visualization: blue-only regions, red-only regions, and purple overlap regions. This makes hand convergence/divergence immediately readable at a glance.

---

## Current Architecture

### Files

| File | Role |
|------|------|
| `MandalaGeometryCalculator.ts` | Computes `MandalaPaths` (arrays of SVG path `d` strings per hand) from sequence steps. Samples tip positions at 64+ points per beat, converts to Catmull-Rom cubic bezier SVG paths. Caches results (LRU, 50 entries). |
| `MandalaRenderer.ts` | Stateless. Takes `MandalaPaths` + `MandalaRenderOptions`, produces SVG string or Canvas 2D draws. Renders blue paths, then red paths, in that order. |
| `SequenceMandala.svelte` | Frontend wrapper. Resolves DI services, derives paths and options, renders SVG via `{@html}`. |
| `mandala-types.ts` | `MandalaPaths`, `SVGPathData`, `MandalaRenderOptions`, `MandalaPoint`. |
| `mandala-constants.ts` | `BLUE_STROKE=#818cf8`, `RED_STROKE=#f87171`, fills, grid radius, etc. |
| `IMandalaRenderer.ts` | Interface: `renderSVG(paths, options)` and `renderToCanvas(ctx, paths, options)`. |

### Rendering Flow

1. `MandalaGeometryCalculator.calculate(steps)` produces `MandalaPaths { blue: SVGPathData[], red: SVGPathData[] }`. Each hand has 2 paths (left tip, right tip). Total: 4 SVG path strings.
2. `MandalaRenderer.renderSVG()` builds an SVG string: background rect, glow filter, grid dots, then 4 `<path>` elements (2 blue, 2 red). Blue first, red second.
3. `SequenceMandala.svelte` injects the SVG string via `{@html}`.

### Why SVG Blend Modes Won't Work

SVG `mix-blend-mode` operations (screen, multiply, etc.) blend against the background, not against each other in isolation. The specific blue (#818cf8) and red (#f87171) don't produce a clean purple through any standard blend mode. The result is muddy or washed out. Pixel-level detection is required for precise color control.

---

## Approach: Geometry-Level Overlap Detection

Rather than pixel-level canvas compositing, detect overlaps at the geometry level using the point data that `MandalaGeometryCalculator` already computes. This avoids offscreen canvases entirely and keeps rendering in pure SVG.

### Core Idea

The geometry calculator already samples 64+ points per beat per tip. These points define the path curves. Two paths overlap when their sampled points are within a proximity threshold of each other. By comparing blue and red point arrays, we can identify overlap segments and emit them as a third set of purple paths.

### Why Geometry Over Pixels

1. **No canvas dependency.** The SVG rendering path (used for card backs) stays pure SVG. No offscreen canvas, no `getImageData`, no browser API differences.
2. **Resolution-independent.** Overlap detection works in mandala coordinate space, not pixel space. Results are correct at any render size.
3. **Cacheable.** Overlap paths cache alongside the existing `MandalaPaths` in the LRU cache. No per-render recomputation.
4. **Simpler integration.** The renderer just draws a third color. No compositing pipeline.

---

## Algorithm

### Step 1: Point-Level Proximity Detection

In `MandalaGeometryCalculator`, after computing the 4 point arrays (blue left, blue right, red left, red right), compare each blue tip against each red tip for proximity:

```
For each blue tip array B (2 arrays):
  For each red tip array R (2 arrays):
    Walk both arrays simultaneously
    For each blue point b[i]:
      Find nearest red point r[j] (within a sliding window, not full O(n*m))
      If distance(b[i], r[j]) < OVERLAP_THRESHOLD:
        Mark both points as "overlapping"
```

**Sliding window optimization:** Points are ordered along the path. For each blue point, only check red points within a window of +/- `WINDOW_SIZE` indices from the last matched red index. This keeps the comparison O(n) per tip pair instead of O(n*m).

### Step 2: Extract Overlap Segments

From the marked overlap points, extract contiguous segments:

```
Walk the overlap-marked points for a blue tip
Collect runs of consecutive overlapping points
Each run becomes a purple path segment (using the blue points, since they're within threshold of red)
```

### Step 3: Emit Purple Paths

Add a `purple` field to `MandalaPaths`:

```typescript
interface MandalaPaths {
  blue: SVGPathData[];
  red: SVGPathData[];
  purple: SVGPathData[];  // NEW
}
```

The purple paths use the same Catmull-Rom to cubic bezier conversion as blue/red paths.

### Step 4: Render Purple Layer

In `MandalaRenderer`, after rendering blue and red, render purple paths on top. Purple is drawn last so it visually replaces both blue and red in overlap regions.

### Threshold Tuning

`OVERLAP_THRESHOLD` in mandala coordinate space. The grid radius is 80 units. Staff tip reach is ~87 units. A reasonable starting threshold is **3-5 units** (roughly 2-3% of the mandala radius). This catches paths that are visually overlapping at typical render sizes without false positives from nearby-but-distinct paths.

This value should be a constant in `mandala-constants.ts` and may need empirical tuning with real sequences.

---

## File Changes

### `mandala-types.ts`

Add `purple` to `MandalaPaths`:

```typescript
export interface MandalaPaths {
  blue: SVGPathData[];
  red: SVGPathData[];
  purple: SVGPathData[];
}
```

Add `overlapBlending` to `MandalaRenderOptions`:

```typescript
export interface MandalaRenderOptions {
  // ... existing fields
  overlapBlending?: boolean;
}
```

### `mandala-constants.ts`

Add purple color constants and overlap threshold:

```typescript
export const PURPLE_STROKE = "#a78bfa";  // Tailwind violet-400, midpoint between blue and red
export const PURPLE_FILL = "rgba(167, 139, 250, 0.2)";
export const OVERLAP_THRESHOLD = 4;  // mandala coordinate units
export const OVERLAP_WINDOW_SIZE = 20;  // sliding window for proximity search
```

The purple color (#a78bfa) is chosen to be perceptually between the blue (#818cf8) and red (#f87171) while remaining readable on the dark mandala background.

### `MandalaGeometryCalculator.ts`

New private methods:

- `detectOverlaps(bluePoints, redPoints, threshold, windowSize)` — returns array of `MandalaPoint[]` segments where paths overlap.
- `extractOverlapSegments(points, overlapMask)` — extracts contiguous runs of overlapping points into separate point arrays.

Modify `calculate()`:
- After computing blue and red point arrays, run overlap detection across all 4 tip-pair combinations (blue-left vs red-left, blue-left vs red-right, blue-right vs red-left, blue-right vs red-right).
- Convert overlap segments to SVG path data.
- Return `{ blue, red, purple }`.

The cache key does not change because overlap is deterministic from the same inputs. The cached `MandalaPaths` object now includes purple paths.

### `MandalaRenderer.ts`

Import `PURPLE_STROKE` and `PURPLE_FILL`.

In `renderSVG()`, after the red path block, add:

```typescript
if (options.overlapBlending !== false) {
  for (const pathData of paths.purple) {
    const attrs = style === "filled"
      ? filledAttributes(PURPLE_STROKE, PURPLE_FILL, strokeWidth)
      : strokeAttributes(PURPLE_STROKE, strokeWidth);
    parts.push(`    <path d="${pathData.d}" ${attrs}/>`);
  }
}
```

Same pattern for `renderToCanvas()` and `_drawPath()`.

### `SequenceMandala.svelte`

Pass `overlapBlending: true` in `renderOptions` (or omit it, since the default behavior is to render purple when present). No prop needed unless we want user-facing control.

### `IMandalaRenderer.ts`

No changes needed. The interface already accepts `MandalaPaths` — the new `purple` field is additive and backward-compatible.

### `IMandalaGeometryCalculator.ts`

No changes needed. The return type `MandalaPaths` gains the `purple` field, which is a type-level change in `mandala-types.ts`.

---

## Performance

### Cost Analysis

Current: 4 tip paths x 64 samples/beat x N beats = ~256N points total.

Overlap detection adds: 4 tip-pair comparisons x O(n) each with sliding window = O(4n) = O(n). For a typical 8-beat sequence: 4 x 512 = 2048 comparisons. Negligible.

Purple path SVG generation: same Catmull-Rom conversion as existing paths. Only for overlap segments, which are typically shorter than full paths.

### Memory

One additional array of `SVGPathData[]` per cached entry. Purple segments are subsets of existing paths, so the SVG strings are shorter. Minimal memory impact.

### Rendering

One additional SVG `<path>` element per overlap segment. Typical mandalas would have 0-4 purple segments. The SVG renderer already handles 4 paths; adding a few more is trivial.

### Cache Impact

The LRU cache key is unchanged. Cache entries are slightly larger due to the purple field. No invalidation needed.

---

## Integration

### Feature Flag

`overlapBlending` on `MandalaRenderOptions` (defaults to rendering purple when paths exist). To disable, pass `overlapBlending: false`.

No user-facing settings toggle in v1. The feature is always on. If users want to toggle it later, add a boolean to mandala render options plumbed through `SequenceMandala.svelte` props.

### Card Back (CardBackV5)

Purple overlap renders automatically. `CardBackV5.svelte` uses `SequenceMandala` with `mode="card-back"`. No changes needed in the card component.

### Gallery Mode

Same automatic rendering. The `mode="gallery"` path includes grid dots and background, but purple paths render identically.

### Print

SVG output includes purple paths. Print renders at whatever resolution the SVG is rasterized at. No special handling needed.

---

## Edge Cases

1. **No overlap.** `purple` array is empty. Renderer skips the purple block. Visual output identical to current behavior.
2. **Complete overlap.** (e.g., both hands doing identical motions.) Purple covers most of both paths. Blue and red still visible at path edges where stroke width causes slight divergence.
3. **Near-miss paths.** Threshold tuning is critical. Too high = false positives (parallel paths wrongly marked as overlapping). Too low = visually overlapping paths not detected. The 3-5 unit range should be validated against a set of test sequences spanning all 6 element types.
4. **Single-hand display.** When `show="blue"` or `show="red"`, purple paths should not render (no overlap possible with one hand hidden).
5. **Filled style.** Purple fill replaces blue and red fills in overlap regions. The fill opacity (0.2) means underlying blue/red fills may show through slightly. This is acceptable and creates a subtle layered effect.

---

## Testing

Unit tests for the overlap detection algorithm:

- Two identical point arrays produce a single overlap segment spanning the full length.
- Two completely separate point arrays produce zero overlap segments.
- Partially overlapping arrays produce segments matching only the overlap region.
- Sliding window correctly handles paths that converge, diverge, and reconverge.
- Threshold boundary: points at exactly the threshold distance are included; points at threshold + epsilon are excluded.

These are pure algorithm tests on `MandalaPoint[]` arrays. They meet the "silent bug" test criteria since wrong overlap detection produces plausible but incorrect visual output.

---

## Rollout

1. Implement overlap detection in `MandalaGeometryCalculator`.
2. Add purple rendering to `MandalaRenderer`.
3. Validate visually with sequences from each of the 6 elements (Earth/Water/Sun should show significant purple; Air/Fire/Moon should show less).
4. Tune `OVERLAP_THRESHOLD` based on visual results.
5. Ship with overlap always on. No feature flag UI needed unless user feedback suggests some people prefer the old look.
