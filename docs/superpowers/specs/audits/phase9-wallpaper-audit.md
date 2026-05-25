# Audit: Mandala Phase 9 — Wallpaper / Tessellation Export

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase9-wallpaper-design.md`
**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25

---

## VERDICT

**CONDITIONAL PASS** — The spec is well-structured with correct tessellation math and a sound overall architecture, but has three critical issues that will cause runtime failures or visual corruption if built as written. Fix those before implementation.

---

## STRENGTHS

1. **Correct reuse of existing renderer.** `renderMandalaToCanvas` already accepts `offsetX`/`offsetY` (line 231 of `mandala-renderer.ts`), confirming the spec's core claim that tessellation can iterate tile positions without per-tile intermediate canvases.

2. **Geometry caching is well-designed.** The `Map<string, MandalaPaths>` keyed by `tipDx.toFixed(1)` is a sound optimization. In `uniform` phaseMode this reduces N tiles to 1 geometry calculation per frame, and in wave modes it caps at the number of unique columns/rows.

3. **Encoder reuse is valid.** `h264-mp4-encoder` is already dynamically imported in `MandalaPane.svelte` (line 248). The tessellation exporter can use the same import path.

4. **Tessellation math is correct.** Hex vertical spacing of `tileRadius * sqrt(3)`, triangular centroid placement, and brick half-width offset are all standard. The bleed-tile strategy (one extra tile per edge) handles boundary clipping properly.

5. **1080p animated cap is justified.** The throughput estimate (0.5 ms per `calculate()` call, 2,400 calls for 16 tiles at 30fps/5s) aligns with observed geometry calculator performance. 4K animated would 4x the pixel fill and require 4x the encoder bandwidth — impractical for client-side WASM encoding.

6. **Phase-offset seamless loop logic is correct.** Both breath phase (`phase % 1`) and color phase (`phase % 1`) are periodic by construction. The frame count formula (`totalFrames = fps * cyclePeriod`) produces an exact cycle.

7. **Clean separation of concerns.** `computeTileLayout` as a pure function returning `TileDescriptor[]` is the right primitive — fully testable, no side effects.

---

## ISSUES

### Critical

**C1: Overlap masking creates full-canvas OffscreenCanvases per tile and composites incorrectly.**

`renderMandalaToCanvas` (lines 286-319) creates two full-canvas-sized `OffscreenCanvas` objects (`maskB`, `maskR`) for purple overlap blending, then composites the result at identity transform (line 315: `ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(maskB, 0, 0)`). This means:

- **Memory:** For a 4K canvas (3840x2160), each `OffscreenCanvas` is ~33 MB RGBA. Two per tile. With 64 tiles, that's 64 * 2 * 33 MB = ~4.2 GB of intermediate allocations per frame, even if GC'd between tiles.
- **Correctness:** The `drawImage(maskB, 0, 0)` draws the mask at canvas origin with identity transform, blending purple overlap from all previous tiles into the current tile's region. When tile N is rendered, its mask canvas contains stale transform state from the main canvas that includes tile N's offset — but then the composite happens at identity, covering the entire canvas. Each tile's overlap will visually bleed across the full canvas.

**Fix:** Either (a) clip the mask OffscreenCanvases to tile bounds (create them at `tileSize x tileSize` and adjust transforms), or (b) render each tile to a per-tile OffscreenCanvas at `tileSize x tileSize` first, then `drawImage` the completed tile onto the shared export canvas. Option (b) is simpler and avoids the transform arithmetic. The per-tile canvas is small (220x220 default) so memory is fine.

**C2: `renderMandalaToCanvas` ignores `options.tipDx` — scale is hardcoded to `MANDALA_STANDARD_TIP_DX`.**

The spec says (Section "Export Pipeline", step 3): "Render each mandala to the shared OffscreenCanvas via `renderMandalaToCanvas()` with `offsetX/offsetY`." It also says (step 2): "call `calculator.calculate(steps, ..., { dx: tipDxSnapshot })`" with varying tipDx per frame.

But `renderMandalaToCanvas` (line 235) computes scale using the hardcoded constant: `const tipReach = MANDALA_STANDARD_TIP_DX * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS`. It does NOT read `options.tipDx`. Compare with `renderMandalaSVG` (line 100) which does: `const effectiveTipDx = Math.max(options.tipDx ?? MANDALA_STANDARD_TIP_DX, MANDALA_STANDARD_TIP_DX)`.

Result: when animated tipDx exceeds `MANDALA_STANDARD_TIP_DX` (130), the Canvas renderer's viewBox won't expand to accommodate the larger geometry. Paths will be clipped at tile edges. The SVG renderer handles this correctly; the Canvas renderer doesn't.

**Fix:** Port the dynamic `tipDx` scaling from `renderMandalaSVG` into `renderMandalaToCanvas`. This is a ~3 line change.

**C3: `renderMandalaToCanvas` has no rotation parameter — spec assumes per-tile rotation exists.**

The spec defines `tileRotation` and `rotationJitter` per tile, and the `TileDescriptor` includes a `rotation` field. But `renderMandalaToCanvas` accepts no rotation parameter. The existing MandalaPane MP4 export handles rotation externally through the SVG pipeline (rendering SVG, then drawing to canvas with `ctx.rotate()`), but the spec proposes using `renderMandalaToCanvas` directly.

**Fix:** Either add a `rotation` option to `renderMandalaToCanvas` (apply `ctx.rotate(rad)` after the translate, before the scale), or wrap each tile render in a `ctx.save()` / `ctx.rotate()` / `ctx.restore()` in the tessellation exporter. The latter keeps the renderer unchanged but requires the exporter to manage transform state.

### Important

**I1: Spec does not mention the existing `VideoExporter` / `WebCodecsVideoEncoder` infrastructure.**

The codebase has a mature `VideoExporter` class (`animation-engine/services/implementations/VideoExporter.ts`) that auto-detects WebCodecs support (Chrome/Edge/Safari) and falls back to WASM `h264-mp4-encoder` for Firefox. It also has a `BackgroundVideoEncoder` that offloads encoding to a Web Worker.

The spec proposes using the raw `h264-mp4-encoder` import directly, duplicating the encoder creation logic already in `MandalaPane.svelte`. For Phase 9, the tessellation exporter should use `VideoExporter.createManualExporter()` instead — it provides:
- Automatic WebCodecs hardware acceleration when available (significantly faster than WASM for 1080p)
- Cancel support
- Proper cleanup on error
- Even-dimension enforcement (H.264 requires even width/height)

This is not speculative — the infrastructure exists and is production-tested.

**I2: Static PNG export at 4K may hit canvas size limits on mobile.**

The spec caps custom resolution at 4096x4096. A 4K portrait wallpaper (2160x3840) is within most desktop Chrome limits (~16384x16384), but mobile Safari caps canvas memory at ~16 MP for older devices and ~64 MP for recent ones. A 2160x3840 canvas is ~8.3 MP — fine. But the overlap mask OffscreenCanvases double this (per C1). On a 4GB RAM iPhone, two full-canvas OffscreenCanvases at 4K could trigger a canvas allocation failure.

The per-tile rendering approach from C1's fix also resolves this — per-tile canvases are tiny.

**I3: `MandalaViewerSettings` extraction is underspecified.**

The spec mentions extracting `MandalaViewerSettings` from `MandalaPane.svelte` but doesn't list the full interface. The current settings include `pathShape`, `preset`, `colorMode`, `speed`, `depth`, `lineWeight`, `customBlue`, `customRed` (per the spec) but also `rotation`, `paused`, `bgColor`, and the derived values (`period`, `rangeMax`, `palette`, `gradientColors`). The interface needs to clearly distinguish input settings from derived state.

**I4: Animated export blocks the main thread.**

The spec's animated export loop (Section "Animated MP4") runs geometry calculation and canvas rendering synchronously in a `for` loop on the main thread. With 64 tiles at 150 frames, that's 9,600 geometry calculations plus 9,600 canvas renders per export. At ~0.5 ms per calculation plus ~1 ms per render, that's ~14 seconds of main-thread blocking. The UI will be frozen — the progress callback inside the loop won't actually update the DOM until the microtask queue drains.

**Fix:** Wrap each frame (or batch of frames) in `requestAnimationFrame` or `setTimeout(0)` to yield to the browser. The spec mentions this for static PNG row-batching but not for animated export.

### Minor

**M1: Hex spacing formula uses `tileRadius` but the config uses `tileSize`.**

The spec says hex vertical spacing = `tileRadius * sqrt(3)`. The config parameter is `tileSize`, not `tileRadius`. For pointy-top hex, vertical spacing between row centers is `tileSize * sqrt(3)` (where tileSize is the distance between parallel sides). For flat-top, it's `tileSize * sqrt(3) / 2` (where tileSize is the width across flats). The spec should clarify the relationship between `tileSize` and hex geometry for each sub-variant.

**M2: `toBlob('image/png')` is not available on `OffscreenCanvas` in all browsers.**

The spec says static PNG uses `OffscreenCanvas` (Section "Technical Architecture": "Both functions manage their own `OffscreenCanvas` (static)"). `OffscreenCanvas.convertToBlob()` is the correct method (not `canvas.toBlob()`). Safari added `OffscreenCanvas` support in 16.4 but `convertToBlob` only in 17.0 (2023). For maximum compatibility, use `HTMLCanvasElement.toBlob()` for static export and reserve `OffscreenCanvas` for the mask compositing that already uses it.

**M3: No AVIF/WebP static export option.**

AVIF at quality 80 produces files 40-60% smaller than PNG for this type of content (geometric art with large uniform regions). WebP is 30-40% smaller. For a 4K wallpaper estimated at ~8 MB PNG, AVIF would be ~3 MB. Both `canvas.toBlob('image/avif')` and `canvas.toBlob('image/webp')` are supported in Chrome/Edge. Worth adding as a future enhancement even if not in Phase 9 scope.

**M4: `colorIntensity` in `TessellationConfig` is not connected to any specific math.**

The spec defines `colorIntensity: number (0-1)` as "variation amount for non-uniform modes" but doesn't specify how it modifies the color variant algorithms. For `hue-rotate`, is it the max hue shift in degrees (scaled by intensity)? For `gradient-x`, is it the fraction of the full color cycle applied across the width? Without this, implementation will require guesswork.

**M5: Preview "always animated" may confuse users selecting Static export.**

The spec says the preview is always animated even when Static export is selected. This could mislead users into thinking their static export will be animated. Consider showing the frozen state (current breath phase) when Static is selected, with a small play button to preview animation if desired.

---

## RECOMMENDATIONS

1. **Fix C1 first — it's the blocker.** Render each tile to a per-tile OffscreenCanvas, then stamp it onto the shared export canvas. This fixes overlap correctness, eliminates the memory explosion, and simplifies the entire pipeline.

2. **Port `tipDx` scaling to `renderMandalaToCanvas` (C2).** This is a 3-line fix that makes Canvas rendering match SVG rendering for animated mandalas. It benefits the existing single-mandala export too.

3. **Add rotation to `renderMandalaToCanvas` or handle it in the exporter (C3).** A rotation option on the renderer is cleaner long-term, but wrapping in the exporter works for Phase 9.

4. **Use `VideoExporter` instead of raw `h264-mp4-encoder` (I1).** This gets WebCodecs hardware acceleration for free and handles browser detection.

5. **Add frame-level yielding to the animated export loop (I4).** Use `await new Promise(r => setTimeout(r, 0))` every N frames (e.g., every 10 frames) so the progress indicator actually renders.

6. **Spec the `colorIntensity` math (M4)** before implementation to avoid rework.
