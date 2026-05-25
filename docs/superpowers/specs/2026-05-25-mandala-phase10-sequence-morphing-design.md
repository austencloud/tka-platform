# Mandala Phase 10 — Sequence Morphing Design Spec

**Date:** 2026-05-25
**Status:** Design complete, awaiting implementation plan

---

## Overview

Sequence Morphing smoothly interpolates between two sequences' mandala geometries frame-by-frame, dissolving one movement pattern into another. The effect is visual proof of how sequences relate — a short morph between two similar LOOP sequences looks like subtle shape-shifting; a morph between radically different sequences looks like metamorphosis.

The key insight that makes this tractable: `MandalaGeometryCalculator` *always* produces exactly 2 blue paths and 2 red paths — one per tip offset (`{dx: -dx, dy: 0}` and `{dx: dx, dy: 0}`), indexed 0 and 1. Path counts are invariant across sequences. The underlying point arrays have a predictable structure that enables direct per-point interpolation without any path-correspondence algorithm.

---

## Path Correspondence

**The problem is already solved by the architecture.**

Every call to `MandalaGeometryCalculator.calculate()` returns `MandalaPaths` with exactly:
- `blue[0]` — tip index 0 (left tip, `dx = -MANDALA_STANDARD_TIP_DX`)
- `blue[1]` — tip index 1 (right tip, `dx = +MANDALA_STANDARD_TIP_DX`)
- `red[0]` — tip index 0
- `red[1]` — tip index 1

Correspondence is `tipIndex` to `tipIndex`. `blue[0]` morphs into `blue[0]`, etc. No path-matching algorithm needed.

**Point count mismatch:** Two sequences with different beat counts will produce point arrays of different lengths. For a sequence with N steps (non-static), each tip path has approximately `N × BASE_SAMPLES_PER_BEAT` points (64 per beat, more for high-turn motions). Sequences of different lengths produce paths with different point counts.

Resolution: **resample both paths to a common point count** before interpolation. The canonical count is `max(countA, countB)`, redistributed uniformly along arc length. This preserves geometric density at high-curvature sections.

---

## Interpolation Strategy

### Point-array interpolation (chosen approach)

The `MandalaGeometryCalculator` already exposes the point generation logic internally via `generatePathPoints()`. The morph system needs this function exposed at a lower level to get `MandalaPoint[]` arrays directly — before they are converted to SVG `d` strings.

**New export from `MandalaGeometryCalculator`:**
```ts
calculatePoints(
  steps: readonly StepLike[],
  options?: MandalaPathOptions,
  tipOverride?: { dx: number; dy: number }
): { blue: MandalaPoint[][]; red: MandalaPoint[][] }
```

Returns the raw point arrays (indexed by tip, same correspondence as `MandalaPaths`).

**Resampling to common count:**

```ts
function resamplePoints(points: MandalaPoint[], targetCount: number): MandalaPoint[]
```

Walks the polyline, accumulates arc-length, and samples at uniform arc-length intervals. This guarantees `targetCount` points regardless of source count, with spatial fidelity preserved by sampling densely where curves are tight.

**Per-point linear interpolation:**

```ts
function interpolatePoints(
  a: MandalaPoint[],
  b: MandalaPoint[],
  t: number          // 0 = source, 1 = target
): MandalaPoint[]
```

Simple component-wise lerp: `{x: a[i].x + (b[i].x - a[i].x) * t, y: a[i].y + (b[i].y - a[i].y) * t}`.

**Reconstruction back to SVG:**

The interpolated point array is fed into the existing `pointsToSVGPath()` function (currently private, needs to be exported or the logic duplicated in the morpher). This produces a `d` string that `renderMandalaSVG` can render without modification.

**Why not `flubber` or a shape-morphing library:**

`flubber` treats paths as arbitrary polygons and matches them by perimeter distance — it has no knowledge of the semantic structure of mandala paths. The point-array approach respects the structural correspondence (tip 0 ↔ tip 0) and produces geometrically coherent interpolation. It also avoids a dependency, keeps the bundle small, and works in a rAF loop without GC pressure (no string parsing per frame).

**Why not interpolating `d` strings directly:**

The `d` strings are Catmull-Rom Bezier cubic sequences. Two sequences can have different numbers of `C` segments (different beats → different control point counts). You cannot meaningfully lerp between two `d` strings with different segment counts.

---

## Transition System

### MorphController class

Lives in `src/lib/shared/mandala/services/implementations/MorphController.ts`.

```ts
interface MorphState {
  sourcePoints: { blue: MandalaPoint[][]; red: MandalaPoint[][] };
  targetPoints: { blue: MandalaPoint[][]; red: MandalaPoint[][] };
  resampledSource: { blue: MandalaPoint[][]; red: MandalaPoint[][] };
  resampledTarget: { blue: MandalaPoint[][]; red: MandalaPoint[][] };
  progress: number;        // 0–1
  isActive: boolean;
}
```

**`prepare(sourceSteps, targetSteps, options)`** — computes point arrays for both sequences, resamples to common count, caches for the transition duration. Called once before the morph begins, not per-frame.

**`tick(t: number)`** — returns `MandalaPaths` with interpolated `d` strings at progress `t`. Called from the rAF loop. Pure — no state mutation.

**`dispose()`** — releases cached point arrays.

### Timing

| Parameter | Default | Range |
|-----------|---------|-------|
| Duration  | 2.5s    | 0.5s–8s |
| Easing    | `cubicInOut` | Same 8 easing curves as breathing |

Transition progress `t` is driven by the same rAF tick as breathing. The morph easing and the breathing easing are independent — breathing continues during a morph (see Breathing Interaction below).

### Scrub mode

`MorphController.tick()` accepts a `t` parameter directly, enabling user-controlled scrubbing via a range input. When scrub mode is active, the rAF timer is paused and the slider drives `t`.

---

## Breathing Interaction

Breathing (tip dx oscillation) and morphing (geometry interpolation) are orthogonal transformations. They compose cleanly because:

1. Breathing is applied *after* geometry computation — it varies `tipDx` which varies the point coordinates at render time.
2. Morphing interpolates between the point arrays computed at the *standard* `MANDALA_STANDARD_TIP_DX` (130).
3. The morph frame is then passed the current animated `tipDx` for breathing.

**Interaction during morph:** Breathing continues uninterrupted during a morph transition. The effect is: the geometry morphs while also breathing — both animations run simultaneously. This is the intended behavior and requires no special handling.

**Option to suppress breathing during morph:** An optional `pauseBreathingDuringMorph` prop on `MandalaPane`. When true, `tipDx` holds at the current value when the morph begins and resumes after morph completion. Default: false (breathing continues).

---

## Color Interaction

Each `CollectedMandala` (and the mandala viewer) stores a `MandalaPalette` — the current color preset. When morphing from Sequence A to Sequence B, colors can either:

1. **Hold source colors** throughout the transition (simplest, no color math)
2. **Crossfade colors** — lerp each RGBA component from source palette to target palette over the transition duration

Default: crossfade. The lerp is done in the `renderMandalaSVG` call: the caller computes an interpolated `MandalaPalette` from source and target palettes at progress `t` and passes it as the `palette` prop. No changes required to the renderer.

Color lerp operates in sRGB (not linear light) — for short transitions at moderate opacity, the perceptual error is not visible.

---

## Playlist Mode

A playlist is an ordered array of `CollectedMandala` references with morph transitions between consecutive entries.

### Data model

```ts
interface MandalaPlaylist {
  id: string;
  name: string;
  entries: MandalaPlaylistEntry[];
  transitionDuration: number;   // seconds, applies to all transitions
  transitionEasing: UndulationEasing;
  loop: boolean;
}

interface MandalaPlaylistEntry {
  mandalaId: string;            // references CollectedMandala.id
  dwellDuration: number;        // seconds to hold before next morph begins; default 5.0
}
```

### Playlist state machine

```
DWELLING → MORPHING → DWELLING → MORPHING → ...
```

- **DWELLING:** Displaying the current mandala fully (t = 1). Breathing active. Timer counts down `dwellDuration`.
- **MORPHING:** `MorphController` running from current mandala to next. Duration = `transitionDuration`. After morph completes (t = 1), the current mandala advances to the next entry, state transitions to DWELLING.

**Lookahead:** When transitioning from entry N to N+1, pre-compute entry N+2's point arrays in a background microtask so the next morph starts instantly.

**Loop:** When `loop: true` and the playlist reaches the last entry, the next target is the first entry. The morph wraps around.

### PlaylistController class

Lives in `src/lib/shared/mandala/services/implementations/PlaylistController.ts`.

Wraps `MorphController`. Exposes:
- `start(playlist, startIndex?)` — load playlist, begin from entry `startIndex` (default 0)
- `pause()` / `resume()`
- `jumpTo(index)` — skip to entry, cancel current morph
- `tick(timestamp)` — advances state machine, returns `{ paths: MandalaPaths; palette: MandalaPalette; progress: number; phase: 'dwelling' | 'morphing' }`
- `dispose()`

---

## UI Design

### MandalaPane additions

`MandalaPane.svelte` gains a "Morph" section in `MandalaViewerControls`:

**Morph section (always visible when collection has ≥ 2 mandalas):**
- **Source** — current sequence (read-only label showing sequence name)
- **Target** — dropdown or mini-carousel of saved mandalas from the collection
- **Morph** button — triggers a single one-shot morph from source to target
- **Duration** — slider 0.5s–8s (default 2.5s)
- **Easing** — button group (same as breathing easing: Sine, Ease, Breathe, etc.)

**Scrub mode:**
- While morph is in progress, a scrub bar replaces the progress indicator. Dragging the scrub bar pauses the auto-advance and lets the user manually hold a frame.

### Playlist editor

Accessed via a separate "Playlist" sub-tab in `MandalaViewerControls` (alongside the existing settings).

**Layout:**
- Ordered list of mandala collection entries (drag to reorder)
- Per-entry: mandala thumbnail (48×48 mini-render), sequence name, dwell duration input
- Global: transition duration, easing, loop toggle
- Play / Pause button at the bottom

The playlist editor is local UI state — playlists are not persisted in Phase 10. Persistence is a follow-on enhancement.

### Mandala collection requirement

Morphing requires ≥ 2 mandalas in the user's collection. If the collection has only 1 mandala, the Morph section shows a nudge: "Add a second sequence to your collection to enable morphing."

---

## Technical Architecture

### New files

```
src/lib/shared/mandala/services/implementations/
  MorphController.ts          — per-pair morph logic
  PlaylistController.ts       — playlist state machine
  MandalaPointResampler.ts    — arc-length resampling utility

src/lib/shared/mandala/domain/
  morph-types.ts              — MandalaPlaylist, MandalaPlaylistEntry, MorphState
```

### Modified files

**`MandalaGeometryCalculator.ts`** — expose `calculatePoints()` returning raw `MandalaPoint[][]` per hand per tip. The existing `calculate()` method calls this internally and converts to SVG strings. No breaking change.

**`mandala-types.ts`** — add `MorphState`, `MandalaPlaylist`, `MandalaPlaylistEntry` (or move to `morph-types.ts` and re-export).

**`SequenceMandala.svelte`** — add `morphTarget?: StepLike[]`, `morphProgress?: number` props. When both are set, the component renders interpolated paths instead of computing from `sequence` alone.

**`MandalaPane.svelte`** — add morph controls section and playlist sub-tab to `MandalaViewerControls`.

### Data flow (single morph)

```
User selects target sequence
  → MorphController.prepare(sourceSteps, targetSteps)
      → calculatePoints() for source + target
      → resamplePoints() to common count
      → cache both resampled arrays
  → rAF loop calls MorphController.tick(t)
      → interpolatePoints() at current t
      → pointsToSVGPath() for each interpolated array
      → returns MandalaPaths
  → MandalaPaths + interpolated MandalaPalette → renderMandalaSVG()
  → SVG string → DOM
```

### Data flow (playlist)

```
PlaylistController.start(playlist)
  → DWELLING state, load entry[0]
  → precompute entry[1] point arrays in background

rAF tick(timestamp)
  → PlaylistController.tick(timestamp)
      → if DWELLING: decrement dwell timer
          → when dwell expires: begin morph, state → MORPHING
      → if MORPHING: advance progress via easing
          → MorphController.tick(progress)
          → when t = 1: advance current index, state → DWELLING, precompute next
      → returns { paths, palette, progress, phase }
  → SequenceMandala receives paths + palette
```

### Performance

**Resample cost:** `O(N)` per path, called once during `prepare()`. For a 16-beat sequence at 64 samples/beat = 1024 points. Resampling 8 paths (2 hands × 2 tips × blue + red) takes well under 1ms on a mid-range device.

**Per-frame morph cost:** `O(N)` component-wise lerp over ~1024 points × 4 paths = ~4096 multiply-adds per frame. At 60fps this is ~245,000 operations/second — trivial on any modern JS engine.

**SVG string construction:** `pointsToSVGPath()` builds a string of ~1024 `C` commands. At ~50 chars per command, that's ~50KB of SVG string reconstructed each frame during the morph transition. This is the real cost. Mitigation: use `Canvas2D` rendering instead of SVG string construction during active morph transitions. When morph is not active, revert to SVG (cheaper for static renders, better for export). The canvas path is constructed via `Path2D` which is held in memory and not re-parsed.

**Canvas morph render path:** `MorphController.tick()` returns `Path2D` objects directly (skipping SVG string construction) when a canvas context is available. `renderMandalaToCanvas()` already exists and accepts `MandalaPaths` — extend it to accept pre-built `Path2D` objects as an optional fast path.

### Resampler algorithm

```ts
function resamplePoints(points: MandalaPoint[], targetCount: number): MandalaPoint[] {
  // 1. Compute cumulative arc lengths
  // 2. Total arc length L
  // 3. For i in [0, targetCount): sample at arc length i * L / (targetCount - 1)
  // 4. Binary search for the segment containing that arc length
  // 5. Lerp within segment
}
```

Linear (polyline) arc length is computed from the raw sample points — not from the cubic Bezier control points in the `d` string. This is exact for the purposes of resampling since the source is a sampled polyline.

---

## What Is Not in Scope for Phase 10

- Persistence of playlists to Firebase
- Morph between different path shapes (arc → concave morphing) — that is the "path shape morphing" noted in the Phase 1 viewer spec
- Morph between different `show` settings (blue-only → red-only)
- Export of morph transitions as MP4 or GIF (extend the existing export pipeline in a follow-on)
- Crossfade of `strokeWidth` or `style` (stroke ↔ filled) between sequences
