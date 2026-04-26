---
status: archived
---
# Trail Offscreen Canvas — Design Spec

## Problem

The trail rendering system uses a precomputed path cache that produces beautiful, gap-free trails — but the cache is scoped to a single sequence. When the infinite generator chains sequences, all trail history from the previous sequence vanishes instantly because the cache rebuilds for the new sequence.

The real-time trail capturer (TrailCapturer) was intended as a fallback, but it produces broken rendering (wrong endpoint positions, jagged artifacts). It has never worked correctly in the Effects Lab — the cache has always masked its issues.

Multiple attempts to fix this by manipulating trail data buffers (merging, snapshotting, swap notifications) all failed because the cache and capturer use incompatible coordinate systems (beat-indexed vs wall-clock timestamps).

## Solution: Offscreen Canvas with `destination-out` Fade

Move trail rendering from the main Canvas2D to a dedicated offscreen Canvas2D overlay. Instead of clearing and redrawing trails each frame, accumulate trail output onto the offscreen canvas and apply a per-frame fade using the `destination-out` composite operation.

This is the same architectural pattern used by fire (WebGL2), charcoal (WebGL2), and LED (WebGL2) overlays — each effect gets its own canvas, positioned absolutely over the main canvas.

### Why This Works

The offscreen canvas operates at the **pixel layer**, not the data layer. The existing cache keeps producing perfect per-sequence trail shapes. Those shapes get drawn onto the offscreen canvas. The canvas doesn't clear on sequence swap — it just keeps accumulating and decaying pixels. Cross-sequence persistence is automatic.

### The `destination-out` Technique

The naive approach (`ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(...)`) has a well-documented bug: alpha blending is not linear, so trails asymptotically approach but never reach full transparency, leaving permanent ghost artifacts.

The fix: use `globalCompositeOperation = 'destination-out'` to subtract alpha directly.

```typescript
// 1. Fade existing trail content
trailCtx.save();
trailCtx.globalCompositeOperation = 'destination-out';
trailCtx.globalAlpha = fadeAmount;
trailCtx.fillStyle = 'black'; // color irrelevant, only alpha matters
trailCtx.fillRect(0, 0, width, height);
trailCtx.restore();

// 2. Draw current frame's trail output at full opacity
trailCtx.globalCompositeOperation = 'source-over';
trailCtx.globalAlpha = 1.0;
drawCurrentTrailFrame(trailCtx);
```

### Delta-Time Compensated Fade

Fade rate must be frame-rate independent:

```typescript
const baseFadePerFrame = 0.02; // tunable
const fadeAmount = 1 - Math.pow(1 - baseFadePerFrame, deltaTime * 60);
```

This produces consistent fade speed regardless of whether the device runs at 30fps or 120fps.

## Architecture

### Canvas Stack (after change)

```
Container (canvas-wrapper)
├── Main Canvas2D     (grid + props + glyph)    z-index: 0
├── Trail Canvas2D    (persistent fade trails)   z-index: 1
├── Fire WebGL2       (fluid simulation)         z-index: 2
├── Charcoal WebGL2   (spark particles)          z-index: 2
└── LED WebGL2        (glow overlay)             z-index: 3
```

Trails render BEHIND props (z-index 1 vs 0 means trails appear above the grid but the main canvas draws props on top). Actually, since the main canvas has grid + props, and we want trails between grid and props, we need to split: trails draw on their own canvas at z-index 1, with `pointer-events: none`.

### New Component: `TrailOverlayCanvas`

A lightweight service (not a Svelte component) that manages the offscreen trail canvas. Follows the same pattern as `WebGLFireRenderer`.

```typescript
interface ITrailOverlayCanvas {
  initialize(container: HTMLElement, size: number): void;
  resize(width: number, height: number): void;

  // Called each frame by AnimationRenderLoop
  renderFrame(params: {
    trailPoints: { blue: TrailPoint[]; red: TrailPoint[] };
    trailSettings: TrailSettings;
    deltaTime: number;
    canvasSize: number;
  }): void;

  clear(): void;
  dispose(): void;
}
```

### Rendering Pipeline (per frame)

1. **AnimationRenderLoop** gathers trail points from cache (existing logic, unchanged)
2. **AnimationRenderLoop** calls `trailOverlay.renderFrame()` with those points
3. **TrailOverlayCanvas.renderFrame():**
   a. Apply `destination-out` fade to existing canvas content
   b. Draw new trail points (lines/splines) at full opacity
4. **CSS composites** the trail canvas over the main canvas automatically

### What Changes

| Component | Change |
|-----------|--------|
| `AnimationRenderLoop` | After gathering trail points, pass them to TrailOverlayCanvas instead of (or in addition to) the main renderer |
| `Canvas2DAnimationRenderer` | Stop drawing trails on the main canvas (remove trail rendering from `renderScene`) |
| `AnimationEngine` | Create and manage TrailOverlayCanvas lifecycle (init, resize, dispose) |
| `TrailCapturer` | No changes — still captures real-time points for backfill |
| `AnimationPathCache` | No changes — still precomputes paths |
| `SequenceCache` | No changes — clearSignal no longer affects trail visibility |

### What Stays the Same

- All cache precomputation logic
- All trail settings (fade duration, line width, glow, tracking mode, colors)
- All trail point gathering in `gatherTrailPoints()` (cache-based, with wrap-around)
- Fire, charcoal, LED overlays
- TrailCapturer internals (backfill, loop detection, distance sampling)

## Trail Drawing on the Offscreen Canvas

The current trail renderer (`Canvas2DAnimationRenderer.renderTrails()`) draws Catmull-Rom splines with configurable width, color, glow, and opacity. This same drawing logic moves to the `TrailOverlayCanvas` — it's just drawing to a different Canvas2D context.

The key change: instead of clearing the trail region each frame and redrawing all visible trail points, we only draw the NEW trail points (the current frame's contribution). The offscreen canvas accumulates, and the `destination-out` fade handles decay.

### Incremental Drawing

Each frame, the cache provides trail points for the visible window (e.g., the last 3 seconds of animation). Most of these points were already drawn in previous frames. To avoid redrawing the entire trail every frame:

- Track the last drawn step position
- Each frame, only draw trail segments from the last drawn position to the current position
- This is typically just 1-3 new line segments per frame

### On Sequence Swap

Nothing happens. The offscreen canvas keeps its existing content. The cache rebuilds for the new sequence. New trail segments start appearing from the new sequence's positions. Old segments fade via `destination-out`. Continuity is automatic.

## Edge Cases

### Canvas Resize
When the container resizes, the offscreen canvas must resize too. This clears canvas content (browser behavior). Acceptable — trails rebuild quickly from cache on the next few frames. Same behavior as fire/charcoal on resize.

### Trail Mode Changes
When the user changes trail settings (mode, fade duration, colors), clear the offscreen canvas and let it rebuild.

### Source Mode Switch
When switching from infinite/library to pick mode, or vice versa, clear the offscreen canvas for a fresh start.

### Prop Type Change
When prop type changes (staff → fan), clear and rebuild — endpoint positions differ.

## Performance

- **Memory:** One additional Canvas2D at display resolution (~8MB at 1080p)
- **Per-frame cost:** 1 fillRect (destination-out) + ~3 lineTo calls (new segments) + CSS composite
- **GC pressure:** Zero — no allocations per frame
- **Compared to current:** Cheaper than current approach (current redraws ALL visible trail points every frame via Catmull-Rom splines)

## Implementation Order

1. Create `TrailOverlayCanvas` service with init/resize/dispose/renderFrame
2. Wire into `AnimationEngine` lifecycle (alongside fire/LED/charcoal)
3. Move trail drawing from `Canvas2DAnimationRenderer.renderTrails()` to `TrailOverlayCanvas.renderFrame()`
4. Remove trail drawing from main canvas renderer
5. Verify trails look identical in Pick mode (single sequence)
6. Test in Infinite mode — verify cross-sequence persistence
7. Tune fade rate and delta-time compensation
