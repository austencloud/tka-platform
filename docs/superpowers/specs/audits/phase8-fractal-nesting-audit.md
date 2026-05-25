# Audit: Mandala Phase 8 — Fractal Nesting Design Spec

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase8-fractal-nesting-design.md`
**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25

---

## VERDICT: CONDITIONAL PASS

The spec is well-structured, architecturally sound in its broad strokes, and demonstrates real understanding of the rendering pipeline. The Canvas 2D choice over nested SVG is correct and well-justified. However, there are two critical issues (one factual error about the current API, one fundamental rendering flaw) and several important gaps that would cause implementation delays or visual defects if not addressed before work begins.

---

## STRENGTHS

1. **SVG rejection is well-reasoned.** The three arguments (filter coordinate space, `id` proliferation, compositing cost) are all accurate. The `stdDeviation` problem at nested scale is real and non-obvious — good catch.

2. **Coordinate model is mathematically clean.** `apparentRadius(n, z) = (canvasSize / 2) * SCALE_RATIO^(n - z)` is the right formula. The seamless loop condition (level 0 = level MAX_DEPTH mod MAX_DEPTH) is correct when geometry and breathing phase are shared.

3. **LOD culling design is practical.** The MIN_RENDER_PX floor at 4px and the 1.5x canvas upper bound are reasonable thresholds. The alpha fade formulas for boundary levels will produce smooth visual transitions without discrete pop-in.

4. **Separation of zoom input from render pipeline.** Both auto and manual modes driving the same `zoomPhase` variable is the right abstraction. The 2-second idle resume is a standard UX pattern for this type of control.

5. **Correct identification of `Path2D` as the bottleneck.** The spec correctly identifies that `new Path2D(d)` construction is the expensive per-frame operation, not the geometry computation (which is cached).

6. **OffscreenCanvas worker migration path.** Deferring worker rendering to a profiling-triggered optimization while keeping the architecture compatible is pragmatic.

7. **Golden ratio default is a strong choice.** At phi, 3 levels span roughly 1.0 / 0.618 / 0.382 of the viewport radius, which gives good visual separation. The configurable slider (1.2-3.0) covers the interesting design space.

---

## ISSUES

### CRITICAL

**C1: `renderMandalaToCanvas` does NOT use `options.tipDx` for scale computation.**

The spec states (line 143): "Only the `tipDx` parameter changes per frame (driven by the breathing clock), and `renderMandalaToCanvas` accepts `tipDx` at render time via `MandalaRenderOptions.tipDx`, so no recomputation is needed per frame."

This is factually wrong. Reading `mandala-renderer.ts` line 235:

```ts
const tipReach = MANDALA_STANDARD_TIP_DX * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
```

The Canvas renderer hardcodes `MANDALA_STANDARD_TIP_DX` (130) for its viewport scale calculation. Compare with the SVG renderer (line 100):

```ts
const effectiveTipDx = Math.max(options.tipDx ?? MANDALA_STANDARD_TIP_DX, MANDALA_STANDARD_TIP_DX);
```

The SVG path uses `options.tipDx` to compute `tipReach` and scale, but the Canvas path does not. This means:

- The Canvas renderer renders pre-computed paths at a fixed scale regardless of `tipDx`.
- If the fractal renderer passes paths computed at varying `tipDx` values (for breathing), the paths will extend outside the expected bounding region because the Canvas viewport doesn't adjust to accommodate them.
- The breathing animation in fractal mode will either clip at the edges or produce incorrect scaling.

**Fix required before implementation:** Patch `renderMandalaToCanvas` to mirror the SVG renderer's `tipDx`-aware scale computation. This is a one-line change but it's load-bearing for the entire fractal breathing system.

**C2: Canvas overlap rendering uses `new OffscreenCanvas()` internally — blocks worker portability.**

The spec claims (line 207): "The existing `renderMandalaToCanvas` is already stateless and takes no DOM references, so it is safe to call from a worker without modification."

This is partially wrong. At line 291-292 of `mandala-renderer.ts`:

```ts
const maskB = new OffscreenCanvas(w, h);
const maskR = new OffscreenCanvas(w, h);
```

While `OffscreenCanvas` IS available in workers, the function also accesses `ctx.canvas.width` and `ctx.canvas.height` (line 289). In a worker context with a transferred `OffscreenCanvas`, `ctx.canvas` returns the `OffscreenCanvas` itself — `.width` and `.height` are available. So this is technically correct for the worker case.

However, the overlap rendering creates two full-resolution `OffscreenCanvas` temporaries PER `renderMandalaToCanvas` call. With 3 visible levels per frame at 60fps, that is 6 `OffscreenCanvas` allocations per frame (360/sec). Each is `canvasWidth x canvasHeight` pixels. On a 1080p canvas, each allocation is ~8MB (RGBA). This is 48MB of GPU-backed texture allocation per frame that the GC must reclaim. This will cause frame drops and GC pauses.

**Fix required:** The overlap mask canvases must be allocated once and reused across frames, not created inside each `renderMandalaToCanvas` call. For the fractal renderer, pre-allocate one pair of mask canvases at init time and pass them through (or have the fractal renderer manage them externally).

### IMPORTANT

**I1: Path recomputation claim is wrong — breathing changes path geometry, not just rendering.**

The spec says paths are pre-computed once and only `tipDx` changes per frame. But examining `SequenceMandala.svelte` lines 228-236:

```ts
const paths = $derived.by((): MandalaPaths | null => {
    return calculator.calculate(
        sequence.steps, bluePropType, redPropType, pathOptions,
        { dx: effectiveDx, dy: 0 }
    );
});
```

`MandalaGeometryCalculator.calculate()` accepts `tipOverride: { dx, dy }` and computes entirely different paths for different `dx` values. The `tipDx` on `MandalaRenderOptions` only affects the SVG renderer's viewport scaling — it does NOT make the Canvas renderer adjust path shapes.

This means the spec's caching strategy (cache MandalaPaths once per sequence, vary only `tipDx` at render time) won't produce breathing animation. Each breath frame needs a fresh `calculate()` call with a different `tipOverride.dx`. The geometry cache described in the Performance Strategy section (keyed by `tipDx_quantized`) acknowledges this implicitly but contradicts the "no recomputation needed per frame" claim in the Sequence Assignment section.

**Impact:** The performance profile changes significantly. `MandalaGeometryCalculator.calculate()` is the expensive operation — it runs `generatePathPoints` across all steps and tips, then `pointsToSVGPath`. Calling this 3 times per frame (once per visible level) with different `tipDx` values is 3x the cost the spec budgets for.

**Fix:** Acknowledge the per-frame geometry cost honestly. The `tipDx_quantized` cache is the right mitigation, but the spec should state clearly that breathing requires geometry recomputation, not just render-time parameter changes. Quantization step should be tested empirically — 0.5px may be too fine (producing 500+ cache entries per level per cycle); 2px may be visually acceptable and produce ~125 entries.

**I2: Clip mask ordering is inverted for the described rendering approach.**

The spec says (line 41): "The circular clip mask for each level (to hide the region that will be covered by the next inner level) is applied via `ctx.save()` / `ctx.clip()` before the draw call."

But the render order is "outermost first" (line 40). If you clip the outer level to exclude the inner circle, then draw the inner level inside that hole, you get the right result. However, the clip described is a standard inclusive clip (`ctx.arc()` + `ctx.clip()` clips TO the arc, not AWAY from it). To exclude the inner region, you need an inverted clip:

```ts
ctx.beginPath();
ctx.rect(0, 0, canvasSize, canvasSize); // full canvas
ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true); // counter-clockwise = hole
ctx.clip('evenodd');
```

The spec doesn't mention `evenodd` or the inverted clip technique. A naive `ctx.arc() + ctx.clip()` would clip the outer mandala TO its inner circle, not AWAY from it, showing only the center portion where the inner mandala will go — the opposite of the intended effect.

Actually, on re-reading: the spec may intend for each level to simply draw on top of the previous one without exclusion clipping, relying on the inner mandala's opaque paths to visually cover the outer mandala's center. If so, the clip mask language is misleading and should be clarified. The "clip to containing circle" would mean clipping each level to its OWN circle (preventing it from drawing outside its region), not clipping it away from the next inner level's region. This interpretation works but should be stated explicitly.

**I3: No `devicePixelRatio` handling.**

The Canvas setup section describes a single `<canvas>` element but never mentions `devicePixelRatio` (DPR) scaling. On 2x/3x displays, a canvas without DPR scaling renders at half/third resolution, producing visible blurriness — exactly the kind of aliasing the audit criteria asks about. The existing `MandalaOverlayCanvas.ts` already handles DPR correctly (line 79: `new OffscreenCanvas(width * dpr, height * dpr)`).

The fractal renderer MUST set `canvas.width = canvasSize * dpr`, `canvas.height = canvasSize * dpr`, and apply `ctx.scale(dpr, dpr)`. Without this, inner mandala levels at small apparent sizes will be doubly degraded: small AND low-resolution.

**I4: The "collection browser" component reuse is unverified.**

The spec references a "collection browser component (same one used in the Formations phase)" for sequence assignment slots. Phase 5 (Formations) is also unbuilt (backlog status). There is no existing collection browser component to reuse. This is a dependency on another unbuilt spec.

### MINOR

**M1: `FractalLevel.paths` type vs breathing requires recalculation.**

The `FractalLevel` interface stores `paths: MandalaPaths` as a single cached value. Per issue I1, breathing requires paths to be recomputed per frame per `tipDx` value. The interface should either drop `paths` (compute on demand) or clarify that `paths` is a base reference used for non-animated rendering only.

**M2: Frame budget claim lacks evidence.**

"Target: 60 fps at MAX_DEPTH = 5, 3 visible levels" — no profiling data is cited. The Phase 5 formations spec (which shares the same renderer) estimated 1600 `Path2D` constructions per frame at 32 formations as "typically stays under frame budget." The fractal spec at 3 levels would be ~150-240 Path2D constructions per frame (much lighter). But with issue I1 (geometry recomputation) and issue C2 (OffscreenCanvas allocation), the actual bottleneck may be elsewhere. The frame budget target is reasonable but the analysis underpinning it is incomplete.

**M3: `navigator.hardwareConcurrency < 4` as a mobile proxy.**

The codebase already has proper device tier detection: `DeviceDetector.ts`, `DeviceTierDetector.ts`, and `QualityTierDetector.ts`. Using raw `hardwareConcurrency` instead of these existing services contradicts the primitive-discovery rule. The fractal renderer should use the existing device tier system.

**M4: Hue shift implementation for "Depth Shift" color mode.**

"HSL-shifted stroke/fill colors" — Canvas 2D has no native HSL shift for strokes. The spec should note that the HSL computation happens at the JavaScript level (hex to HSL, shift H, back to hex) before passing colors to the palette. This is trivial to implement but should be explicit so the implementer doesn't search for a Canvas API that doesn't exist.

**M5: Breathing phase offset formula.**

"Level `n` has a phase offset of `n * (1 / MAX_DEPTH)`" — when MAX_DEPTH=5, level 4's offset is 0.8. Level 0's offset is 0.0. After wrapping (level 5 becomes level 0), the phase offset jumps from 0.8 to 0.0, which is a -0.8 discontinuity. For seamless looping, level MAX_DEPTH should have offset 1.0 (= 0.0 after mod), which it does since MAX_DEPTH mod MAX_DEPTH = 0 maps to offset 0.0. But the visual effect of the 0.2-step phase stagger wrapping at the loop boundary may produce a subtle "pulse reset." Worth testing; may need the offset to be continuous across the wrap point.

---

## RECOMMENDATIONS

1. **Before any implementation work:** Patch `renderMandalaToCanvas` to use `options.tipDx` for scale computation, matching the SVG renderer. This is a prerequisite, not part of the fractal feature — it's a bug in the existing Canvas renderer.

2. **Rewrite the Performance Strategy section** to honestly account for per-frame geometry recomputation during breathing. The `tipDx_quantized` cache is the right answer, but the section currently implies geometry is free after initial computation, which is false.

3. **Pre-allocate overlap mask canvases** outside the render loop. Add a `FractalRenderContext` class that owns the two reusable `OffscreenCanvas` instances for overlap masking.

4. **Add explicit DPR handling** to the Canvas Setup section. Reference the existing pattern in `MandalaOverlayCanvas.ts`.

5. **Clarify clip mask semantics.** State whether each level clips to its own bounding circle (preventing bleed outside) or clips away the inner region (creating a donut). The former is simpler and likely sufficient; the latter requires evenodd winding.

6. **Remove the collection browser dependency** or note it as a Phase 5 prerequisite. For Phase 8 standalone, a simple dropdown or list picker for sequence assignment is sufficient.

7. **Use existing device tier detection** instead of raw `hardwareConcurrency`. Reference `DeviceDetector.ts` or `QualityTierDetector.ts`.

8. **Consider `CanvasRenderingContext2D.reset()` (2024+ spec)** between frames instead of the save/translate/scale/restore pattern per level. This is a minor optimization but aligns with 2026 best practices.

9. **Anti-aliasing at deep nesting:** Canvas 2D anti-aliasing is automatic for strokes and fills, but at inner levels where `apparentRadius < 20px`, the Catmull-Rom spline paths will collapse to near-identical control points, producing jagged micro-curves. Consider reducing `samplesPerBeat` for inner levels (the spec mentions this as a performance fallback, but it's also a quality improvement — fewer samples at small scale avoids the sub-pixel jitter problem).

10. **Motion sickness mitigation for auto-zoom:** The default 8s/level is fine. The fast end (3s/level) will produce noticeable vestibular discomfort for some users during continuous viewing. Consider a `prefers-reduced-motion` media query check that either disables auto-zoom or forces a minimum of 10s/level.
