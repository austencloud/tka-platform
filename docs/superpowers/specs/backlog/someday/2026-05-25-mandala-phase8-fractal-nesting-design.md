---
status: backlog
value: 3
effort: M
remaining: "Unstarted. All phases unimplemented."
depends_on: "2026-05-24-mandala-viewer-design.md"
plan_path: ""
tags: ["mandala", "zoom", "fractal", "animation", "canvas"]
last_triaged: 2026-05-25
---

## Prerequisites (must land before Phase 8 implementation begins)

**P1 — Canvas renderer `tipDx` fix (`renderMandalaToCanvas`).**
The Canvas renderer hardcodes `MANDALA_STANDARD_TIP_DX` (130) when computing viewport scale (`tipReach` at line 235 of `mandala-renderer.ts`). The SVG renderer correctly uses `options.tipDx` for the same calculation. Until this is patched, passing varying `tipDx` values for breathing produces paths that are misscaled relative to the Canvas viewport — they either clip at the edges or spill outside the expected bounding region. Fix: mirror the SVG renderer's `tipDx`-aware scale computation in `renderMandalaToCanvas`. One-line change, but it is load-bearing for the entire fractal breathing system. This fix is shared with Phase 5.

**P2 — Pre-allocated overlap mask canvases. HARD BLOCKER — Phase 8 development must not begin until this lands.**
`renderMandalaToCanvas` allocates two full-resolution `OffscreenCanvas` temporaries inside the overlap-rendering path on every call (lines 291–292 of `mandala-renderer.ts`). At 3 visible levels × 60 fps, this is 360 `OffscreenCanvas` allocations per second, each roughly 8 MB of GPU-backed texture on a 1080p canvas.

**Crash timeline on iOS Safari:** iOS Safari's total canvas memory budget is device-dependent — 224 MB on older devices, 384 MB on iPhone 13 class (A14) and newer. Safari does not promptly release canvas elements to GC after JS references are dropped (WebKit bug #195325, long-standing and unresolved). At 8 MB × 360 allocations/second, the app exhausts the 384 MB budget in under 2 seconds if GC does not keep pace — producing either a tab crash or a complete renderer freeze on iPhone 12-class hardware before the first user interaction. This is not a performance concern; it is a correctness failure.

Fix: allocate one pair of mask canvases at init time and pass them through to the render call (or have the fractal renderer manage them externally via a `FractalRenderContext` that owns the two reusable instances). This fix is shared with Phase 5.

**Acceptance criterion added by audit:** Total steady-state canvas memory across all `OffscreenCanvas` instances must not exceed 48 MB (1 main canvas at 1080p × DPR=3 ≈ 28 MB, plus 2 pre-allocated mask canvases ≈ 20 MB). This is well within Safari's limit and leaves headroom for other page canvases. Profile explicitly on iPhone 12 class (A14) hardware, not desktop.

Both prerequisites are bugs in the existing renderer, not features introduced by Phase 8. They should be tracked and merged independently.

---

# Mandala Phase 8: Fractal Nesting — Design Spec

## Overview

Zoom into the center of a breathing mandala and reveal a smaller mandala nested inside it. Zoom further and find another. The outermost and innermost levels are visually identical so the loop is seamless — infinite depth with finite geometry.

This is a premium visual feature. It works best as a standalone "Fractal" mode inside the Mandala Viewer pane, not as an always-on overlay on the default viewer. The user opts in via a mode toggle in `MandalaViewerControls`.

**Scope boundary:** This spec covers the fractal nesting system only. Color presets per level, breathing behavior per level, and sequence assignment per level are all addressed, but export (GIF/MP4) of the fractal mode is explicitly out of scope for this phase — the rendering architecture needs to stabilize first.

---

## Rendering Architecture

### Why Canvas, Not Nested SVG

The mandala renderer already ships two backends: `renderMandalaSVG` (string output) and `renderMandalaToCanvas` (Canvas 2D). SVG is the right choice for single-mandala display because it scales without rasterization and supports the glow filter. For fractal nesting, SVG is the wrong choice:

- SVG filters (`feGaussianBlur`, `feMerge`) on nested `<svg>` elements are applied in viewport space, not in the transformed coordinate space. At zoom level 4 (scale ~0.015 of the original), a `stdDeviation="3"` blur on the inner mandala renders as an enormous blur relative to its visual size.
- Unique `id` attributes (`glow`, `bom${uid}`, etc.) require the `maskIdCounter` to be incremented per level per frame, generating garbage on every tick.
- Browser SVG compositing for N nested viewports at different scales is slower than a single Canvas 2D context doing equivalent work.

**Decision: Canvas 2D only for fractal mode.** `renderMandalaToCanvas` accepts `offsetX`/`offsetY` and `size`, which already positions a mandala anywhere in a canvas. The fractal renderer uses this function directly with computed transforms for each visible level.

### Canvas Setup

A single `<canvas>` element fills the pane. The fractal renderer manages one `CanvasRenderingContext2D`.

**Device pixel ratio:** The canvas physical size must account for the display's pixel density. On initialisation and on resize:

```ts
const dpr = window.devicePixelRatio ?? 1;
canvas.width  = canvasSize * dpr;
canvas.height = canvasSize * dpr;
ctx.scale(dpr, dpr); // all subsequent draw calls use CSS-pixel coordinates
```

This matches the existing pattern in `MandalaOverlayCanvas.ts` (line 79). Without DPR scaling, inner levels rendered at small apparent sizes are doubly degraded — small AND low-resolution, producing visible blurriness on Retina displays.

**Per-frame render loop:**

1. Clear canvas.
2. For each visible level (outermost first), call `renderMandalaToCanvas` with the level's computed `offsetX`, `offsetY`, `size`, and `tipDx`.
3. Before each draw call, apply a circular clip via `ctx.save()` / `ctx.beginPath()` / `ctx.arc()` / `ctx.clip()` to contain the level's geometry within its bounding circle.

**Clip mask semantics:** The clip applied to each level is **inclusive** — it clips the level's own paths to its own bounding circle, preventing geometry from bleeding outside the circle's edge. This is a standard `ctx.arc()` + `ctx.clip()` call (no evenodd winding required). The inner mandala is simply drawn on top of the outer one, and because the outer level's paths are clipped to its circle, there is no bleed into the inner region. There is no "donut" clip (excluding the inner region from the outer level); the visual separation between levels comes entirely from the inner mandala painting over the outer mandala's centre. If a future requirement demands a true donut (rendering the outer mandala visible only in its ring), use evenodd winding with a counter-clockwise inner arc cut-out:

```ts
ctx.beginPath();
ctx.rect(0, 0, canvasSize, canvasSize);       // full canvas, clockwise
ctx.arc(cx, cy, innerRadius, 0, TWO_PI, true); // inner cut-out, counter-clockwise
ctx.clip('evenodd');
```

That technique is not needed for the default inclusive approach.

### Coordinate Model

The fractal is defined in normalized space. Level 0 (outermost) has `normalizedRadius = 1.0`. Each subsequent level has `normalizedRadius = 1.0 / SCALE_RATIO`. The canvas maps normalized radius 1.0 to `canvasSize / 2` pixels.

At any zoom position `z` (a real number where 0.0 = top of level 0 and 1.0 = top of level 1), the apparent radius of level `n` in canvas pixels is:

```
apparentRadius(n, z) = (canvasSize / 2) * SCALE_RATIO^(n - z)
```

A level is visible when `apparentRadius > MIN_RENDER_PX` (e.g. 4px — below this, paths are sub-pixel) and `apparentRadius < canvasSize * 2` (culled when way off screen). In practice this means 3–4 levels are active at any one time regardless of `MAX_DEPTH`.

---

## Zoom System

### Continuous Auto-Zoom

The default mode is auto-zoom: the camera drifts inward at a configurable speed. This is the low-friction "put it on screen and watch it" experience.

A `zoomPhase` value advances each frame:

```ts
zoomPhase += (deltaTime / cycleDuration);
// zoomPhase wraps: 0.0 → 1.0 is one full level traversal
```

`cycleDuration` is exposed as a control (default 8 seconds per level). Slow: 20s. Fast: 3s.

When `zoomPhase >= 1.0`, it wraps to 0.0 and the level index increments by 1 (modulo `MAX_DEPTH`). Because the loop point is exact, the visual is seamless.

### User-Controlled Zoom

An optional "manual" mode replaces auto-advance with scroll/pinch input. The `zoomPhase` is driven by accumulated wheel delta or pinch scale factor instead of time. A momentum easing function prevents jarring stops. When the user releases, auto-zoom resumes after a 2-second idle timeout.

Both modes share the same `zoomPhase` → render pipeline; the input source is the only difference.

### Speed Control

Exposed in `MandalaViewerControls` under a new "Fractal" section:

- **Speed** — slider, 3–20 seconds per level (default 8s). Labels: "Hypnotic" (20s) to "Vortex" (3s).
- **Direction** — toggle: Inward (default) / Outward. Outward reverses the sign of `zoomPhase` advance.
- **Manual / Auto** — toggle. When manual, speed control becomes a sensitivity slider.

---

## Level Management

### MAX_DEPTH

`MAX_DEPTH = 5` is the hard cap on simultaneous sequence slots. Conceptually the nesting is infinite, but only 5 distinct sequences cycle. When the active level index reaches `MAX_DEPTH`, it wraps to 0 and the camera is looking at a mandala geometrically identical to the one it started from.

The loop point requirement: at `zoomPhase = 0.0`, level 0 must look identical to what level `MAX_DEPTH` looked like when the user was at the same zoom position. This is guaranteed by:
1. Using the same `MandalaPaths` for level 0 and level `MAX_DEPTH mod MAX_DEPTH` (i.e. level 0).
2. Using the same `tipDx` animation phase for both (they share the same breathing clock).

This means the loop is mathematically exact, not visually approximated.

### Level Descriptor

```ts
interface FractalLevel {
  index: number;           // 0 = outermost, MAX_DEPTH-1 = innermost
  sequenceId: string;      // which sequence's MandalaPaths to render
  breathingOffset: number; // phase offset in [0, 1] relative to global breath clock
  colorPreset: FractalColorPreset;
  paths: MandalaPaths;     // pre-computed for this sequence
}
```

### LOD Culling

Each frame, compute `apparentRadius` for every level. Levels with `apparentRadius < MIN_RENDER_PX` are skipped. Levels with `apparentRadius > canvasSize * 1.5` are also skipped (they would be entirely off-canvas given the clip mask). Typically 3 levels render simultaneously: the one fading out (becoming too large to fit), the main visible level, and the next one materializing at the center.

Fade-in / fade-out is applied to the two boundary levels:

- Outermost visible level: `alpha = clamp((apparentRadius - canvasSize * 0.7) / (canvasSize * 0.3), 0, 1)` reversed — fades to 0 as it expands beyond the viewport.
- Innermost visible level: `alpha = clamp((apparentRadius - MIN_RENDER_PX) / (MIN_RENDER_PX * 4), 0, 1)` — fades in as it grows from invisible.

These alphas are applied via `ctx.globalAlpha` before each level's draw call.

---

## Sequence Assignment

### Assignment Modes

Three modes, selectable in the Fractal controls panel:

**Repeat** — All levels render the same sequence (the one currently loaded in the viewer). This is the default. It produces the classic "infinite mirror" effect where the nesting is purely geometric.

**Cycle** — The user assigns up to `MAX_DEPTH` sequences via a slot picker. Level `n` uses `sequences[n % sequences.length]`. When fewer sequences are assigned than `MAX_DEPTH`, the pattern repeats before the full depth is reached. This is where the feature becomes interesting as a teaching tool — seeing how different sequences relate visually at different scales.

**Random from Collection** — On each loop wrap, the innermost incoming level is assigned a randomly selected sequence from the user's mandala collection. Produces endless variety for ambient display.

### MandalaPaths Pre-computation

Breathing requires geometry recomputation per frame. `MandalaGeometryCalculator.calculate()` accepts `tipOverride: { dx, dy }` and produces entirely different path geometry for different `dx` values — the animated tip reach is baked into the path coordinates, not applied at render time. `MandalaRenderOptions.tipDx` only adjusts the SVG renderer's viewport scale; on the Canvas renderer it has no effect on path shape (see Prerequisite P1 for the Canvas scale bug). This means each breath frame at each visible level requires a fresh `calculate()` call with the current `tipOverride.dx`.

At 3 visible levels × 60 fps, this is 180 `calculate()` calls per second. `MandalaGeometryCalculator.calculate()` runs `generatePathPoints` across all steps and tips, then `pointsToSVGPath` — it is the dominant CPU cost in the fractal system, not `Path2D` construction. The quantized geometry cache (see Performance Strategy) is the primary mitigation. Without it, this load is prohibitive. With it, cache hits reduce the steady-state per-frame cost to near zero for most frames, with recomputation occurring only when the quantized `tipDx` bucket crosses a boundary.

The `paths` field on `FractalLevel` stores the base geometry (at the sequence's default `tipDx`) for reference and for non-animated rendering contexts only. It is not the paths used during live breathing animation.

When a sequence slot changes (user picks a new sequence for level N), the geometry cache for that level is cleared and rebuilt from the new sequence.

---

## Scale Ratio

### Default: Golden Ratio (φ ≈ 1.618)

Each inner level has its containing circle at `1 / φ` the radius of the level above it. This produces the most natural-looking nesting — the same ratio that governs nautilus shells, sunflowers, and galaxy arms. At `φ`, 3 levels span roughly the full visible range from "fills the screen" to "barely visible dot."

### Alternatives

- **Power of 2 (2.0)** — More geometric / mechanical feel. Fewer simultaneous visible levels (typically 2 at once). Faster apparent zoom for the same `cycleDuration`.
- **√2 (≈1.414)** — More levels visible simultaneously (4–5). Slower apparent zoom. Denser, more hypnotic.
- **Configurable** — The `scaleRatio` is a parameter on the fractal state (`1.2` to `3.0`). The UI exposes this as a labeled slider: "Dense" (1.2) → "Sparse" (3.0) with a φ default marker.

The scale ratio interacts with `MIN_RENDER_PX` and culling: a ratio of 1.2 means 6–7 levels are visible simultaneously, each one barely smaller than the last — beautiful but potentially slow if each level's `renderMandalaToCanvas` is expensive. The LOD system culls anything below 4px, which provides an automatic floor.

---

## Visual Transitions

### Boundary Between Levels

There is no hard boundary. Each level is clipped to its containing circle via the Canvas clip API. The clip is a perfect circle centered at canvas center with radius `apparentRadius(n)`. The next inner level renders on top, also clipped to its own smaller radius. The overlap creates a natural nested-circles appearance where each mandala is fully visible inside its ring and clipped at the outer edge.

The clip approach means the "walls" between levels are invisible — the only boundary is where one mandala's paths meet the circular clip edge. This looks intentional.

### Transition Zone

At the zoom threshold where a level is transitioning from "main level" to "outer fade", a blend zone exists where both levels are visible and the outer one fades. This is handled entirely by the alpha fade described in the LOD section — no special shader or blend mode required.

### Breathing Interaction

Each level breathes independently. Level `n` has a phase offset of `n * (1 / MAX_DEPTH)` relative to the global breath clock. This means the levels are evenly staggered: when the outermost mandala is at peak expansion, level 2 is at 2/5 of its cycle, level 3 at 3/5, and so on. The result is a rippling wave of expansion/contraction moving inward through the levels — visually distinct from Phase 6 (phase-chained breathing between formation mandalas), which is an outward relay chain.

The independent breathing option (all levels in phase) is also available as an alternative setting. This produces synchronized pulsing where every level expands and contracts at the same moment — more hypnotic, less organic.

### Color Per Level

Three color modes:

**Uniform** — All levels use the same `MandalaPalette` (whatever is set in the viewer). Clean and focused.

**Depth Shift** — Hue rotates with depth. Level 0 uses the base palette. Each subsequent level shifts hue by a configurable amount (default +30°). This is implemented by computing per-level `MandalaPalette` structs with HSL-shifted stroke/fill colors at the start of each render frame. At `MAX_DEPTH = 5` with a 30° shift, the innermost level is 120° away from the outermost — a harmonic relationship.

**Per-Level Preset** — Each level in the Cycle sequence assignment mode gets its own color preset from the existing `MandalaPalette` system. The slot picker that lets users assign sequences per level also lets them pick a palette per level.

---

## Performance Strategy

### What Is Expensive

There are two distinct cost centres:

**Geometry recomputation (`MandalaGeometryCalculator.calculate()`)** is the dominant cost. Breathing changes the actual path geometry — each new `tipDx` value produces different point coordinates in every path segment. With 3 visible levels per frame, the naive cost is 3 full `calculate()` calls per frame. This is the expensive operation, not rendering. The quantized geometry cache (below) makes this cost nearly zero at steady state; it is only incurred when the breath cycle crosses a quantization boundary.

**Canvas rendering (`renderMandalaToCanvas`)** iterates over `paths.blue` and `paths.red` (typically 16–32 paths per hand for a full-length sequence), constructs a `Path2D` per path, and calls `ctx.stroke()` or `ctx.fill()`. With 3 visible levels, this is 3× the single-mandala render cost. The `Path2D` cache (below) eliminates re-construction for paths whose `d` string hasn't changed.

### OffscreenCanvas Worker

For the fractal mode, rendering should move to an `OffscreenCanvas` transferred to a Web Worker. The main thread posts `FractalRenderRequest { levels: FractalLevelRenderState[], canvasSize: number }` each frame. The worker calls `renderMandalaToCanvas` for each visible level and posts back the rendered bitmap. The main thread draws the bitmap to the visible canvas via `ctx.drawImage(bitmap, 0, 0)`.

This decouples fractal rendering from Svelte's reactivity loop and the main thread layout/animation budget. The existing `renderMandalaToCanvas` is already stateless and takes no DOM references, so it is safe to call from a worker without modification.

The architecture has two hard constraints that are prerequisites for worker migration: no DOM references in the render path, and no reactive stores read inside the render loop (see Geometry Cache note below). Once these constraints hold in the synchronous path, the worker migration is a mechanical one-day change. Wire `transferControlToOffscreen` at init time with a feature-detect — do not defer it to "when profiling shows pressure," because deferred migrations never happen. The feature-detect pattern:

```ts
const supportsOffscreen = typeof OffscreenCanvas !== 'undefined' &&
  'transferControlToOffscreen' in HTMLCanvasElement.prototype;
if (supportsOffscreen) {
  const offscreen = canvas.transferControlToOffscreen();
  worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
} else {
  initSynchronousRenderer(canvas);
}
```

`transferControlToOffscreen` is supported in Safari 16.4+ (current iOS Safari in 2026 is 18.x — fully supported). This is not a bleeding-edge API.

### Geometry and Path2D Caching

For a given sequence and `tipDx`, `MandalaPaths` and the resulting path strings are deterministic. A two-level cache eliminates redundant work:

1. **Geometry cache:** `MandalaPaths` keyed by `(sequenceId, tipDx_quantized)`. `tipDx` is quantized to reduce cache size; the quantization step must be chosen empirically. A step of 0.5px produces up to ~500 entries per sequence per breath cycle, which is borderline. A step of 2px produces ~125 entries and is likely indistinguishable visually at inner levels where the mandala is small. Start at 2px and tighten only if breathing looks noticeably stepped. Cache size limit: `MAX_DEPTH * ANIMATION_STEPS` entries (e.g. 5 levels × 125 steps at 2px = 625 entries, each ~500 bytes ≈ 300 KB total — acceptable).

2. **Path2D cache:** `Map<string, Path2D>` keyed by the `d` string. Since `Path2D` objects are not transferable to workers, this cache lives on whichever thread calls `renderMandalaToCanvas`. Maximum 500 entries with LRU eviction.

**Do not extend `mandala-paths-cache.svelte.ts` for the fractal geometry cache.** That file is a Svelte `$state` reactive store (`const cache = $state<Record<string, MandalaPaths>>({})`). Svelte `$state` objects are proxied — every property access inside a reactive context registers a subscriber. Accessing `cache[shapeHash]` inside a `requestAnimationFrame` loop registers the fractal renderer as a Svelte reactive subscriber and triggers a re-render on every cache write. At 60 fps this becomes a Svelte reactivity feedback loop, generating layout recalculations on every frame and defeating the entire performance strategy.

Instead, create a separate `FractalGeometryCache` class backed by a plain `Map<string, MandalaPaths>` with no Svelte primitives anywhere in the implementation. The interface can mirror `mandala-paths-cache.svelte.ts` but the backing store must be a plain `Map`. The two caches can share the same `MandalaGeometryCalculator` instance — that class is not reactive and is safe to use from both contexts.

### Frame Budget

Target: 60 fps at `MAX_DEPTH = 5`, 3 visible levels, `scaleRatio = φ`. If profiling shows this is not achievable on mid-range mobile hardware, two fallbacks:

1. Reduce `MAX_DEPTH` to 3 on mobile (detect via `navigator.hardwareConcurrency < 4`).
2. Drop `samplesPerBeat` for inner levels. The innermost visible level is small — fewer path samples are perceptible at that size.

### CSS Containment and Off-Screen Pause

Add `contain: strict` to the fractal canvas element. This declares to the browser that the canvas's layout, paint, and size are fully self-contained, eliminating style recalculation cascades from outside the element:

```css
.fractal-canvas {
  contain: strict;
}
```

Wire an `IntersectionObserver` to pause the `requestAnimationFrame` loop when the canvas is not visible (scrolled off-screen, or the mandala viewer pane is not in view). Resume when it returns:

```ts
const observer = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    resumeRafLoop();
  } else {
    pauseRafLoop();
  }
}, { threshold: 0 });
observer.observe(canvas);
```

On mobile, fractal mode is the primary ambient-display use case — the user puts the screen face-up and walks away. Without this guard, the render loop burns CPU and GPU continuously even when the canvas is not on screen (e.g. user scrolled to controls, or a bottom sheet covered the canvas). This is a ~10-line addition with meaningful battery impact.

---

## State Shape

```ts
interface FractalNestingState {
  enabled: boolean;
  zoomPhase: number;               // [0, 1) position within current level
  activeBaseLevel: number;         // which level index is "outermost" right now
  cycleDuration: number;           // seconds per level (default 8)
  scaleRatio: number;              // default φ
  direction: "inward" | "outward";
  inputMode: "auto" | "manual";
  maxDepth: number;                // 3–5, default 5
  assignmentMode: "repeat" | "cycle" | "random";
  levelSequences: string[];        // sequenceIds, length = maxDepth
  levelPalettes: (MandalaPalette | null)[];
  breathingMode: "staggered" | "synchronized";
  colorMode: "uniform" | "depth-shift" | "per-level";
  hueShiftPerLevel: number;        // degrees, used when colorMode = "depth-shift"
}
```

This state lives alongside the existing `MandalaViewerControls` state. It is not persisted in Phase 8 (persistence deferred to Phase 3 shareable links, where the full viewer settings are serialized).

---

## UI Integration

The fractal mode is a toggle inside `MandalaViewerControls`. When off, the viewer behaves exactly as Phase 1. When on, the SVG output is replaced by the Canvas element and a "Fractal" section expands in the controls panel.

**Fractal controls section:**
- **Enable Fractal** — button toggle (existing button + indicator pattern). When enabled, canvas replaces SVG.
- **Speed** — labeled slider, 3–20s per level.
- **Scale** — labeled slider, 1.2–3.0, default φ with marker.
- **Depth** — button group: 3 / 4 / 5 levels.
- **Sequences** — slot list showing level 0..N-1. Each slot has a sequence picker. Only visible when `assignmentMode = "cycle"`.
- **Breathing** — button group: Staggered / Synchronized.
- **Colors** — button group: Uniform / Depth Shift / Per Level.
- **Direction** — button group: Inward / Outward.

The sequence picker for Phase 8 is self-contained: a dropdown or compact list drawn from the user's mandala collection, showing sequence title and a small mandala thumbnail. It does not depend on the collection browser component planned for Phase 5 (Formations), which is also unbuilt. If Phase 5 ships before Phase 8, evaluate reusing its collection browser at that time; for now Phase 8 implements its own minimal picker. The picker can be promoted to a shared primitive later without changing the Phase 8 API surface.

---

## What Is Not In Scope

- MP4 / GIF export of fractal animation (needs rendering pipeline stabilization first)
- Fractal mode for the Formations viewer (Phase 5 multi-mandala layout)
- Touch pinch-to-zoom on mobile (scroll/wheel only in this phase)
- Audio-reactive zoom speed (Phase 7 integration, deferred)
- Saving fractal configurations to user profiles (Phase 3 shareable links covers serialization)
- Zoom-triggered sequence transitions (user zooms to a level; that sequence plays in the main viewer) — interesting but out of scope
