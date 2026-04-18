# Effects Canvas-Relative Sizing — Design

**Date:** 2026-04-18
**Status:** Approved, ready for implementation plan
**Scope:** 2D overlay effects (Sparkles, Zap, Echo, Bloom, Trails, LED)

## Problem

Effects currently use literal pixel values throughout the pipeline. On a 4K monitor they look balanced; on an iPhone-sized animator they overpower the sequence because a `3px` sparkle core is a much larger fraction of a 300px canvas than a 1024px canvas.

## Decision

Introduce a `scale` factor derived from the live canvas size against the existing `DEFAULT_CANVAS_SIZE = 500` constant from `ICanvasResizer`. Every pixel-space quantity in the 2D renderers gets multiplied by `scale` at draw time.

- Reference: `DEFAULT_CANVAS_SIZE = 500` (reused from the existing `ICanvasResizer` contract — this is already the convention `Canvas2DTrailRenderer` uses for its own `sizeScale`, so adopting it here keeps trails and the other effects on the same baseline).
- `scale = canvasSize / DEFAULT_CANVAS_SIZE` where `canvasSize = min(canvasWidth, canvasHeight)` — matches `Canvas2DTrailRenderer` exactly.
- `min()` chosen over `max()`/`sqrt()` so that a narrow mobile canvas scales by its constrained dimension — the one that actually limits visual real estate.

Intent values (e.g., `bloom.radius: 8-200 px`, `sparkles.spread: 0-30 px`) remain documented as "pixels at the reference size." The renderer converts them. No contract churn at the intent layer — the user-facing sliders still behave identically, just relative to the reference instead of the device.

**Existing precedent:** `Canvas2DTrailRenderer.renderTrails()` already accepts `canvasSize: number` and computes `sizeScale = canvasSize / DEFAULT_CANVAS_SIZE` internally. This plan extends that pattern to Sparkles, Zap, Echo, and Bloom. LED has no dedicated 2D renderer class yet; wire-up is deferred until that extraction happens.

## Architecture

### Layer responsibilities

| Layer | Change |
|---|---|
| `EffectsConfig` intents | **Unchanged.** Values still expressed in reference-size pixels. |
| `canvas2d-translator.ts` | **Unchanged.** Still emits reference-size params. |
| `*2DRenderer` pure classes | Accept a new `scale: number` argument on `render()`. Multiply every pixel-space constant and param by `scale`. Tip coordinates untouched. |
| `*OverlayRenderer` (service impl) | Store `this.scale`, recompute on `initialize()` and `resize()`, pass into `renderer.render()`. |

### Scale propagation

```
container dims → OverlayRenderer.resize(w, h)
              → this.scale = min(w, h) / 1024
              → each frame: renderer.render(ctx, params, tips, dt, scale)
              → renderer multiplies pixel constants by scale
```

### What scales vs. what doesn't

**Scales (all pixel-space quantities):**
- Stroke line widths
- Particle/dot/arc radii
- Glow blur radii
- Jitter amplitudes
- Gravity acceleration (px/s²)
- Burst/velocity magnitudes (px/s)
- Upward bias offsets
- Motion thresholds (`BURST_MOTION_THRESHOLD`)
- Any literal pixel offset inside a `ctx.moveTo`/`lineTo` that's size-like, not position-like

**Does NOT scale:**
- Tip coordinates (already in canvas pixels — positions, not sizes)
- Time-based quantities (`lifetime`, `pulseRate`, `dt`)
- Counts (`spawnCount`, `segments`, `poolSize`)
- Opacities, blend modes, colors
- Probabilities (`branching`)

**Edge case:** minimum-thickness clamps (`Math.max(1, ...)`, `Math.max(0.6, ...)`, `Math.max(0.5, ...)`) remain pixel-valued — sub-pixel strokes disappear on any device. The scaled value is still subject to the clamp; on tiny canvases some strokes flatten to 1px, which is correct.

## Affected files

**Pure renderers (add `scale` arg, multiply constants):**
- `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts`
- `src/lib/shared/effects/renderers/Zap2DRenderer.ts`
- `src/lib/shared/effects/renderers/Echo2DRenderer.ts`
- `src/lib/shared/effects/renderers/Bloom2DRenderer.ts`

**Already handled — out of scope for this plan:**
- `Canvas2DTrailRenderer.ts` (already accepts `canvasSize` and computes `sizeScale` internally)
- LED 2D (no dedicated 2D renderer class; handle when extracted)

**Overlay services (compute + pass scale):**
- `src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts`
- `src/lib/shared/animation-engine/services/implementations/ZapOverlayRenderer.ts`
- `src/lib/shared/animation-engine/services/implementations/EchoOverlayRenderer.ts`
- `src/lib/shared/animation-engine/services/implementations/BloomOverlayRenderer.ts`

**Contracts:**
- Each `I*OverlayRenderer` contract unchanged — `scale` stays internal to the overlay implementation, derived from the already-known canvas `width`/`height`.

**New shared helper:**
- `src/lib/shared/effects/renderers/scale.ts` exporting `computeEffectScale(width, height): number` that returns `min(width, height) / DEFAULT_CANVAS_SIZE`. Single function so the formula is consistent across all four renderers and the trails path.

## Testing

Existing `*.test.ts` suites pass a default `scale = 1` to preserve current behavior assertions. New tests per renderer:

1. At `scale = 1`, output matches existing authored sizes (regression guard).
2. At `scale = 0.5`, every size-like output is half (numerical: line widths, radii, jitter).
3. Tip positions at `scale = 0.5` are unchanged (positions don't scale).
4. Minimum clamps still apply at very small scales (no disappearing strokes).

## Verification plan

After implementation, screenshot the sequence viewer with a representative effect (Sparkles at default) at three viewport sizes:
- Desktop (≥1024px min dim) — should look identical to pre-change
- Tablet (~700px min dim)
- iPhone SE (~375px min dim)

On iPhone SE the effect should read as *"same character, scaled down"* rather than *"overwhelming the sequence."*

## Out of scope

- 3D effects (world units already scale naturally with camera distance; Austen confirmed low concern).
- Retuning preset values. Goal is proportional scaling, not redesigning how any effect looks at reference size.
- Making `REFERENCE_DIM` user-configurable. It's an implementation constant.
