# QR Video Effects Pipeline — Design Spec

**Date:** 2026-05-23
**Status:** Approved

## Goal

Enable all 16 TKA visual effects in the QR video web worker so users on the scan page can pick any effect, trigger a re-render, and get a cached MP4 with production-quality effects matching the main app.

## Architecture

### Current Pipeline

```
Page: resolve shortcode → precompute frames → rasterize SVG assets → transfer to worker
Worker: render scene (grid + props + simplified trails) → encode MP4 → return ArrayBuffer
Page: upload to R2 cache → play video
```

### New Pipeline

```
Page: resolve shortcode → precompute frames → rasterize SVG assets → transfer to worker
Worker: render scene (grid + props) → render effect (real renderer) → encode MP4
Page: upload to R2 cache (effect-specific key) → play video
```

Key changes:
- Simplified trails in `worker-scene-renderer.ts` suppressed when an effect is active
- Real effect renderers (same classes used in the main app) instantiated in the worker
- Cache key includes effect type so each effect gets its own cached MP4
- WebGL effects (fire/led/charcoal) use a secondary OffscreenCanvas with WebGL2 context

## Effect Renderer Categories

| Category | Effects | Rendering Surface | Strategy |
|---|---|---|---|
| **Trails** | trails | Main 2D OffscreenCanvas | Canvas2DTrailRenderer with TrailPoint accumulation |
| **Canvas2D particles** | bloom, bubbles, echo, frost, ink, petals, pulse, silk, smoke, sparkles, water, zap | Main 2D OffscreenCanvas | Stateful renderer class per-frame with tip positions + dt |
| **WebGL overlay** | fire, led, charcoal | Secondary WebGL2 OffscreenCanvas | Refactored renderers accept OffscreenCanvas; composited via `ctx.drawImage()` |

## New Module: `worker-effect-renderer.ts`

Location: `src/lib/shared/qr-video/services/worker-effect-renderer.ts`

### Interface

```typescript
interface WorkerEffectRenderer {
  renderFrame(
    ctx: OffscreenCanvasRenderingContext2D,
    canvasSize: number,
    blue: FramePropState | null,
    red: FramePropState | null,
    blueViewBox: { width: number; height: number },
    redViewBox: { width: number; height: number },
    frameIndex: number,
    dt: number,
    stepIndex: number,
    isStartPosition: boolean,
  ): void;
  dispose(): void;
}
```

### Factory

```typescript
function createWorkerEffectRenderer(
  effectType: EffectType,
  canvasSize: number,
): WorkerEffectRenderer
```

Creates the appropriate renderer with default params from `DEFAULT_EFFECTS_CONFIG` resolved through `canvas2d-translator`.

### Tip Position Computation

Every effect renderer needs prop tip positions. Derived from `FramePropState`:

```
center = getPropCenter(canvasSize, propState)
gridScaleFactor = canvasSize / 950
halfLen = (viewBox.width / 2) * gridScaleFactor
tipA = (center.x + halfLen * cos(staffRotationAngle), center.y + halfLen * sin(staffRotationAngle))
tipB = (center.x - halfLen * cos(staffRotationAngle), center.y - halfLen * sin(staffRotationAngle))
```

4 tip positions total (2 per prop), computed each frame.

### Trails Wrapper

Wraps `Canvas2DTrailRenderer`:
- Accumulates `TrailPoint[]` per frame (timestamp = frameIndex * dt * 1000)
- Calls `renderTrails(ctx, bluePoints, redPoints, settings, currentTime, ...)`
- Uses `DEFAULT_TRAIL_SETTINGS` with mode=FADE, effect=GLOW

### Canvas2D Effect Wrappers

Each of the 12 pure Canvas2D renderers follows the same pattern:
1. Instantiate renderer class (e.g., `new Smoke2DRenderer()`)
2. Resolve default params via translator (e.g., `resolveSmoke2D(DEFAULT_EFFECTS_CONFIG.smoke)`)
3. Each frame: compute tip positions → build renderer-specific tip input → call `renderer.render(ctx, params, tips, dt, scale)`

### WebGL Effect Wrappers

For fire/led/charcoal:
1. Create `new OffscreenCanvas(canvasSize, canvasSize)` for WebGL2
2. Get `webgl2` context
3. Instantiate renderer with the OffscreenCanvas (refactored constructor)
4. Each frame: build frame input → call `renderer.render(input)` → composite: `ctx.drawImage(webglCanvas, 0, 0)`
5. On dispose: delete WebGL resources

## WebGL Renderer Refactoring

### Pattern (same for all three)

**Before:**
```typescript
constructor() {
  this.canvas = document.createElement("canvas");
  // ...
  this.gl = this.canvas.getContext("webgl2", opts);
}
```

**After:**
```typescript
constructor(canvas?: OffscreenCanvas | HTMLCanvasElement) {
  this.canvas = canvas ?? (typeof document !== 'undefined' 
    ? document.createElement("canvas") 
    : new OffscreenCanvas(256, 256));
  // ...
  this.gl = this.canvas.getContext("webgl2", opts);
}
```

Debug download links (fire renderer) guarded with `typeof document !== 'undefined'`.

All shader code, physics, particle systems — zero changes.

## Types Extension

### VideoRenderConfig

```typescript
interface VideoRenderConfig {
  // ... existing fields ...
  effectType?: EffectType;  // default: "trails"
}
```

### Cache Key

```typescript
async function computeHash(seq, propOverride?, effectType?): Promise<string> {
  let input = encodeSequence(seq);
  if (propOverride) input += `|prop=${propOverride}`;
  if (effectType && effectType !== "trails") input += `|effect=${effectType}`;
  return sha256(input);
}
```

Backward compatible: existing cached videos (trails, default prop) keep their original hash.

## Scan Page UI

### Effect Pill Selector

Horizontal scrollable pill row below the prop selector. 17 options:

**Order:** None, Trails (default), Fire, Smoke, Bloom, Sparkles, Zap, Echo, Ink, Water, Bubbles, Petals, Frost, Silk, Pulse, LED, Charcoal

**Behavior:**
- Selecting an effect → compute new hash → HEAD check R2 → re-render if uncached
- During render: show existing video (if any) with loading indicator
- Same async pattern as prop switching

### Display Names

| EffectType | Display |
|---|---|
| none | None |
| trails | Trails |
| fire | Fire |
| smoke | Smoke |
| bloom | Bloom |
| sparkles | Sparkles |
| zap | Zap |
| echo | Echo |
| ink | Ink |
| water | Water |
| bubbles | Bubbles |
| petals | Petals |
| frost | Frost |
| silk | Silk |
| pulse | Pulse |
| led | LED |
| charcoal | Charcoal |

## Worker Frame Loop

```typescript
// Before loop:
const effectRenderer = config.effectType && config.effectType !== "none"
  ? createWorkerEffectRenderer(config.effectType, canvasSize)
  : null;

const dt = 1 / fps;

for (let i = 0; i < totalFrames; i++) {
  const frame = frames[i];

  // Render grid + props (suppress simplified trails when effect active)
  renderScene(ctx, canvasSize, gridImage, bluePropImage, redPropImage,
    frame.blue, frame.red, bluePropViewBox, redPropViewBox,
    overlay,
    effectRenderer ? undefined : renderState  // suppress simplified trails
  );

  // Render real effect
  if (effectRenderer) {
    effectRenderer.renderFrame(
      ctx, canvasSize,
      frame.blue, frame.red,
      bluePropViewBox, redPropViewBox,
      i, dt,
      frame.stepIndex, frame.isStartPosition,
    );
  }

  // encode frame (unchanged)
}

effectRenderer?.dispose();
```

## Effect Scale

All 2D effect renderers use `computeEffectScale(canvasSize, canvasSize)` = `canvasSize / 500` (DEFAULT_CANVAS_SIZE). This keeps effect sizes proportional across different render resolutions.

## Default Parameters

Each effect uses its canonical defaults from `DEFAULT_EFFECTS_CONFIG` (in `src/lib/shared/effects/domain/defaults.ts`), resolved through the `canvas2d-translator`. No user customization of effect params — just pick the type and get the production look.

## Error Handling

If WebGL2 is unavailable in the worker:
- Post a warning message (not an error — the video still renders)
- Fall back to trails for that render
- Cache under the *requested* effect key is NOT populated (prevents serving a wrong-effect video)
