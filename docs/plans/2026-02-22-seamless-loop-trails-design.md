# Seamless Loop Trail Continuity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a seamlessly loopable sequence loops, trails flow continuously across the loop boundary instead of vanishing.

**Architecture:** The path cache (default trail rendering) clamps trail start to the loop point, causing instant trail loss. Fix: wrap-around reading from the cache so the trail window spans the loop boundary. Three files change; no new files.

**Tech Stack:** TypeScript, Svelte 5, Canvas2D trail rendering, AnimationPathCache

---

## Context: How Trails Work

Two trail rendering paths exist:

1. **Path cache** (default, `usePathCache: true`) — `AnimationRenderLoop.gatherTrailPoints()` reads pre-computed positions from `AnimationPathCache`. Trail window = `[startStep, currentStep]`. On loop, `loopOccurredAtStep` clamps `startStep` and kills the trail.

2. **Real-time capture** (fallback) — `TrailCapturer` captures points with timestamps. Already handles seamless loops correctly (doesn't clear, timestamps keep increasing).

Only the path cache path needs fixing.

### Key files (read these first)

| File | Role |
|------|------|
| `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` | Contains `gatherTrailPoints()` — **the fix goes here** |
| `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts` | `RenderFrameParams` interface — needs `isSeamlesslyLoopable` |
| `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` | `getFrameParams()` at line 1516 — needs to pass `isSeamlesslyLoopable` through |
| `src/lib/features/compose/services/implementations/AnimationPathCache.ts` | `fillTrailPoints()` and `getCacheInfo()` — API you'll call (don't modify) |
| `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | Already passes `isSeamlesslyLoopable` to engine — no changes needed |

---

### Task 1: Add `isSeamlesslyLoopable` to `RenderFrameParams`

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts:81-108`

**Step 1: Add field to the interface**

In `RenderFrameParams` (line 81), add after the `playbackSpeed` field (line 107):

```typescript
  /** Whether sequence loops seamlessly (end position = start position).
   *  When true, trail rendering wraps around the loop boundary instead of resetting. */
  isSeamlesslyLoopable?: boolean;
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors (field is optional)

---

### Task 2: Pass `isSeamlesslyLoopable` through `getFrameParams()`

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts:1516-1582`

**Step 1: Add the field to `getFrameParams()`**

In `getFrameParams()` (line 1516), add before the `return fp;` statement (line 1581):

```typescript
    // Seamless loop flag for trail wrap-around
    fp.isSeamlesslyLoopable = props.isSeamlesslyLoopable;
```

**Step 2: Initialize the field in the reusable `frameParams` object**

Find the `frameParams` initialization (around line 286). It's a `RenderFrameParams` object literal. Add:

```typescript
    isSeamlesslyLoopable: false,
```

**Step 3: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(trails): plumb isSeamlesslyLoopable through to RenderFrameParams"
```

---

### Task 3: Implement wrap-around trail reading in `gatherTrailPoints()`

This is the core change. **Read `AnimationRenderLoop.ts` lines 412-508 carefully before starting.**

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts:412-508`

**Step 1: Pass `isSeamlesslyLoopable` into `gatherTrailPoints()`**

Change the method signature (line 412):

```typescript
  private gatherTrailPoints(
    currentStep: number,
    trailSettings: TrailSettings,
    isSeamlesslyLoopable: boolean
  )
```

Update the call site (line 249):

```typescript
    const trailPoints = this.gatherTrailPoints(currentStep, trailSettings, params.isSeamlesslyLoopable ?? false);
```

**Step 2: Suppress `loopOccurredAtStep` for seamless loops**

In the loop detection block (lines 428-433), change to:

```typescript
    this.loopDetectedThisFrame = false;
    if (this.previousStep - currentStep > LOOP_DETECTION_THRESHOLD) {
      this.loopDetectedThisFrame = true;
      // For non-seamless loops, record where the loop occurred to clamp trail start.
      // For seamless loops, don't clamp — trails wrap around the boundary.
      if (!isSeamlesslyLoopable) {
        this.loopOccurredAtStep = currentStep;
      }
    }
    this.previousStep = currentStep;
```

**Step 3: Implement wrap-around cache reading**

Replace the path cache section (lines 439-493) with:

```typescript
    if (usingCache && this.pathCache) {
      const scaleFactor = this.canvasSize / 950;
      const cacheInfo = this.pathCache.getCacheInfo();

      if (cacheInfo && cacheInfo.totalSteps > 0) {
        const stepDurationMs = cacheInfo.totalDurationMs / cacheInfo.totalSteps;
        const fadeSteps = trailSettings.mode === TrailMode.FADE && trailSettings.fadeDurationMs > 0
          ? trailSettings.fadeDurationMs / stepDurationMs
          : currentStep; // Non-fade: show entire trail from step 0

        const desiredStart = currentStep - fadeSteps;

        // Determine if trail wraps around the loop boundary
        const needsWrapAround = isSeamlesslyLoopable && desiredStart < 0;

        if (needsWrapAround) {
          // SEAMLESS LOOP WRAP-AROUND:
          // Trail window spans the loop boundary, so read from two ranges:
          //   1. Tail of previous loop: [totalSteps + desiredStart, totalSteps]
          //   2. Head of current loop:  [0, currentStep]
          const wrapStartStep = Math.max(0, cacheInfo.totalSteps + desiredStart);

          // Blue prop: tail segment then head segment
          let blueCount = this.pathCache.fillTrailPoints(
            0, 0, wrapStartStep, cacheInfo.totalSteps, scaleFactor,
            this.reusableBlueTrailPoints, 0
          );
          blueCount += this.pathCache.fillTrailPoints(
            0, 1, wrapStartStep, cacheInfo.totalSteps, scaleFactor,
            this.reusableBlueTrailPoints, blueCount
          );
          blueCount += this.pathCache.fillTrailPoints(
            0, 0, 0, currentStep, scaleFactor,
            this.reusableBlueTrailPoints, blueCount
          );
          blueCount += this.pathCache.fillTrailPoints(
            0, 1, 0, currentStep, scaleFactor,
            this.reusableBlueTrailPoints, blueCount
          );
          this.reusableBlueTrailPoints.length = blueCount;

          // Red prop: tail segment then head segment
          let redCount = this.pathCache.fillTrailPoints(
            1, 0, wrapStartStep, cacheInfo.totalSteps, scaleFactor,
            this.reusableRedTrailPoints, 0
          );
          redCount += this.pathCache.fillTrailPoints(
            1, 1, wrapStartStep, cacheInfo.totalSteps, scaleFactor,
            this.reusableRedTrailPoints, redCount
          );
          redCount += this.pathCache.fillTrailPoints(
            1, 0, 0, currentStep, scaleFactor,
            this.reusableRedTrailPoints, redCount
          );
          redCount += this.pathCache.fillTrailPoints(
            1, 1, 0, currentStep, scaleFactor,
            this.reusableRedTrailPoints, redCount
          );
          this.reusableRedTrailPoints.length = redCount;
        } else {
          // NORMAL PATH (non-seamless, or seamless but trail doesn't cross boundary)
          let startStep = Math.max(0, desiredStart);

          // For non-seamless loops, clamp at loop point to prevent stale trail artifacts
          if (this.loopOccurredAtStep !== null) {
            startStep = Math.max(startStep, this.loopOccurredAtStep);
          }

          // Blue prop trails (both left and right endpoints)
          let blueCount = this.pathCache.fillTrailPoints(
            0, 0, startStep, currentStep, scaleFactor,
            this.reusableBlueTrailPoints, 0
          );
          blueCount += this.pathCache.fillTrailPoints(
            0, 1, startStep, currentStep, scaleFactor,
            this.reusableBlueTrailPoints, blueCount
          );
          this.reusableBlueTrailPoints.length = blueCount;

          // Red prop trails (both left and right endpoints)
          let redCount = this.pathCache.fillTrailPoints(
            1, 0, startStep, currentStep, scaleFactor,
            this.reusableRedTrailPoints, 0
          );
          redCount += this.pathCache.fillTrailPoints(
            1, 1, startStep, currentStep, scaleFactor,
            this.reusableRedTrailPoints, redCount
          );
          this.reusableRedTrailPoints.length = redCount;
        }
      }
    } else if (this.TrailCapturer) {
      // Fallback to real-time capture - use zero-allocation fill method
      this.TrailCapturer.fillTrailPointArrays(
        this.reusableBlueTrailPoints,
        this.reusableRedTrailPoints,
        this.reusableAdditionalLayerTrails
      );
    }
```

**Step 4: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts
git commit -m "feat(trails): wrap-around path cache reading for seamless loop continuity"
```

---

### Task 4: Manual verification

**How to test:**

1. Open TKA Scribe in the browser
2. Load or create a sequence where the end position matches the start position (a circular/loopable sequence)
3. Play the sequence with trails enabled in FADE mode
4. Watch the loop boundary — trails should flow continuously without vanishing
5. Also test a non-circular sequence — trails should still clear/clamp at the loop boundary as before

**What to look for:**

- Seamless loop: Trail fades smoothly across the boundary. No flash or disappearance.
- Non-seamless loop: Trail still clamps at loop point (existing behavior preserved).
- Trail mode OFF / LOOP_CLEAR: Both still work as before.
- Long playback (5+ loops): No visual artifacts, no memory growth.

---

## Summary of changes

| File | Change | Lines |
|------|--------|-------|
| `IAnimationRenderLoop.ts` | Add `isSeamlesslyLoopable?: boolean` to `RenderFrameParams` | ~2 lines |
| `AnimationEngine.svelte.ts` | Pass `isSeamlesslyLoopable` in `getFrameParams()` | ~2 lines |
| `AnimationRenderLoop.ts` | Wrap-around cache reading + suppress clamp for seamless loops | ~60 lines net |
