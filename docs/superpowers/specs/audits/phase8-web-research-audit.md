# Phase 8: Fractal Nesting — Web Research Audit

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase8-fractal-nesting-design.md`
**Date:** 2026-05-25
**Focus:** Mobile performance constraints — fractal nesting is the phase most likely to hit hardware limits.

---

## Findings

---

### 1. Recursive Canvas Rendering — Single Context vs Layered Canvases

**Spec says:** One `<canvas>` element, one `CanvasRenderingContext2D`. Levels are painted back-to-front using `ctx.save()` / `ctx.arc()` / `ctx.clip()` per level, each level calling `renderMandalaToCanvas` in sequence within the same frame loop.

**2026 SOTA:** The spec's single-context approach is well-aligned with best practice. MDN's optimization guide and the 2026 canvas performance survey both confirm that multiple layered canvases help *only* when content decomposes into static-background + dynamic-foreground regions. For the fractal case, every level changes every frame (zoom + breath), so layered canvases would cost N composites per frame without reducing draw calls — net regression, not gain. The single-context pattern eliminates the alpha-composite overhead of layer merging.

The one legitimate alternative — rendering each level to an OffscreenCanvas and compositing results — is addressed separately in §5.

**Verdict:** ✅ Spec is current

**Recommendation:** No change. The spec correctly rejects multi-canvas layering for a fully-dynamic scene. The advisory note to keep OffscreenCanvas worker migration unblocked (no DOM refs in render path) is the right hedge.

---

### 2. Zoom Animation — `zoomPhase` Wrap Technique

**Spec says:** A scalar `zoomPhase ∈ [0, 1)` advances per frame, wraps at 1.0 (incrementing `activeBaseLevel`), and drives apparent-radius computation via `apparentRadius(n, z) = (canvasSize/2) * SCALE_RATIO^(n - z)`. The loop is exact because level 0 and level `MAX_DEPTH % MAX_DEPTH` share the same geometry and the same breath-clock phase.

**2026 SOTA:** This is the established technique for seamless fractal zoom loops. "The Alpha Blenders" fractal zoom documentation and jsFractalZoom both describe the same phase-locked-loop / layer-cycling approach: scale copies of the same image so that a camera zoom onto a spot in one ends with the identical frame it started from. The spec's formulation (`SCALE_RATIO^(n - z)`) is mathematically identical to the standard "logarithmic zoom parameterisation" used in continuous Mandelbrot zoom engines.

The CSS pure-zoom alternative (`@keyframes { transform: scale(φ) }` repeated) achieves the Droste effect cheaply for static images but cannot animate *changing* geometry (breath, color shift, different sequences per level). It is inapplicable here.

**Verdict:** ✅ Spec is current

**Recommendation:** No change. The only refinement worth noting: the spec should guard against `deltaTime` spikes (tab visibility change, GC pause) that would make `zoomPhase += deltaTime / cycleDuration` skip a full level and produce a visual jump. A `deltaTime = Math.min(deltaTime, 100)` clamp (100ms cap) before advancing the phase is standard in animation loops and worth a one-liner in the implementation note.

---

### 3. LOD Culling — Radius Thresholding

**Spec says:** Levels are rendered only when `apparentRadius > MIN_RENDER_PX` (4px) and `< canvasSize * 1.5`. Boundary levels get a `globalAlpha` fade in/out. Typically 3 levels are active simultaneously.

**2026 SOTA:** This matches the standard web LOD pattern. The IEEE CCLOD paper (2022, still current practice) and MDN's progressive-rendering guidance both recommend distance/size thresholds as the primary LOD signal for canvas scenes, with pixel-size floor (the spec's `MIN_RENDER_PX`) as the canonical metric for 2D contexts. There is no standardized LOD library for Canvas 2D — implementations hand-roll the threshold check. The spec's formula is idiomatic.

The 2026 LODGE paper on Gaussian Splatting and the arxiv LOD elastodynamics work cover 3D/volumetric LOD, which is inapplicable here.

The `samplesPerBeat` reduction for inner levels (mentioned under Frame Budget fallbacks) is a domain-specific LOD on geometry density — this is more sophisticated than generic canvas LOD and is the right approach for mandala paths specifically, since a 12px-radius mandala with 32 path segments is wasteful and the simplification is visually imperceptible.

**Verdict:** ✅ Spec is current

**Recommendation:** Promote the `samplesPerBeat` reduction from a fallback note to a first-class LOD behaviour: compute a `lodMultiplier = clamp(apparentRadius / canvasSize, 0.1, 1.0)` and scale `samplesPerBeat` accordingly for every inner level, not just on mobile. The geometry cache already quantizes `tipDx` — quantizing `samplesPerBeat` per level costs nothing extra and improves cache hit rate on inner levels (smaller canvases need fewer samples to fill the same number of geometry buckets).

---

### 4. Geometry and Path2D Caching

**Spec says:** Two-level cache: (1) `MandalaPaths` keyed by `(sequenceId, tipDx_quantized)` with 2px quantization step; (2) `Map<string, Path2D>` keyed by SVG `d` string, max 500 entries with LRU eviction. Both should extend rather than duplicate `mandala-paths-cache.svelte.ts`.

**2026 SOTA:** This is the recommended pattern. The MeasureThat benchmarks (Path2D cache vs canvas cache) confirm `Path2D` reuse is 2–4× faster than re-parsing `d` strings, and the BSWEN 2026 cross-device canvas guide recommends exactly the offscreen-render-once + `drawImage` for static content and `Path2D` reuse for dynamic-but-repeated paths.

However, the spec's recommendation to *extend* `mandala-paths-cache.svelte.ts` has a critical architectural conflict: that file is a Svelte `$state` reactive cache (`const cache = $state<Record<string, MandalaPaths>>({})`). Svelte `$state` objects are proxied and trigger reactivity tracking on every property access. Calling `cache[shapeHash]` inside a `requestAnimationFrame` loop will register the fractal renderer as a reactive subscriber and trigger re-renders on every cache write — exactly the "Svelte reactivity loop entanglement" the spec's OffscreenCanvas worker design is trying to avoid.

The `Path2D` cache (level 2) cannot be shared with a worker at all: `Path2D` objects are not transferable across the structured-clone boundary. This is correct in the spec but worth flagging explicitly in the implementation so developers don't try to include `Path2D` instances in the `FractalRenderRequest` message.

**Verdict:** ⚠️ Better approach exists

**Recommendation:** Create a separate, plain `Map`-based geometry cache for the fractal renderer — not a Svelte reactive store. The interface can mirror `mandala-paths-cache.svelte.ts` but must use a plain `Map<string, MandalaPaths>`, not `$state`. This avoids reactive proxy overhead at 60fps and keeps the render path clean for worker migration. The two caches can share the `MandalaGeometryCalculator` instance.

---

### 5. OffscreenCanvas Worker Architecture

**Spec says:** Move fractal rendering to a Web Worker via `transferControlToOffscreen` (or a `postMessage` bitmap pattern). Ships synchronous first, then migrates if profiling shows pressure.

**2026 SOTA:** `OffscreenCanvas` with `transferControlToOffscreen` is broadly supported as of Safari 16.4+ (confirmed shipping in Safari 16.6, and current iOS Safari versions in 2026 are 18.x, all supporting it). The `caniuse` data and TestMU browser compatibility table confirm 90%+ global support including current iOS Safari. This is no longer a bleeding-edge API.

One nuance: `transferControlToOffscreen()` permanently delegates *all* rendering to the worker — the main thread can no longer draw to that canvas. The spec's "ship synchronous first, migrate later" plan requires that the synchronous implementation never touch the canvas from a reactive context, or the migration will require a refactor. The spec correctly flags this ("no DOM references in the render path, no reactive stores read inside the render loop") — but it should be stated as a hard constraint, not a soft preference.

**Verdict:** ✅ Spec is current (with one hardening note)

**Recommendation:** Add to the spec: `transferControlToOffscreen` must be called at init time if the feature-detect succeeds — not deferred to "when profiling shows pressure." Once the synchronous path is wired correctly (no reactive entanglement, no DOM refs), the worker migration is a one-day mechanical change. Deferring it means it will never happen because it's never "urgent enough." The worker path is especially high-value on mobile where the main thread is also running layout and Svelte's rendering scheduler.

---

### 6. OffscreenCanvas Memory — Mobile Safari Limits

**Spec says:** P2 prerequisite calls out 360 `OffscreenCanvas` allocations/second (3 visible levels × 60 fps), each ~8 MB on 1080p, as the GC pressure source. Fix: pre-allocate two reusable mask canvases at init time.

**2026 SOTA:** This is verified and urgent. iOS Safari imposes a total canvas memory budget that has ranged from 224 MB (older iOS 12) to 384 MB (iOS 15) — and the limit is *cumulative across all live canvases*. Critically, Safari "hoards" canvas elements and does not release them promptly to GC even after all JS references are dropped. Issue #195325 in WebKit Bugzilla confirms this is a long-standing and unresolved behaviour.

At 8 MB per `OffscreenCanvas` allocation × 360 allocations/second, the app would blow through even the 384 MB budget in under 2 seconds if GC doesn't keep pace. On iPhone 13 class devices (4–6 GB RAM total), Safari's web content process cap is closer to 1.2 GB, but canvas-specific GPU-backed memory is subject to the lower hard limit.

The pre-allocated pair is the right fix. However, the spec's fractal mode *also* introduces the main visible canvas (1 × DPR² × canvasSize²) plus up to MAX_DEPTH temporary clip computations. Even with pre-allocation, total steady-state canvas memory should be profiled explicitly on iPhone 12 class (A14) hardware, not assumed to be fine.

**Verdict:** ✅ Spec identifies the risk and the correct mitigation — but the severity is higher than the spec implies

**Recommendation:** The P2 prerequisite fix (pre-allocated mask canvases) is load-bearing and must not be treated as optional housekeeping. It should be a blocking gate on Phase 8 development, not just P1 (the tipDx scale bug). Add an explicit mobile memory budget to the Phase 8 acceptance criteria: total canvas memory across all `OffscreenCanvas` instances must not exceed 48 MB at steady state (1 main canvas at 1080p × DPR=3 ≈ 28 MB, plus 2 pre-allocated mask canvases at matching resolution ≈ 20 MB). 48 MB is well within Safari's limit and leaves headroom for other page canvases.

---

### 7. CSS Containment for the Fractal Canvas Element

**Spec says:** Nothing — CSS containment is not mentioned.

**2026 SOTA:** The `content-visibility` property and `contain: layout paint` are well-supported (Chrome 85+, Firefox 109+, Safari 15.4+). For a `<canvas>` element that fills its pane, `contain: strict` (which implies layout + paint + size) tells the browser the canvas's layout and paint are fully self-contained. The practical gain for a full-pane canvas is modest (browser already knows a full-pane element doesn't overflow), but the `contentvisibilityautostatechange` event from `content-visibility: auto` is genuinely useful: it fires when the canvas enters/exits the viewport, enabling the fractal renderer to pause the `requestAnimationFrame` loop when the user scrolls the mandala viewer off screen.

**Verdict:** ⚠️ Minor enhancement exists

**Recommendation:** Add `contain: strict` to the fractal canvas element's CSS and wire the `contentvisibilityautostatechange` event (or `IntersectionObserver` as fallback) to pause/resume the animation loop when the canvas is not visible. On mobile, this prevents the fractal from burning CPU/GPU while the user is looking at controls or has scrolled the pane. This is a 10-line addition with meaningful battery impact.

---

### 8. Fractal Art Libraries — Should the Spec Reference Them?

**Spec says:** Implements a custom fractal nesting system on top of the existing `renderMandalaToCanvas` backend.

**2026 SOTA:** No existing library is a fit. The relevant candidates:

- **p5.js** — general-purpose creative coding. Its fractal circle demos use recursive function calls, not the phase-locked-loop zoom approach. It would require wrapping the existing mandala renderer inside p5's draw loop — pure overhead.
- **jsFractalZoom** — Mandelbrot-specific zoomer with its own tile-based rendering pipeline. Completely incompatible with mandala path geometry.
- **ZoomJS / FractalFlow / InfiniteCanvas** (referenced in one search result) — these appear to be LLM-hallucinated GitHub repositories. No authoritative source confirms they exist.
- **Konva.js** — scene graph library with OffscreenCanvas support and node-level caching (`node.cache()`). Its caching model (bitmap-cache a node subtree, then composite as a single texture) is applicable to the fractal case, but adopting Konva would mean migrating the entire mandala renderer to Konva's shape model — not worth it for one feature.

The spec is correct to build directly on the existing canvas backend. No library substitution is warranted.

**Verdict:** ✅ Spec is current

**Recommendation:** No external library needed. The "ZoomJS / FractalFlow / InfiniteCanvas" repositories cited in one search result should not be cited in any implementation notes — they could not be verified as real projects.

---

## Summary Table

| Topic | Verdict | Action Required |
|---|---|---|
| Single-context recursive rendering | ✅ Current | None |
| `zoomPhase` wrap / logarithmic zoom | ✅ Current | Add `deltaTime` clamp guard |
| LOD radius culling | ✅ Current | Promote `samplesPerBeat` LOD to first-class |
| Geometry + Path2D caching | ⚠️ Better exists | Separate plain-Map cache from Svelte `$state` cache |
| OffscreenCanvas worker migration | ✅ Current | Harden: make no-reactive-entanglement a hard constraint, not soft preference |
| OffscreenCanvas mobile memory | ✅ Risk identified — severity understated | Elevate P2 to blocking gate; add 48 MB budget acceptance criterion |
| CSS containment | ⚠️ Minor enhancement | Add `contain: strict` + pause-on-hidden |
| Fractal art libraries | ✅ Current | No substitution warranted |

---

## Mobile-Specific Verdict

The spec's performance strategy is broadly sound for desktop. The mobile risk surface has two critical items:

1. **P2 (pre-allocated mask canvases) must block Phase 8 development** — it is not optional cleanup. At 360 GC-pressured allocations/second on iOS Safari, the feature will crash or stutter on current iPhones before the first user interaction.

2. **The Svelte reactive cache contamination** (Finding 4) is a silent performance bug that will not manifest in local dev (where Svelte's dev-mode reactivity tracking is visible) but will compound on mobile where every extra GC sweep in the animation loop costs a dropped frame. Fixing it before ship is cheaper than diagnosing it after.

The `samplesPerBeat` LOD (Finding 3) and the `contain: strict` + pause-on-hidden (Finding 7) are quality-of-life wins with low implementation cost and meaningful battery impact on mobile ambient display use — the primary use case for the fractal mode.
