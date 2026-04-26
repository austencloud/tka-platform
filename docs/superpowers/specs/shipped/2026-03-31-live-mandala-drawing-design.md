# Live Mandala Drawing

**Date:** 2026-03-31
**Status:** Draft

## Problem

The mandala rendering system pre-computes the complete paths both hands trace during a sequence, then renders them as static SVG on choreo card backs. There is no way to watch the mandala being drawn in real time during animation playback. The user wants a screensaver-like effect: lines drawn incrementally as the animation plays, persisting on screen, with the oldest lines eventually fading after the first complete loop.

## Vision

A persistent canvas overlay draws mandala lines in sync with the animation. Each frame, the current prop tip positions are projected into mandala coordinate space and a line segment is added from the previous position. Lines accumulate like ink on paper. After the first complete loop, the "tail" (oldest drawn pixels) begins fading while the "head" continues drawing. This creates a head-chasing-tail effect where the full mandala pattern is always partially visible but constantly refreshing.

Before the first loop completes: pure accumulation, no fade. The full pattern builds up from nothing.

## Architecture

### New Files

| File | Role |
|------|------|
| `src/lib/shared/mandala/services/contracts/IMandalaOverlayCanvas.ts` | Interface for the live mandala overlay |
| `src/lib/shared/mandala/services/implementations/MandalaOverlayCanvas.ts` | Canvas2D persistent overlay, follows TrailOverlayCanvas pattern |
| `src/lib/shared/mandala/services/implementations/MandalaFrameProjector.ts` | Per-frame adapter: projects prop tip positions into mandala coordinate space |
| `src/lib/shared/mandala/services/contracts/IMandalaFrameProjector.ts` | Interface for the frame projector |
| `src/lib/shared/mandala/domain/mandala-overlay-types.ts` | Types for overlay config and state |

### Modified Files

| File | Change |
|------|--------|
| `AnimationRenderLoop.ts` | Add `mandalaOverlay` slot alongside existing `trailOverlay`, `fireRenderer`, `ledRenderer` |
| `IAnimationRenderLoop.ts` | Add `IMandalaOverlayCanvas` to `RenderLoopConfig` and `mandalaConfig` to `RenderFrameParams` |
| `AnimationEngine.svelte.ts` | Add `syncMandalaOverlay()` method following the `syncFireOverlay()` pattern |
| `AnimatorCanvas.svelte` | Pass `mandalaConfig` prop through to engine |
| `mandala-constants.ts` | Add overlay-specific constants (fade rate, line width, glow) |
| `mandala-types.ts` | Add `MandalaOverlayConfig` type |
| DI container | Register `MandalaFrameProjector` |

## Rendering Pipeline

### Per-Frame Flow

```
AnimationRenderLoop.render(params, currentTime)
  │
  ├── 1. Read prop tip positions from PropState (same as TrailOverlayCanvas)
  │      - blueProp.staffRotationAngle, center position
  │      - redProp.staffRotationAngle, center position
  │
  ├── 2. MandalaFrameProjector.project(blueProp, redProp, canvasSize)
  │      - Converts screen-space prop positions to mandala coordinate space
  │      - Returns { blueLeft, blueRight, redLeft, redRight } as MandalaPoint
  │      - Uses same math as MandalaGeometryCalculator.computeTipPosition()
  │        but operates on live PropState instead of pre-computed StepLike data
  │
  ├── 3. MandalaOverlayCanvas.renderFrame(projectedPoints, config, deltaTime)
  │      - Appends line segments from previous frame's positions to current
  │      - If firstLoopComplete: apply destination-out fade to existing pixels
  │      - If !firstLoopComplete: pure accumulation, no fade
  │      - Draw new segments to offscreen buffer, composite onto overlay
  │
  └── 4. AnimationRenderer.renderScene() (props, grid, etc. on top)
```

### Coordinate Space Projection

The existing `MandalaGeometryCalculator` works in mandala coordinate space (center at origin, `MANDALA_GRID_RADIUS = 80`). The animation engine works in canvas pixel space (center at `canvasSize/2`, grid radius at `ENGINE_GRID_RADIUS = 150` scaled by `canvasSize/950`).

`MandalaFrameProjector` bridges these two spaces:

1. Read prop center and staff angle from `PropState` (canvas pixel space)
2. Reverse the canvas-to-screen transform: subtract canvas center, divide by grid scale factor
3. Apply the same tip offset rotation as `computeTipPosition()` in mandala space
4. Scale from mandala coordinates to overlay canvas pixels using the same `scale = center / (maxExtent * 1.05)` factor from `MandalaRenderer`

This reuses the exact math from `MandalaGeometryCalculator` lines 266-286 (`computeTipPosition`) and `MandalaRenderer` lines 65-68 (scale calculation), ensuring the live drawing matches the static mandala exactly.

### Why a Separate Projector Instead of Adapting MandalaGeometryCalculator

`MandalaGeometryCalculator` is batch-oriented: it takes an entire sequence of `StepLike` objects and produces complete SVG path strings. The live overlay needs single-frame point projection from `PropState`. Rather than bolting frame-by-frame mode onto the batch calculator (which would complicate its clean single-responsibility), a dedicated `MandalaFrameProjector` extracts the shared math (tip offset rotation, coordinate transforms) into a focused service that operates on live prop state.

The shared math (angle normalization, tip offsets, coordinate scaling) comes from the same source functions, so the two always produce identical geometry.

## Loop Detection and Fade Behavior

### Phase 1: Accumulation (Before First Loop)

- `firstLoopComplete = false`
- Every frame adds line segments
- No fade applied
- The full mandala builds up from the first beat to the last

### Phase 2: Head-Chasing-Tail (After First Loop)

- `firstLoopComplete = true` (set when `AnimationRenderLoop.loopDetectedThisFrame` fires)
- Continue drawing new segments at the head
- Apply `destination-out` fade to the full canvas each frame (same technique as `TrailOverlayCanvas`)
- Fade rate is tuned so the full pattern remains visible but the oldest portion is noticeably dimmer
- The visual effect: the drawing "cursor" leads, and a fade front follows ~70-80% of a loop behind

### Fade Math

Following `TrailOverlayCanvas.computeFadeAmount()`:

```typescript
// fadeDurationMs controls how long pixels take to fully disappear
// For mandala: want ~1 full loop duration before a pixel fully fades
// So fadeDurationMs = loopDurationMs (sequence length * beat duration)
const fadeAmount = computeFadeAmount(fadeDurationMs, deltaTime);

ctx.globalCompositeOperation = "destination-out";
ctx.globalAlpha = fadeAmount;
ctx.fillRect(0, 0, width, height);
```

Plus the same `smoothAlphaDecay()` pixel-level cleanup to prevent stuck ghost pixels from 8-bit rounding.

### Loop Duration Calculation

The overlay needs to know the total loop duration to tune fade rate. This comes from the sequence length (number of beats) multiplied by the beat duration (derived from BPM/playback speed). `AnimationEngine` already has access to both via the orchestrator's playback state.

## MandalaOverlayCanvas Implementation

### Pattern: TrailOverlayCanvas Clone with Mandala-Specific Logic

The overlay follows the exact same structural pattern as `TrailOverlayCanvas`:

```typescript
export class MandalaOverlayCanvas implements IMandalaOverlayCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private bufferCanvas: OffscreenCanvas | null = null;
  private bufferCtx: OffscreenCanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;

  // Previous frame positions for line segment drawing
  private prevBlueLeft: MandalaPoint | null = null;
  private prevBlueRight: MandalaPoint | null = null;
  private prevRedLeft: MandalaPoint | null = null;
  private prevRedRight: MandalaPoint | null = null;

  // Loop tracking
  private firstLoopComplete = false;
  private warmupFramesRemaining = 3;

  initialize(container: HTMLElement, width: number, height: number): void { ... }
  resize(width: number, height: number): void { ... }
  renderFrame(params: MandalaOverlayRenderParams): void { ... }
  clear(): void { ... }
  setVisible(visible: boolean): void { ... }
  dispose(): void { ... }
  onLoopDetected(): void { ... }
}
```

### Canvas Setup

```typescript
canvas.style.position = "absolute";
canvas.style.top = "0";
canvas.style.left = "0";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.pointerEvents = "none";
canvas.style.zIndex = "0";  // Behind props (z-index 1 is trails)
canvas.style.background = "transparent";
```

### Line Drawing Strategy

Each frame draws a line segment from the previous tip position to the current one. Four line segments per frame (blue left, blue right, red left, red right), each in its hand color.

```typescript
// In renderFrame(), after projection:
if (this.prevBlueLeft && currentBlueLeft) {
  bufferCtx.strokeStyle = BLUE_STROKE;  // "#818cf8"
  bufferCtx.lineWidth = strokeWidth;
  bufferCtx.lineCap = "round";
  bufferCtx.beginPath();
  bufferCtx.moveTo(this.prevBlueLeft.x, this.prevBlueLeft.y);
  bufferCtx.lineTo(currentBlueLeft.x, currentBlueLeft.y);
  bufferCtx.stroke();
}
```

The offscreen buffer is composited onto the main overlay canvas each frame (`source-over`), same as `TrailOverlayCanvas` does to prevent polygon-edge seam accumulation.

### Discontinuity Detection

Same approach as `TrailOverlayCanvas.appendToRing()`: if the distance between consecutive frames exceeds a threshold (e.g., 30% of canvas size), skip the segment. This prevents artifact lines when:
- Animation resets/seeks
- Sequence changes
- Props teleport between beats with large positional jumps (dash motions)

For dash motions specifically: the mandala geometry calculator handles dashes via Cartesian lerp (straight line through center). The live overlay should produce the same result since it captures every frame. At 60fps with typical beat durations (500ms+), even a full-diameter dash produces frames close enough together that the line segments approximate the straight path naturally.

### Glow Effect

Apply a subtle glow filter matching the static mandala's SVG glow:

```typescript
// Before drawing segments to buffer:
bufferCtx.shadowColor = strokeColor;
bufferCtx.shadowBlur = 6;  // Matches <feGaussianBlur stdDeviation="3"/>
```

This is cheaper than a post-process blur and matches the static mandala's visual character.

## Integration with AnimationRenderLoop

### RenderLoopConfig Addition

```typescript
export interface RenderLoopConfig {
  // ... existing fields
  mandalaOverlay?: IMandalaOverlayCanvas | null;
}
```

### RenderFrameParams Addition

```typescript
export interface RenderFrameParams {
  // ... existing fields
  mandalaConfig?: MandalaOverlayConfig | null;
}
```

### Render Order in AnimationRenderLoop.render()

```
1. Trail overlay canvas (z-index 1) — existing
2. Mandala overlay canvas (z-index 0) — NEW, behind trails
3. Canvas2D scene render (props, grid, glyphs)
4. Fire/charcoal overlays (z-index 2+) — existing
5. LED overlay (z-index 3+) — existing
```

The mandala draws behind props so the animated figures are always visible on top of the pattern. This matches the intuition of "drawing on paper while the props move above."

### Loop Detection Wiring

`AnimationRenderLoop` already has `loopDetectedThisFrame` (line 59). When this flag is true, call `mandalaOverlay.onLoopDetected()` to transition from accumulation to fade mode.

```typescript
// In AnimationRenderLoop.render(), after existing loop detection:
if (this.loopDetectedThisFrame && this.mandalaOverlay) {
  this.mandalaOverlay.onLoopDetected();
}
```

### Idle Auto-Stop

The mandala overlay counts as active work for the idle auto-stop check (line 296-302), same as fire and LED:

```typescript
const mandalaActive =
  params.mandalaConfig?.enabled === true &&
  this.mandalaOverlay !== null;

const hasActiveWork =
  this.needsRender || isPlaying || backgroundTransitioning ||
  fireActive || charcoalActive || ledActive || mandalaActive;
```

## AnimationEngine Integration

### syncMandalaOverlay()

Follows the exact pattern of `syncFireOverlay()` and `syncCharcoalOverlay()`:

```typescript
private mandalaOverlay: IMandalaOverlayCanvas | null = null;
private mandalaProjector: IMandalaFrameProjector | null = null;

private syncMandalaOverlay(): void {
  const enabled = this.mandalaConfig.enabled;

  if (enabled) {
    if (!this.mandalaOverlay) {
      if (!this.containerElement) return;
      this.mandalaProjector = new MandalaFrameProjector();
      this.mandalaOverlay = new MandalaOverlayCanvas();
      this.mandalaOverlay.initialize(
        this.containerElement,
        this.canvasSize,
        this.canvasSize
      );
      this.renderLoopService?.updateConfig({
        mandalaOverlay: this.mandalaOverlay,
      });
    }
  } else {
    if (this.mandalaOverlay) {
      this.mandalaOverlay.dispose();
      this.mandalaOverlay = null;
      this.mandalaProjector = null;
    }
    this.renderLoopService?.updateConfig({ mandalaOverlay: null });
  }
}
```

### Config Source

`MandalaOverlayConfig` is stored in animation settings state alongside fire/LED configs:

```typescript
export interface MandalaOverlayConfig {
  enabled: boolean;
  fadeDurationMs: number;  // How long before fully faded (default: loop duration)
  strokeWidth: number;     // Line thickness (default: 2.5, matching static mandala)
  style: "stroke" | "filled";  // Match static mandala style options
  show: "blue" | "red" | "both";
  showGridDots: boolean;
  opacity: number;         // Global opacity of the overlay (0-1, default: 0.9)
  hideProps: boolean;       // Option to hide prop rendering for pure mandala view
}
```

## Settings and Controls

### Animation Settings Modal

Add a "Mandala" section to the existing animation settings modal (the same modal that controls fire, LED, trails):

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable | Toggle | Off | Master on/off |
| Show Hands | Segmented: Both / Blue / Red | Both | Which hand paths to draw |
| Style | Segmented: Stroke / Filled | Stroke | Line style |
| Line Width | Slider: 1-5 | 2.5 | Stroke width in mandala space |
| Fade Duration | Slider: 0.5x-3x loop | 1x | How quickly the tail fades (multiplier of loop duration) |
| Grid Dots | Toggle | Off | Show cardinal/intercardinal reference dots |
| Hide Props | Toggle | Off | Hide prop SVGs for a clean mandala-only view |

### Persistence

Settings persist to the same `animation-settings` key in local storage / Firebase, following the existing pattern for fire and LED configs.

### Context Menu

Add "Mandala Drawing" as a toggle in the canvas right-click context menu, alongside the existing "Fire Effect", "LED Effect", and "Charcoal Sparks" entries.

## Performance Considerations

### CPU Cost Per Frame

The mandala overlay's per-frame cost is minimal compared to existing effects:

| Operation | Cost | Notes |
|-----------|------|-------|
| Tip projection (4 tips) | ~0.01ms | 4x (cos, sin, multiply, add) |
| Line segment drawing (4 lines) | ~0.05ms | Simple Canvas2D stroke calls |
| Destination-out fade | ~0.1ms | Single fillRect with composite op |
| smoothAlphaDecay | ~0.5ms | getImageData pixel scan (same as TrailOverlayCanvas) |
| Buffer composite | ~0.05ms | drawImage from offscreen canvas |

Total: ~0.7ms/frame, dominated by `smoothAlphaDecay`. This is well within budget, especially since `TrailOverlayCanvas` already pays the same `smoothAlphaDecay` cost and the two can share the cleanup pass if both are active.

### Memory

One additional `HTMLCanvasElement` + one `OffscreenCanvas`, both at `canvasSize x canvasSize`. At 950x950 with RGBA, that is ~3.4MB per canvas, ~6.8MB total. Comparable to the trail overlay's memory footprint.

### Mobile

The mandala overlay should respect the `DeviceTierDetector` quality tier. On low-tier devices:
- Reduce glow blur (or disable it)
- Skip `smoothAlphaDecay` (accept minor ghost pixels)
- Consider disabling entirely if frame budget is already tight

### Mutual Exclusivity

The mandala overlay can coexist with fire/LED/trails since it draws on its own canvas at a different z-index. No mutual exclusivity constraints needed. The mandala draws behind everything; effects draw on top.

## Z-Order Summary

```
z-index 0: Mandala overlay canvas (NEW)
z-index 1: Trail overlay canvas (existing)
z-index 2: Canvas2D scene (props, grid, glyphs) (existing)
z-index 3: Fire/charcoal WebGL overlay (existing)
z-index 4: LED WebGL overlay (existing)
```

The mandala is the bottommost overlay. Props and trails render on top of it. Fire and LED render on top of everything. This layering means the mandala pattern serves as a background to the animation, like drawing on paper while the props dance above.

## Edge Cases

### Sequence Change Mid-Draw

When the sequence changes, call `mandalaOverlay.clear()` to wipe the canvas and reset `firstLoopComplete = false`. The new sequence's mandala begins accumulating from scratch. This follows the same pattern as `trailOverlay.clearBuffers()` on sequence change.

### Pause/Resume

When paused: no new frames, no fade. The mandala freezes in its current state. On resume: drawing continues from where it left off. The previous positions are still valid since the prop state hasn't changed.

### Seek/Scrub

When the user scrubs the timeline, prop positions jump discontinuously. The discontinuity detection (distance threshold) prevents artifact lines. After a seek, the overlay resumes drawing from the new position. The already-drawn pattern remains on screen and continues fading normally.

### No Sequence Loaded

If no sequence is loaded, the mandala overlay does nothing. `MandalaFrameProjector.project()` returns null when props are null, and `renderFrame()` skips drawing.

### Non-LOOP Sequences

The mandala works for any sequence, not just LOOPs. For non-looping sequences, the pattern won't close on itself, which is fine. The fade behavior still activates after the animation's first loop-around (which the `AnimationRenderLoop` detects regardless of LOOP type).

## Implementation Order

1. **MandalaFrameProjector** — the coordinate space bridge (pure math, easy to test)
2. **MandalaOverlayCanvas** — the persistent drawing canvas (follows TrailOverlayCanvas pattern closely)
3. **AnimationRenderLoop integration** — add the mandala slot to the render pipeline
4. **AnimationEngine integration** — add syncMandalaOverlay() and config wiring
5. **Settings UI** — add controls to animation settings modal and context menu
6. **Persistence** — wire config to animation settings state and local storage
