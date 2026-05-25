# Phase 5: Formations — Web Research Audit

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase5-formations-design.md`
**Date:** 2026-05-25
**Scope:** 2026 state-of-the-art verification of technical claims. Companion to `phase5-formations-audit.md` (codebase-level audit).

---

## Findings

---

### 1. Multi-Canvas Rendering Architecture (OffscreenCanvas in Workers)

**Spec says:** Single main-thread canvas with `renderMandalaToCanvas()` per frame. OffscreenCanvas worker path is deferred to "Phase 5b if needed." The spec pre-allocates OffscreenCanvas *objects* (overlap buffers) on the main thread, not in a worker.

**2026 SOTA:** The web.dev article and 2025 performance write-ups confirm: moving a Canvas 2D render loop to a `WorkerGlobalScope` via `OffscreenCanvas.transferControlToOffscreen()` produces measurable gains for CPU-heavy canvas work specifically because it eliminates main-thread contention. The key mechanism is "no synchronization between the DOM and Canvas" — rendering fully detaches from layout/paint cycles. The project already has a `composition.worker.ts` that demonstrates the pattern.

For the Phase 5 use case — a tight per-frame loop doing N path computations + N canvas stamp operations — the benefit is UI thread responsiveness rather than raw throughput. If the user is interacting with controls (period slider, formation type selector) while the canvas renders, the worker path keeps the slider smooth. On the main thread, a 6ms frame (N=16 sequential) will block style recalculation during the same frame.

**Verdict:** ⚠️ Better approach exists — the spec is not wrong, but the deferral framing is too conservative.

**Recommendation:** Implement the OffscreenCanvas worker path in Phase 5a as the *primary* path. The render loop (`formation-animation.ts` + `renderMandalaToCanvas`) is already DOM-free and stateless, making it worker-compatible with minimal adaptation. `FormationCanvas.svelte` calls `canvas.transferControlToOffscreen()` on mount and posts `FormationSlot[]` + config each frame. This eliminates UI jank at any N without changing the Canvas 2D approach. The existing `composition.worker.ts` is the template; the adaptation cost is low.

---

### 2. OffscreenCanvas Browser Support

**Spec says:** Pre-allocates two `OffscreenCanvas` objects for overlap mask buffers (P2 prerequisite). Does not call out browser support requirements.

**2026 SOTA:** `OffscreenCanvas` (both the constructor form and `transferControlToOffscreen`) is fully supported as of Safari 16.6+. Safari 16.4 — which was the last Safari release before 16.6 — does **not** have it. As of May 2026, Safari 16.6 is well past minimum viable support. The constructor form (`new OffscreenCanvas(w, h)` — used for the overlap buffers) and `transferControlToOffscreen` both share this baseline.

Current support: Chrome 69+, Firefox 105+, Safari 16.6+. Global coverage is ~97%+ as of 2026. No polyfill needed for any modern browser.

**Verdict:** ✅ Spec is current — with one precision note.

**Recommendation:** The spec's P2 pre-allocation of OffscreenCanvas objects (constructor form) is safe for all browsers the app targets. If Safari 16.4 were still a support target you'd need a fallback to regular `<canvas>` for the overlap buffers. Verify against the project's `browserslist` config; if it targets the last 2 Safari versions from 2026, 16.4 is out of range and no action is needed. Add a comment to the overlap-buffer allocation noting the 16.6 floor.

---

### 3. Formation Layout Algorithms

**Spec says:** Pure-function layout engine implementing ring (evenly-spaced circle), grid (M×N rectangular), spiral (Archimedean and logarithmic), and hexagonal (honeycomb rings). All are hand-rolled closed-form equations. No layout library dependency.

**2026 SOTA:** The hand-rolled approach is correct for all four formation types the spec defines:

- **Ring:** Evenly-spaced angles on a circle is a one-liner (`angle_i = 2π/N * i`). No library adds anything here.
- **Grid:** Trivial arithmetic. No library needed.
- **Hex:** Axial coordinate hex grids are well-documented (redblobgames.com remains the canonical reference). The spec's offset vectors match the flat-top convention correctly.
- **Spiral:** Archimedean and logarithmic spirals are standard parametric curves. The spec's formulas are correct.

`d3-force` would only be relevant if the spec wanted *collision-avoidance* or *physics-settled* layouts — e.g., packing mandalas of variable size without overlap. For the deterministic geometric formations described, d3-force adds overhead with no benefit. Poisson disc sampling is relevant for *random* formation variants (uniform random distribution with minimum spacing), which could improve the `random` phase-offset mode's spatial distribution but is not needed for the formation geometry itself.

**Verdict:** ✅ Spec is current — hand-rolled closed-form equations are the right choice for these formation types.

**Recommendation:** No change to the layout approach. If a future "scattered" formation type is added, Poisson disc sampling (already present in the project at `src/lib/shared/3d/environments/utils/poisson-disc.ts`) would give better spatial distribution than pure random placement.

---

### 4. Phase Offset Animation

**Spec says:** Single master clock drives all N mandalas. Per-slot phase: `effectivePhase_i = ((masterTime / period) + phaseOffset_i) % 1`. Six distribution modes (sequential, synchronized, random, alternating, radial, reverse). All in a manual RAF loop.

**2026 SOTA:** The Web Animations API (WAAPI) supports staggered delay via `delay` and `iterationStart` on `KeyframeEffect`. The WAAPI is GPU-composited for `transform` and `opacity` — but it operates on DOM elements. For canvas-rendered elements (as the spec correctly uses), WAAPI cannot drive per-element animation directly.

The W3C csswg-drafts issue #7637 ("phase linked offsets in keyframes") discusses adding phase-linked keyframe offsets at the CSS/WAAPI level, but this is still a proposal/draft as of 2026 and has no shipping implementation.

Motion.dev's `stagger()` function (the spiritual successor to the GSAP stagger API) handles DOM or JS-driven phase offsets cleanly, but is overkill here — the spec's `effectivePhase_i` formula is already as clean as any library would give you, with no dependency.

For the production pattern of "many canvas elements staggered with the same period, different phase offsets," a manual RAF loop with a master clock is still the standard and correct approach. No library ships a better primitive for canvas-rendered phase-offset oscillation.

**Verdict:** ✅ Spec is current — master clock + per-slot phase offset in a RAF loop is the correct 2026 pattern for canvas-rendered oscillations.

**Recommendation:** No change. The `effectivePhase_i = ((masterTime / period) + phaseOffset_i) % 1` formula is a well-known phase modulation idiom. Confirm the RAF loop is cancelled via `cancelAnimationFrame` on Svelte component `onDestroy` — this is not called out explicitly in the spec but is required to avoid ghost loops.

---

### 5. Canvas 2D vs WebGL for N > 8 Elements

**Spec says:** Canvas 2D handles N≤32 cleanly. WebGL instancing deferred to Phase 9 (N>50, tessellation use case). Hard cap at N=32.

**2026 SOTA:** Benchmarks from 2025–2026 confirm:

- Canvas 2D initial draw is *faster* than WebGL (~15ms vs ~40ms setup cost), but WebGL draw commands are vastly faster once loaded (~0.01ms vs ~1.2ms per draw call).
- The Canvas 2D crossover point for raw throughput is at **3,000–5,000 simple elements** (rectangles, sprites). For *complex path elements* (each mandala is ~20–80 `Path2D` objects), the per-element cost is much higher, so the Canvas 2D crossover happens earlier — but "earlier" here still means hundreds of mandalas, not dozens.
- N=32 complex Path2D mandalas at 60fps is well within Canvas 2D's capabilities on modern hardware. The spec's performance budget estimates (~12ms for N=32 sequential) are plausible.

PixiJS v8 (March 2024) is now WebGL/WebGPU only — it dropped the Canvas 2D fallback entirely. This confirms the industry direction, but it also means PixiJS is not a drop-in option if you want a Canvas 2D rendering pipeline (which the spec does, for consistency with the existing `MandalaPane` export path).

CSS Houdini Paint Worklets use a Canvas 2D-like API but are Chrome/Edge only as of 2026 (Firefox and Safari support is still incomplete/experimental). This rules them out for this use case.

**Verdict:** ✅ Spec is current — Canvas 2D at N≤32 is the right call. WebGL deferral to Phase 9 is well-reasoned.

**Recommendation:** The N=32 hard cap is appropriate. One caveat: the spec's per-frame cost estimate does not account for the `OffscreenCanvas` allocation bug identified in the codebase audit (I1). After fixing P2 (pre-allocated overlap buffers), re-profile on Firefox and Safari — Path2D parsing speed varies significantly across engines. If Firefox is a first-class target, consider caching `Path2D` objects in `MandalaPaths` alongside the `d` strings to eliminate re-parsing across frames (see Path2D section below).

---

### 6. Path2D Caching and Reuse

**Spec says:** `FormationPathsCache` caches `MandalaPaths` (the computed geometry) keyed by `sequenceId:tipDxInt`. The cache collapses N path computations to 1 in synchronized mode. The spec identifies `new Path2D(d)` construction as the true bottleneck.

**2026 SOTA:** MeasureThat benchmarks and MDN confirm that `Path2D` objects are *reusable* — once constructed from an SVG path string, the object can be passed to `ctx.fill(path2d)` / `ctx.stroke(path2d)` repeatedly without reconstruction. The spec's `FormationPathsCache` caches `MandalaPaths` (the geometry structs with `d` strings) but does not cache the `Path2D` objects themselves. Each call to `renderMandalaToCanvas` reconstructs `new Path2D(d)` from the cached string.

This is a two-level caching opportunity the spec misses:
1. **Level 1 (spec's cache):** Cache `MandalaPaths` by `sequenceId:tipDxInt` — avoids geometry recomputation.
2. **Level 2 (not in spec):** Cache `Path2D` objects by the same key — avoids SVG-string-to-path parsing on every draw call, even for cache hits.

At N=16 synchronized mode, Level 1 reduces geometry computation to 1 call/frame. But `renderMandalaToCanvas` still constructs ~50 `Path2D` objects per mandala × 16 mandalas = 800 `Path2D` constructions/frame (from the same cached `MandalaPaths`). With Level 2 caching, synchronized mode drops to ~50 `Path2D` constructions total per period (one reconstruction when tipDxInt changes), effectively zero at steady state.

**Verdict:** ⚠️ Better approach exists — the spec's cache is correct but stops one level short.

**Recommendation:** Extend `FormationPathsCache` (or a parallel `Path2DCache`) to store `Path2D[]` alongside `MandalaPaths`. Key by `sequenceId:tipDxInt`. In `renderMandalaToCanvas`, accept an optional `prebuiltPaths?: Path2D[]` parameter; if supplied, skip `new Path2D(d)` construction. In the formation render loop, populate the cache with `Path2D` objects on first use and reuse them on subsequent frames. This is the difference between ~800 Path2D constructions/frame (spec) and ~0 at steady state (optimized). Particularly valuable on Firefox where Path2D parsing from SVG strings is historically slower than V8.

---

### 7. SVG `<use>` Element Instancing as Alternative

**Spec says:** N SVG elements in the DOM is explicitly ruled out due to DOM parse + filter evaluation costs. Not proposed as an alternative to canvas.

**2026 SOTA:** The 2026 SVG performance picture confirms the spec's ruling. SVG `<use href="#symbol">` instancing (render one `<defs>` definition N times) does share the path geometry, but:

- Each `<use>` element is still a DOM node. At N=16, 16 DOM nodes participate in layout and style resolution each frame.
- SVG filters (`feGaussianBlur` for glow, `feBlend` for bloom) are applied *per element* — they do not share filter computation across `<use>` instances. MDN and performance guides consistently rate `feGaussianBlur` as "computationally heavy depending on radius."
- When animations change the symbol's geometry (the mandala breathes — `tipDx` changes every frame), the `<defs>` element must be updated every frame, and all `<use>` instances re-render.

SVG `<use>` instancing helps when geometry is *static* (icon sprite sheets). For animated, filter-heavy geometry that changes every frame, it provides no advantage over N separate SVG elements and the spec's rejection of SVG entirely is correct.

**Verdict:** ✅ Spec is current — ruling out SVG `<use>` instancing for animated filter-heavy N-element rendering is correct.

**Recommendation:** No change. The single-canvas Canvas 2D approach is the right baseline up to N=32.

---

### 8. Formation Export (Canvas toBlob / MP4 Pipeline)

**Spec says:** MP4 export uses the existing `h264-mp4-encoder` pipeline (same as `MandalaPane.svelte`). Frame count: `ceil(fps × period)`. At N=16, 5s period, 30fps: 2400 path computations total — described as fast enough for the main thread.

**2026 SOTA:** `canvas.toBlob()` is the modern best practice for exporting high-resolution canvas frames. MDN confirms it is async and uses binary Blob output, avoiding the synchronous string-based memory bloat of `toDataURL()`. For 1920×1080 frames at 30fps, `toBlob()` is the correct API. `OffscreenCanvas.convertToBlob()` is the worker-equivalent and also fully supported (same baseline as OffscreenCanvas: Safari 16.6+).

For the export pipeline specifically (offline, not real-time), running the render on the main thread is fine — the user is not interacting during export. The spec's claim that 2400 path computations is "fast enough for main thread" is correct for export context. The export loop does not need to be moved to a worker.

One note on export resolution: the spec uses 1920×1080 or 1080×1080. At `devicePixelRatio=2` (retina), this means the canvas `width`/`height` attributes are 3840×2160 / 2160×2160. The spec's `devicePixelRatio` handling section covers live rendering correctly, but the export config should explicitly specify that export uses a fixed DPR of 1 (export at nominal pixel dimensions, not retina-scaled) — otherwise the export canvas is 4× the intended pixel count. The existing `MandalaPane` export likely handles this but the spec does not call it out.

**Verdict:** ✅ Spec is current on export methodology, with one clarification needed on DPR handling during export.

**Recommendation:** Add a note to `FormationExportConfig` and `formation-exporter.ts` spec that export always uses `dpr=1` (nominal pixel dimensions). Pass `{ width: config.width, height: config.height }` directly to `computeFormationLayout` for export (do not multiply by `window.devicePixelRatio`). This is likely the existing behavior but should be explicit.

---

## Summary Table

| Topic | Verdict | Action Required |
|-------|---------|-----------------|
| OffscreenCanvas worker path | ⚠️ Better approach exists | Move render loop to worker in Phase 5a, not deferred |
| OffscreenCanvas browser support | ✅ Current | Add comment noting Safari 16.6 floor |
| Formation layout algorithms | ✅ Current | None |
| Phase offset animation (RAF loop) | ✅ Current | Confirm `cancelAnimationFrame` on `onDestroy` |
| Canvas 2D vs WebGL at N≤32 | ✅ Current | Re-profile on Firefox post P2 fix |
| Path2D caching | ⚠️ Better approach exists | Add Level 2 `Path2D` object cache alongside geometry cache |
| SVG `<use>` instancing | ✅ Current | None |
| Canvas export (toBlob / MP4) | ✅ Current | Explicitly pin `dpr=1` in export config |

---

## Priority Recommendations

**High — implement in Phase 5a:**
1. **OffscreenCanvas worker path** — The render loop is already worker-compatible (DOM-free, stateless). Moving it to a worker in 5a rather than deferring to 5b costs little and eliminates the entire category of "frame budget exceeded" risk.
2. **Path2D object cache (Level 2)** — Extends the existing `FormationPathsCache` to store `Path2D[]` alongside `MandalaPaths`. In synchronized mode this drops per-frame Path2D construction to near-zero. High reward, low complexity.

**Low — document/verify:**
3. **Safari 16.6 OffscreenCanvas floor** — Just a comment. No code change unless the project's `browserslist` still targets 16.4.
4. **Export DPR=1 pin** — One-line clarification in `FormationExportConfig` and `formation-exporter.ts`.
