# Video Export Quality Improvements

Date: 2026-04-26

## Status

Item 1 is implemented and awaiting visual verification. Items 2-5 are specced but not started.

---

## 1. Trail Export Quality Fix (IMPLEMENTED)

**Problem:** Exported 2D animations with trails effect produce extra-thick, pixelated trails that don't match the preview. The export pipeline was compositing all layers at source/preview resolution (~400-600px), then scaling the entire composite to output resolution (1080p) with bilinear interpolation. This 2x upscale caused trails to appear thick, blurry, and pixelated.

**Fix applied in `VideoExportOrchestrator.ts`:**
- Offscreen canvas now renders at output resolution (1080p) directly instead of source resolution
- Each source layer (main canvas, trail overlay, WebGL overlays) is scaled individually to output resolution with Lanczos (`imageSmoothingQuality: "high"`) interpolation
- Eliminated the intermediate resize canvas and the lossy composite-then-resize step
- Header/progress bar heights are scaled by `scaleFactor = outputWidth / sourceWidth` to stay proportional

**Key changes:**
- `srcHeaderHeight` / `srcProgressBarHeight` renamed to clarify they're source-resolution values
- `offscreenCanvas` dimensions set to `outputWidth x outputHeight` (was `sourceWidth x sourceHeight`)
- Removed `resizeCanvas` / `resizeCtx` — no longer needed
- Frame capture reads directly from the output-resolution offscreen canvas

**Trade-off:** Trails are still rasterized at preview resolution by the animation engine, then scaled up. Native export-resolution trail rendering would require deep changes to canvasSize propagation through the animation engine. The current fix significantly improves quality with minimal code surface.

**Verification needed:** Export a 2D animation with trails enabled at 1080p and compare trail thickness/smoothness to the preview.

**File:** `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`

---

## 2. VideoFrame API Integration

**Problem:** The export pipeline uses `getImageData()` to extract pixel data from the offscreen canvas each frame. This is slow — it copies the entire pixel buffer from GPU to CPU.

**Fix:** Wire up the existing `CanvasFrameCapturer` (already in the codebase) to use the `VideoFrame` API instead. `VideoFrame` can reference the canvas directly without a pixel copy, yielding ~70% reduction in per-frame JS time.

**Files:**
- `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts` — swap `getImageData` for `VideoFrame` in the frame capture block (~line 675)
- Find and integrate `CanvasFrameCapturer` (grep for it in the compose services)

**Approach:**
```typescript
const frame = new VideoFrame(offscreenCanvas, { timestamp: timestampMicros });
encoder.encode(frame, { keyFrame: isKeyframe });
frame.close();
```

---

## 3. mp4-muxer to Mediabunny Migration

**Problem:** The `mp4-muxer` package used for video encoding is deprecated. Its successor is `mediabunny`.

**Scope:**
- Replace `mp4-muxer` dependency with `mediabunny` in `package.json`
- Update import paths and API calls in the video export pipeline
- Verify the muxer configuration (bitrate, codec, container format) maps correctly

**Files to check:**
- `package.json` — dependency swap
- Grep for `mp4-muxer` across the codebase for all import sites
- Background encoder worker (if it imports mp4-muxer directly)

---

## 4. Moving Dot on Export Progress Bar

**Problem:** The export progress bar rendered into the video is a simple segmented bar. The user wants a moving dot indicator that tracks playback position, similar to how timeline scrubbers work.

**Implementation:**
- Add a filled circle that moves along the top edge of the progress bar
- Position: `x = progressBarX + (currentProgress * progressBarWidth)`, `y = progressBarY`
- Size: proportional to `canvasSize` (e.g., `canvasSize * 0.012` radius)
- Color: match the progress fill color or use white with slight shadow for visibility

**File:** `src/lib/features/compose/services/implementations/CanvasRenderer.ts` — `drawProgressBar()` method (lines ~414-507) and `renderProgressBarToCanvas()`

**Design notes:**
- The dot sits at the boundary between filled and unfilled segments
- Should be visually prominent but not distracting
- Consider a subtle drop shadow or outline so it's visible against both filled and unfilled backgrounds

---

## 5. Improved Export Progress Bar Tick Marks

**Problem:** The export progress bar's segment dividers are basic. The pill-shaped preview progress bar (`SegmentedSequenceProgressBar.svelte`) has cleaner divider styling that should be adapted for the export bar.

**Implementation:**
- Replace the current segment dividers with thinner, more refined lines
- Match the divider style from `SegmentedSequenceProgressBar.svelte` (the `renderDividers` logic)
- Dividers should be subtle — thin lines with slight transparency, not thick opaque borders

**File:** `src/lib/features/compose/services/implementations/CanvasRenderer.ts` — segment divider rendering within `drawProgressBar()`

**Reference:** `src/lib/shared/animation-engine/components/layers/SegmentedSequenceProgressBar.svelte` — look at divider width, color, and opacity values

---

## Pre-existing Build Issue

The production build (`npm run build`) fails with an unrelated error in `WorkerRenderPool.ts` — Rollup can't resolve `__sveltekit/environment` inside a web worker import. This error reproduces on clean main and is not caused by any of the changes above.
