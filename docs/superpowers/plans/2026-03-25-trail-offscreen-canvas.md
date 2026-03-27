# Trail Offscreen Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move trail rendering to a dedicated offscreen Canvas2D with `destination-out` fade, enabling trail persistence across sequence boundaries.

**Architecture:** Trails move from the main Canvas2D to their own overlay canvas (same pattern as fire/charcoal/LED). Each frame, existing content fades via `destination-out` composite operation, then new trail segments are drawn. The existing path cache continues to produce trail points — only the rendering destination changes.

**Tech Stack:** Canvas2D, `globalCompositeOperation: 'destination-out'`, CSS absolute positioning

**Spec:** `docs/superpowers/specs/2026-03-25-trail-offscreen-canvas-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/animation-engine/services/implementations/TrailOverlayCanvas.ts` | Create | Offscreen canvas lifecycle + per-frame fade + trail drawing |
| `src/lib/shared/animation-engine/services/contracts/ITrailOverlayCanvas.ts` | Create | Interface for the overlay |
| `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` | Modify | Pass trail points to overlay instead of main renderer |
| `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts` | Modify | Add `trailOverlay` to `RenderLoopConfig` |
| `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` | Modify | Create/resize/dispose overlay, wire to render loop |
| `src/lib/features/compose/services/implementations/Canvas2DAnimationRenderer.ts` | Modify | Remove trail drawing from `renderScene` |

---

### Task 1: Create the TrailOverlayCanvas service

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/ITrailOverlayCanvas.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/TrailOverlayCanvas.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/animation-engine/services/contracts/ITrailOverlayCanvas.ts
import type { TrailPoint, TrailSettings } from "../../domain/types/TrailTypes";

export interface TrailOverlayRenderParams {
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  trailSettings: TrailSettings;
  deltaTime: number;
  canvasSize: number;
  hasBlue: boolean;
  hasRed: boolean;
  additionalLayers?: Array<{
    blueTrailPoints: TrailPoint[];
    redTrailPoints: TrailPoint[];
    blueColor?: string;
    redColor?: string;
    hasBlue: boolean;
    hasRed: boolean;
  }>;
}

export interface ITrailOverlayCanvas {
  initialize(container: HTMLElement, width: number, height: number): void;
  resize(width: number, height: number): void;
  renderFrame(params: TrailOverlayRenderParams): void;
  clear(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/shared/animation-engine/services/implementations/TrailOverlayCanvas.ts
import type { ITrailOverlayCanvas, TrailOverlayRenderParams } from "../contracts/ITrailOverlayCanvas";
import { Canvas2DTrailRenderer } from "$lib/features/compose/services/implementations/canvas2d/Canvas2DTrailRenderer";

export class TrailOverlayCanvas implements ITrailOverlayCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private trailRenderer = new Canvas2DTrailRenderer();
  private lastFrameTime: number = 0;
  private baseFadePerFrame = 0.015;

  initialize(container: HTMLElement, width: number, height: number): void {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    Object.assign(this.canvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "1",
      background: "transparent",
    });
    this.canvas.setAttribute("aria-hidden", "true");
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    this.lastFrameTime = performance.now();
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    // Canvas resize clears content — trails rebuild from cache next frames
  }

  renderFrame(params: TrailOverlayRenderParams): void {
    if (!this.ctx || !this.canvas) return;
    const { trailSettings, deltaTime, canvasSize } = params;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Fade existing content via destination-out
    // Delta-time compensated so fade speed is frame-rate independent
    const fadeAmount = 1 - Math.pow(
      1 - this.baseFadePerFrame,
      deltaTime * 60
    );

    // Derive fade rate from trail settings fade duration
    // Longer fade duration = slower fade = smaller fadeAmount
    if (trailSettings.fadeDurationMs > 0) {
      // At 60fps, we want full fade over fadeDurationMs
      // So per-frame fade = 1 / (fadeDurationMs / 16.67) = 16.67 / fadeDurationMs
      const framesForFullFade = trailSettings.fadeDurationMs / 16.67;
      const baseFade = 1.5 / framesForFullFade; // 1.5x for perceptual tuning
      const compensatedFade = 1 - Math.pow(1 - baseFade, deltaTime * 60);

      this.ctx.save();
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.globalAlpha = compensatedFade;
      this.ctx.fillStyle = "black";
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();
    }

    // 2. Draw current trail frame at full opacity
    this.ctx.save();
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.globalAlpha = 1.0;

    const currentTime = performance.now();
    this.trailRenderer.renderTrails(
      this.ctx,
      params.blueTrailPoints,
      params.redTrailPoints,
      trailSettings,
      currentTime,
      params.hasBlue,
      params.hasRed,
      canvasSize,
      undefined, // qualityHints
      params.additionalLayers?.map((layer) => ({
        blueProp: null,
        redProp: null,
        blueTrailPoints: layer.blueTrailPoints,
        redTrailPoints: layer.redTrailPoints,
        blueColor: layer.blueColor,
        redColor: layer.redColor,
        hasBlue: layer.hasBlue,
        hasRed: layer.hasRed,
      }))
    );

    this.ctx.restore();
  }

  clear(): void {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setVisible(visible: boolean): void {
    if (this.canvas) {
      this.canvas.style.display = visible ? "" : "none";
    }
  }

  dispose(): void {
    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/ITrailOverlayCanvas.ts src/lib/shared/animation-engine/services/implementations/TrailOverlayCanvas.ts
git commit -m "feat(trails): add TrailOverlayCanvas service with destination-out fade"
```

---

### Task 2: Wire TrailOverlayCanvas into AnimationEngine lifecycle

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

- [ ] **Step 1: Add `trailOverlay` to RenderLoopConfig**

In `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts`, add to `RenderLoopConfig` interface (after `ledTipTracker`):

```typescript
/** Trail overlay canvas for persistent cross-sequence trails */
trailOverlay?: ITrailOverlayCanvas | null;
```

Add import at top:
```typescript
import type { ITrailOverlayCanvas } from "./ITrailOverlayCanvas";
```

- [ ] **Step 2: Store trailOverlay in AnimationRenderLoop**

In `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`:

Add private field (after `private ledTipTracker`):
```typescript
private trailOverlay: ITrailOverlayCanvas | null = null;
```

In `initialize()` method (~line 97), add:
```typescript
this.trailOverlay = config.trailOverlay ?? null;
```

In `updateConfig()` method (~line 118), add before the closing brace:
```typescript
if (config.trailOverlay !== undefined)
  this.trailOverlay = config.trailOverlay ?? null;
```

In `dispose()` method, add alongside other disposals:
```typescript
this.trailOverlay = null;
```

Add import at top:
```typescript
import type { ITrailOverlayCanvas } from "../contracts/ITrailOverlayCanvas";
```

- [ ] **Step 3: Create and wire overlay in AnimationEngine**

In `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`:

Add import:
```typescript
import { TrailOverlayCanvas } from "./TrailOverlayCanvas";
import type { ITrailOverlayCanvas } from "../contracts/ITrailOverlayCanvas";
```

Add private field (near other renderer fields ~line 220):
```typescript
private trailOverlay: ITrailOverlayCanvas | null = null;
```

In `initializeRenderLoopService()` method (~line 1390), after creating the render loop and before the closing brace, add:
```typescript
// Create trail overlay canvas for persistent cross-sequence trails
this.trailOverlay = new TrailOverlayCanvas();
this.trailOverlay.initialize(this.containerElement!, this.canvasSize, this.canvasSize);
this.renderLoopService.updateConfig({ trailOverlay: this.trailOverlay });
```

In the canvas resize handler (search for `this.canvasSize = newSize` ~line 1717), add after existing resize calls:
```typescript
this.trailOverlay?.resize(newSize, newSize);
```

In `dispose()` method (~line 1187), add alongside other disposals:
```typescript
this.trailOverlay?.dispose();
this.trailOverlay = null;
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(trails): wire TrailOverlayCanvas into engine lifecycle"
```

---

### Task 3: Route trail rendering through the overlay

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`
- Modify: `src/lib/features/compose/services/implementations/Canvas2DAnimationRenderer.ts`

- [ ] **Step 1: Send trail points to overlay in the render method**

In `AnimationRenderLoop.ts`, in the `render()` method, after the `gatherTrailPoints` call (~line 308) and before `renderScene` (~line 355), add:

```typescript
// Route trail rendering through the overlay canvas (persistent across sequences)
if (this.trailOverlay && effectiveTrailsVisible) {
  const now = performance.now();
  const dt = this.lastTrailFrameTime > 0
    ? (now - this.lastTrailFrameTime) / 1000
    : 1 / 60;
  this.lastTrailFrameTime = now;

  this.trailOverlay.renderFrame({
    blueTrailPoints: effectiveBlueMotionVisible ? trailPoints.blue : [],
    redTrailPoints: effectiveRedMotionVisible ? trailPoints.red : [],
    trailSettings,
    deltaTime: dt,
    canvasSize: this.canvasSize,
    hasBlue: !!params.props.blueProp && effectiveBlueMotionVisible,
    hasRed: !!params.props.redProp && effectiveRedMotionVisible,
  });
}
```

Add private field for delta-time tracking:
```typescript
private lastTrailFrameTime: number = 0;
```

Note: `effectiveTrailsVisible`, `effectiveBlueMotionVisible`, `effectiveRedMotionVisible` are already defined earlier in the `render()` method. Check the exact variable names at ~lines 316-320.

- [ ] **Step 2: Verify variable names**

Read the render method around lines 315-325 to confirm the exact names of the visibility booleans. They may be named differently (e.g., `effectiveGridVisible` is at ~line 316). Search for how `trailPoints.blue` and `trailPoints.red` are conditionally passed to `renderScene` at lines 364-371 — use the same condition guards.

- [ ] **Step 3: Remove trail drawing from the main Canvas2D renderer**

In `src/lib/features/compose/services/implementations/Canvas2DAnimationRenderer.ts`, find the `renderScene` method where `this.trailRenderer.renderTrails()` is called (~line 290). Wrap it with a condition so it only renders trails when there's no overlay handling them:

Find the block around lines 287-303:
```typescript
if (trailsFadeState.alpha > 0) {
  ctx.save();
  ctx.globalAlpha = trailsFadeState.alpha;
  this.trailRenderer.renderTrails(
    ctx,
    params.blueTrailPoints,
    params.redTrailPoints,
    ...
  );
  ctx.restore();
}
```

Add a `skipTrailRendering` flag to the `renderScene` params interface and check it:

In the `RenderSceneParams` interface (or wherever `renderScene` params are defined), add:
```typescript
/** When true, trails are rendered by the overlay canvas, not here */
skipTrailRendering?: boolean;
```

Then wrap the trail rendering block:
```typescript
if (trailsFadeState.alpha > 0 && !params.skipTrailRendering) {
  // ... existing trail rendering code
}
```

In `AnimationRenderLoop.ts`, when calling `renderScene`, pass `skipTrailRendering: !!this.trailOverlay`:
Find the `renderScene` call (~line 355) and add to the params object:
```typescript
skipTrailRendering: !!this.trailOverlay,
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts src/lib/features/compose/services/implementations/Canvas2DAnimationRenderer.ts
git commit -m "feat(trails): route trail rendering through overlay canvas"
```

---

### Task 4: Verify single-sequence trails look identical

This is a manual verification step — the trail overlay should produce visually identical results to the previous direct-canvas rendering.

- [ ] **Step 1: Build and verify no errors**

Run: `npm run check`
Expected: No new errors (only pre-existing SectionIndexSidebar errors)

- [ ] **Step 2: Test in Pick mode (single sequence)**

1. Open Effects Lab → Trails mode
2. Set source to Pick, load any sequence
3. Verify trails render correctly (smooth, fading, correct endpoints)
4. Compare visually with how trails looked before the change

If trails look different (wrong position, wrong fade, too thick/thin), the TrailOverlayCanvas rendering needs adjustment. Common issues:
- Canvas size mismatch: ensure `canvasSize` matches the actual rendering coordinate system
- Double-drawing: ensure `skipTrailRendering` is working (trails should NOT appear on main canvas)
- Fade too fast/slow: adjust `baseFadePerFrame` or the fadeDuration-to-fadeAmount math

- [ ] **Step 3: Test in Infinite mode (chaining)**

1. Switch source to Infinite
2. Watch trails across sequence boundaries
3. Verify trails persist and fade smoothly across swaps (the whole point)
4. Verify no trail clearing, no snap, no artifacts at boundaries

- [ ] **Step 4: Commit if all good**

```bash
git commit --allow-empty -m "test(trails): verified single-sequence and cross-sequence trail rendering"
```

---

### Task 5: Handle edge cases

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/TrailOverlayCanvas.ts`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

- [ ] **Step 1: Clear overlay on trail mode/settings change**

In `AnimationEngine.svelte.ts`, find where trail settings changes are detected (search for `updateSettings` or `trailSettings` changes). When trail mode changes or trails are disabled, call:

```typescript
this.trailOverlay?.clear();
```

- [ ] **Step 2: Clear overlay on prop type change**

In the prop type change handler (search for where `clearTrails` is called after prop type change, ~lines 756-778), also clear the overlay:

```typescript
this.trailOverlay?.clear();
```

- [ ] **Step 3: Hide overlay when trails are disabled**

In the visibility sync for trails (search for `setTrailStyle` or trail visibility), call:

```typescript
this.trailOverlay?.setVisible(trailsEnabled);
```

- [ ] **Step 4: Verify it compiles and test**

Run: `npx tsc --noEmit --project tsconfig.json`

Test:
- Toggle trail mode on/off → overlay clears and hides
- Change prop type → overlay clears and rebuilds
- Switch source mode → trails persist (no unnecessary clear)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/TrailOverlayCanvas.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(trails): handle edge cases for trail overlay lifecycle"
```

---

### Task 6: Remove diagnostic logging

**Files:**
- Modify: `src/lib/features/compose/services/implementations/TrailCapturer.ts` (if diagnostic logs were left from earlier debugging)

- [ ] **Step 1: Remove any remaining console.warn/console.log diagnostic messages**

Search for `[TrailCapturer]` in the codebase and remove any diagnostic logging that was added during debugging.

- [ ] **Step 2: Verify and commit**

Run: `npm run check`

```bash
git add -A
git commit -m "chore: remove trail debugging diagnostics"
```
