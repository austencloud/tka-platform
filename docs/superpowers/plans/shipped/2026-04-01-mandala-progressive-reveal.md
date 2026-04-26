# Mandala Progressive Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frame-by-frame line-segment mandala drawing with pre-computed smooth bezier paths progressively revealed in sync with animation playback, matching the static card-back mandala's visual quality.

**Architecture:** Use the existing `MandalaGeometryCalculator` to pre-compute full SVG path data when a sequence loads. Convert to `Path2D` objects and measure total path length. Each frame, use `setLineDash`/`lineDashOffset` to reveal exactly the portion corresponding to animation progress. Accumulate on a persistent canvas with destination-out fade after the first loop.

**Tech Stack:** Canvas 2D `Path2D`, `setLineDash`/`lineDashOffset`, `SVGPathElement.getTotalLength()`, existing `MandalaGeometryCalculator`, `MandalaRenderer` scale math.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `mandala/domain/mandala-overlay-types.ts` | Modify | Update `MandalaOverlayRenderParams` to carry animation progress + sequence identity instead of projected points |
| `mandala/services/implementations/MandalaPathPreparer.ts` | **Create** | Pre-computes Path2D objects + path lengths from sequence data. Caches per sequence hash. |
| `mandala/services/contracts/IMandalaPathPreparer.ts` | **Create** | Interface |
| `mandala/services/implementations/MandalaOverlayCanvas.ts` | **Rewrite** | Progressive reveal via dash offset instead of point-to-point line segments |
| `mandala/services/implementations/MandalaFrameProjector.ts` | **Delete** | No longer needed — paths are pre-computed, not projected live |
| `mandala/services/contracts/IMandalaFrameProjector.ts` | **Delete** | No longer needed |
| `animation-engine/services/implementations/AnimationRenderLoop.ts` | Modify | Pass animation progress + sequence hash instead of projected tip positions |
| `animation-engine/services/implementations/AnimationEngine.svelte.ts` | Modify | Create/cache MandalaPathPreparer, pass prepared paths to render loop |
| `animation-engine/services/contracts/IAnimationRenderLoop.ts` | Modify | Update RenderLoopConfig to carry path preparer instead of projector |

## Key Concepts

### Progressive Reveal via setLineDash

Canvas 2D's `setLineDash([length, gap])` + `lineDashOffset` can reveal a precise portion of any path:

```typescript
// Reveal first 40% of a path
const revealLength = totalLength * 0.4;
ctx.setLineDash([revealLength, totalLength]); // draw revealLength, then gap of totalLength (hides rest)
ctx.lineDashOffset = 0; // start from the beginning
ctx.stroke(path2d);
```

This is GPU-accelerated and produces perfectly smooth curves — the EXACT same curves as the static mandala SVG.

### Path Length Measurement

`Path2D` doesn't expose `getTotalLength()`. We create a temporary `SVGPathElement`, set its `d` attribute, and call `getTotalLength()`:

```typescript
const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
tempPath.setAttribute("d", svgPathData);
const totalLength = tempPath.getTotalLength();
```

### Animation Progress

Progress through the mandala = `(currentStep + fractionalProgress) / totalSteps`.

The `fractionalProgress` within a step isn't directly available in `RenderFrameParams`, but we can approximate it from wall-clock time between step changes. For the first version, integer step progress (`currentStep / totalSteps`) is sufficient — at 64+ samples per beat, the dash offset increment per step produces smooth reveal.

### Mandala Coordinate Space → Canvas Pixels

The pre-computed paths are in mandala coordinate space (center at origin, grid radius = 80). To draw on the overlay canvas, apply the same transform as `MandalaRenderer.renderSVG()`:

```typescript
ctx.translate(canvasCenter, canvasCenter);
ctx.scale(scale, scale);  // scale = canvasCenter / (maxExtent * 1.05)
```

Then `ctx.stroke(path2d)` draws in mandala coordinates, automatically mapped to canvas pixels.

### Accumulation + Fade

**Phase 1 (first loop):** Each frame, draw the FULL revealed portion of all paths. No fade. The mandala builds up as the animation plays.

**Phase 2 (after first loop):** Continue drawing the full revealed portion each frame (this keeps the "head" bright). Apply destination-out fade to the canvas (this fades the "tail"). The head stays bright because it's redrawn every frame; the tail fades because it's only old pixels.

For the head-chasing-tail effect after the first loop, we draw in two passes:
1. Apply destination-out fade to the entire canvas (dims everything)
2. Draw the "recent" portion (last ~20% of the loop) at full opacity — this overwrites the faded pixels in that region, keeping the head bright

---

## Tasks

### Task 1: Create MandalaPathPreparer

**Files:**
- Create: `src/lib/shared/mandala/services/contracts/IMandalaPathPreparer.ts`
- Create: `src/lib/shared/mandala/services/implementations/MandalaPathPreparer.ts`

This service pre-computes everything the overlay needs from sequence data: Path2D objects, path lengths, and the scale transform.

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/mandala/services/contracts/IMandalaPathPreparer.ts

export interface PreparedMandalaPath {
  path2d: Path2D;
  totalLength: number;
  color: string; // BLUE_STROKE or RED_STROKE
}

export interface PreparedMandalaPaths {
  paths: PreparedMandalaPath[];
  /** Transform scale: canvasCenter / (maxExtent * 1.05) */
  scale: number;
  /** Total steps in the sequence (for progress calculation) */
  totalSteps: number;
  /** Hash to detect sequence changes */
  sequenceHash: string;
}

export interface IMandalaPathPreparer {
  prepare(
    sequenceSteps: unknown[], // StepLike[]
    canvasSize: number,
    show: "blue" | "red" | "both",
  ): PreparedMandalaPaths | null;
}
```

- [ ] **Step 2: Implement MandalaPathPreparer**

```typescript
// src/lib/shared/mandala/services/implementations/MandalaPathPreparer.ts

// 1. Call MandalaGeometryCalculator.calculate(steps) to get MandalaPaths
// 2. For each SVGPathData in paths.blue and paths.red:
//    a. Create Path2D from the d string
//    b. Measure length via temporary SVGPathElement
//    c. Assign color (BLUE_STROKE or RED_STROKE)
// 3. Compute scale = (canvasSize/2) / (maxExtent * 1.05)
//    Using same constants as MandalaRenderer
// 4. Return PreparedMandalaPaths

// Cache: store last result keyed by sequence hash. Only recompute on change.
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i mandala`
Expected: No errors

- [ ] **Step 4: Commit**

```
feat(mandala): add MandalaPathPreparer for pre-computed progressive reveal paths
```

---

### Task 2: Update overlay types

**Files:**
- Modify: `src/lib/shared/mandala/domain/mandala-overlay-types.ts`

Replace the point-based render params with progress-based params.

- [ ] **Step 1: Update MandalaOverlayRenderParams**

Remove `points: MandalaFramePoints | null` and `hasBlue`/`hasRed`.
Add `preparedPaths: PreparedMandalaPaths | null`, `progress: number` (0.0 to 1.0).

```typescript
export interface MandalaOverlayRenderParams {
  preparedPaths: PreparedMandalaPaths | null;
  /** Animation progress through the sequence: 0.0 = start, 1.0 = end of loop */
  progress: number;
  config: MandalaOverlayConfig;
  deltaTime: number;
  canvasSize: number;
  currentStep: number;
}
```

Remove `MandalaFramePoints` type (no longer used).

- [ ] **Step 2: Verify it compiles** (expect errors in overlay canvas and render loop — those are fixed in later tasks)

- [ ] **Step 3: Commit**

```
refactor(mandala): update overlay types for progress-based rendering
```

---

### Task 3: Rewrite MandalaOverlayCanvas for progressive reveal

**Files:**
- Modify: `src/lib/shared/mandala/services/implementations/MandalaOverlayCanvas.ts`

Replace the point-to-point line segment drawing with Path2D progressive reveal.

- [ ] **Step 1: Rewrite renderFrame()**

Core rendering logic per frame:

```typescript
renderFrame(params: MandalaOverlayRenderParams): void {
  if (!ctx || !params.preparedPaths || !params.config.enabled) return;

  // Warmup + step-change detection (keep existing logic)

  // Phase 2: fade old content (keep existing ramp logic)
  if (this.firstLoopComplete) {
    // ... existing destination-out fade with ramp ...
  }

  // Draw pre-computed paths up to current progress
  const { paths, scale } = params.preparedPaths;
  const progress = params.progress;

  const bCtx = this.bufferCtx;
  if (!bCtx) return;

  // Clear buffer
  bCtx.save();
  bCtx.setTransform(1, 0, 0, 1, 0, 0);
  bCtx.clearRect(0, 0, this.width * this.dpr, this.height * this.dpr);
  bCtx.restore();

  // Apply mandala coordinate transform
  bCtx.save();
  const center = this.width / 2;
  bCtx.translate(center, center);
  bCtx.scale(scale, scale);

  for (const { path2d, totalLength, color } of paths) {
    const revealLength = totalLength * progress;

    bCtx.strokeStyle = color;
    bCtx.lineWidth = params.config.strokeWidth / scale; // Compensate for scale transform
    bCtx.lineCap = "round";
    bCtx.globalAlpha = 0.85;
    bCtx.setLineDash([revealLength, totalLength]);
    bCtx.lineDashOffset = 0;
    bCtx.stroke(path2d);
  }

  bCtx.restore();

  // Composite buffer onto main canvas
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
  ctx.drawImage(this.bufferCanvas!, 0, 0, this.width, this.height);
  ctx.restore();
}
```

- [ ] **Step 2: Remove all point-tracking state**

Delete: `prevBlueLeft`, `prevBlueRight`, `prevRedLeft`, `prevRedRight`, `resetPrevPositions()`, `hasDiscontinuity()`, `drawSegment()`.

Keep: `firstLoopComplete`, `fadeRampProgress`, `lastStep`, `warmupFramesRemaining`, fade logic, `smoothAlphaDecay()`.

- [ ] **Step 3: Verify it compiles**

- [ ] **Step 4: Commit**

```
feat(mandala): rewrite overlay for pre-computed path progressive reveal
```

---

### Task 4: Wire into AnimationRenderLoop

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

Replace the projection-based mandala block with progress-based rendering.

- [ ] **Step 1: Update RenderLoopConfig**

Remove `mandalaProjector` field. Add `mandalaPathPreparer` field.

```typescript
import type { IMandalaPathPreparer } from "$lib/shared/mandala/services/contracts/IMandalaPathPreparer";

// In RenderLoopConfig:
mandalaPathPreparer?: IMandalaPathPreparer | null;
```

- [ ] **Step 2: Add sequenceStepCount to RenderFrameParams**

```typescript
/** Total number of steps in the current sequence (for mandala progress) */
sequenceStepCount?: number;
```

- [ ] **Step 3: Rewrite the mandala block in render()**

Replace the projection + tip-position code with:

```typescript
if (this.mandalaOverlay && params.mandalaConfig?.enabled) {
  const now = performance.now();
  const mdt = this.lastMandalaFrameTime > 0
    ? (now - this.lastMandalaFrameTime) / 1000
    : 1 / 60;
  this.lastMandalaFrameTime = now;

  // Compute animation progress (0.0 to 1.0)
  const totalSteps = params.sequenceStepCount ?? 1;
  const progress = Math.min(1.0, params.currentStep / totalSteps);

  this.mandalaOverlay.renderFrame({
    preparedPaths: this.currentPreparedPaths, // cached from path preparer
    progress,
    config: params.mandalaConfig,
    deltaTime: mdt,
    canvasSize: this.canvasSize,
    currentStep: params.currentStep,
  });

  if (this.loopDetectedThisFrame) {
    this.mandalaOverlay.onLoopDetected();
  }
}
```

- [ ] **Step 4: Add path preparation caching**

When `sequenceContentHash` changes, re-prepare the paths:

```typescript
private currentPreparedPaths: PreparedMandalaPaths | null = null;
private lastMandalaSequenceHash: string | undefined;

// In render(), before the mandala block:
if (params.mandalaConfig?.enabled && this.mandalaPathPreparer) {
  const hash = params.sequenceContentHash;
  if (hash !== this.lastMandalaSequenceHash) {
    // Sequence changed — re-prepare paths
    this.currentPreparedPaths = this.mandalaPathPreparer.prepare(
      /* steps from params */, this.canvasSize, params.mandalaConfig.show
    );
    this.lastMandalaSequenceHash = hash;
    this.mandalaOverlay?.clear();
  }
}
```

Note: Getting the sequence steps into RenderFrameParams requires threading them from the AnimationEngine. Add `sequenceSteps?: unknown[]` to RenderFrameParams, populated in `getFrameParams()` from `this.prevSequenceData.steps`.

- [ ] **Step 5: Remove old projection imports and fields**

Delete: `mandalaProjector` field, `IMandalaFrameProjector` import, projection code block.

- [ ] **Step 6: Verify it compiles**

- [ ] **Step 7: Commit**

```
refactor(mandala): wire progress-based rendering into AnimationRenderLoop
```

---

### Task 5: Wire into AnimationEngine

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Replace MandalaFrameProjector with MandalaPathPreparer**

In imports: replace `MandalaFrameProjector` import with `MandalaPathPreparer`.
In fields: replace `mandalaProjector` with `mandalaPathPreparer`.
In `syncMandalaOverlay()`: create `MandalaPathPreparer` instead of `MandalaFrameProjector`.
In `updateConfig` calls: pass `mandalaPathPreparer` instead of `mandalaProjector`.

- [ ] **Step 2: Pass sequence step count and steps in getFrameParams()**

```typescript
fp.sequenceStepCount = this.prevSequenceData?.steps?.length ?? 0;
fp.sequenceSteps = this.prevSequenceData?.steps;
```

- [ ] **Step 3: Verify it compiles**

- [ ] **Step 4: Commit**

```
refactor(mandala): wire MandalaPathPreparer into AnimationEngine
```

---

### Task 6: Delete old projection files

**Files:**
- Delete: `src/lib/shared/mandala/services/contracts/IMandalaFrameProjector.ts`
- Delete: `src/lib/shared/mandala/services/implementations/MandalaFrameProjector.ts`

- [ ] **Step 1: Delete the files**

- [ ] **Step 2: Remove any remaining imports**

Search for `IMandalaFrameProjector` and `MandalaFrameProjector` across the codebase and remove dead imports.

- [ ] **Step 3: Verify full build passes**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: Commit**

```
chore(mandala): remove frame projector (replaced by path preparer)
```

---

### Task 7: Visual polish — head-chasing-tail after first loop

**Files:**
- Modify: `src/lib/shared/mandala/services/implementations/MandalaOverlayCanvas.ts`

After the first loop, instead of drawing the FULL revealed path each frame (which overwrites the fade entirely), draw only the "recent" portion at full brightness.

- [ ] **Step 1: Implement two-pass rendering after first loop**

```typescript
if (this.firstLoopComplete) {
  // Pass 1: Draw full path at low opacity (the ghost/trail)
  // This is the accumulated content being faded by destination-out

  // Pass 2: Draw only the "head" segment (last ~15% of loop) at full opacity
  const headStart = Math.max(0, progress - 0.15);
  // Use two lineDash calls: one that clips to [headStart, progress]
  // Draw from headStart to progress:
  const headLength = (progress - headStart) * totalLength;
  const headOffset = headStart * totalLength;
  ctx.setLineDash([headLength, totalLength]);
  ctx.lineDashOffset = -headOffset; // negative to shift the dash forward
  ctx.globalAlpha = 1.0;
  ctx.stroke(path2d);
} else {
  // First loop: draw full reveal at full opacity
  ctx.setLineDash([revealLength, totalLength]);
  ctx.lineDashOffset = 0;
  ctx.globalAlpha = 0.85;
  ctx.stroke(path2d);
}
```

- [ ] **Step 2: Test visually**

The mandala should:
- First loop: build up smoothly with crisp curves
- After first loop: the head (current drawing position) stays bright, the tail fades gradually

- [ ] **Step 3: Commit**

```
feat(mandala): head-chasing-tail rendering after first loop
```

---

### Task 8: Clean up old constants and unused code

**Files:**
- Modify: `src/lib/shared/mandala/domain/mandala-constants.ts`

- [ ] **Step 1: Remove unused overlay constants**

Remove: `OVERLAY_DISCONTINUITY_THRESHOLD`, `OVERLAY_MIN_MOVEMENT`, `OVERLAY_WARMUP_FRAMES` (no longer needed — progressive reveal doesn't have discontinuity issues).

Keep: `OVERLAY_ALPHA_DECAY` (still used by smoothAlphaDecay), `OVERLAY_STROKE_WIDTH`.

- [ ] **Step 2: Verify build passes**

- [ ] **Step 3: Commit**

```
chore(mandala): clean up unused constants from frame-by-frame approach
```
