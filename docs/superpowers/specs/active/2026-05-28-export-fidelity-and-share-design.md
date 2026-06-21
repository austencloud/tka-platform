# Export Fidelity & Mobile Share Sheet

**Date:** 2026-05-28  
**Status:** Draft  
**Scope:** Two improvements to the animation export pipeline

---

## Problem Statement

### 1. Trail effects degrade in exported videos (CRITICAL)

Trails render beautifully during live 2D canvas playback — smooth Catmull-Rom splines with tapered width and glow effects via Canvas2D `shadowBlur`. In exported MP4s, they appear blocky and low-resolution.

**Root cause:** The `TrailOverlayCanvas` renders at viewport resolution (e.g., 500px on mobile). During export, `ExportFrameCompositor.renderCanvasLayers()` captures this overlay and upscales it to output resolution (720p/1080p/4K). Canvas `shadowBlur` glow effects are rasterized at source resolution — upscaling produces blocky artifacts that don't exist in the live preview.

The main `Canvas2DAnimationRenderer` skips trail rendering when the overlay exists (`skipTrailRendering: !!this.trailOverlay`), so trails are exclusively on the separate overlay canvas.

**Affected paths:** Both the sequence viewer export (QR scan page) and the compose module export use `VideoExportOrchestrator`, which captures from the live canvas.

### 2. No native share sheet on mobile

`downloadBlob()` in `file-downloader.ts` creates an anchor element to trigger a browser download. On mobile, this saves directly to the device with no option to share via messaging, social media, or cloud storage.

Static image export already uses `navigator.share()` via `Sharer.shareViaDevice()`. Video export does not.

---

## Design

### Feature 1: Native-Resolution Trail Rendering During Export

**Approach:** Before the export capture loop, resize the animation canvas and ALL overlay canvases to the output resolution via the existing `CanvasResizer` reactive pipeline. After export, restore viewport size.

#### How it works

1. `VideoExportOrchestrator.executeExport()` already computes `outputCanvasSize`. Before the capture loop begins, it triggers a resize of ALL canvases to output dimensions.

2. **Resize mechanism — CanvasResizer override:** The `AnimationEngine` already has a reactive resize pipeline at lines 1490-1498. It reads `canvasResizerService.state.currentSize` each tick and propagates to:
   - `this.canvasSize` (internal state)
   - `trailCapturer.updateConfig({ canvasSize })` (sampling distances)
   - `renderLoopService.updateConfig({ canvasSize })` (render dimensions)
   - `effectRendererManager.resizeAll(newSize)` (ALL overlays: trail, fire, charcoal, LED, zap, sparkle, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse)

   The orchestrator needs to trigger this pipeline. `AnimationEngine` is component-scoped (created in `AnimatorCanvas.svelte:268`) with no singleton getter. The `AnimationPlaybackController` holds `SequenceAnimationOrchestrator`, not `AnimationEngine`. So neither dependency the orchestrator receives can reach the resize mechanism directly.

   **Solution: Callback options.** `VideoExportOrchestratorOptions` already supports `onCleanup?: () => void`. Add two optional callbacks following the same pattern:

   ```typescript
   onResizeForExport?: (size: number) => void;
   onRestoreFromExport?: () => void;
   ```

   The call sites (`ExportCoordinator.svelte.ts`, `AnimationSheetCoordinator.svelte`, `ExportOrchestrator.ts`) have access to the `AnimationEngine` instance via their component scope. They wire these callbacks to `engine.resizeForExport(size)` / `engine.restoreFromExport()`.

   `AnimationEngine` gains two new methods that bypass `CanvasResizer` (which reads from the DOM) and directly set `canvasSize` + call `effectRendererManager.resizeAll()` + resize the main canvas renderer.

3. After resize, all overlay accumulators are at output resolution. Trail glow effects (`shadowBlur`) render natively at 1080px instead of being rasterized at 500px and upscaled. The `sizeScale` factor in `Canvas2DTrailRenderer.calculateLineWidth()` automatically adjusts `lineWidth` and `shadowBlur` proportionally via `sizeScale = canvasSize / DEFAULT_CANVAS_SIZE`.

4. **Trail warmup:** `TrailOverlayCanvas.resize()` clears internal buffers (accumulators, ring buffers). The first 3-5 export frames build up trail accumulation from scratch at the new resolution. `TrailOverlayCanvas.WARMUP_FRAMES = 3` already handles this. This matches the existing fire warmup pattern (`WARMUP_FRAMES = 60` for fluid simulation) but is much faster because trails accumulate immediately from prop tip positions.

5. `ExportFrameCompositor.renderCanvasLayers()` (line 237-272) already uses `canvas.parentElement` to discover overlay canvases and draws them with `drawImage(overlay, 0, 0, overlay.width, overlay.height, 0, canvasY, outputCanvasSize, outputCanvasSize)`. When overlay `width`/`height` equal `outputCanvasSize`, the draw is a 1:1 copy — no upscaling. The composited result has pixel-perfect trail fidelity.

6. After export completes (in the `finally` block), restore original viewport size via `restoreFromExport()`. The resize clears and rebuilds all overlays at viewport resolution. Normal playback resumes.

#### Key implementation details

- Only the canvas `width`/`height` attributes change, not the CSS dimensions. The element stays the same visual size on screen. During export, the canvas renders at high resolution into the same visual rectangle — the user sees a progress overlay anyway.
- The `drawImage` scaling in `ExportFrameCompositor` naturally handles the case where source equals output (1:1 blit, no interpolation artifacts).
- The call chain: `VideoExportOrchestrator` calls `options.onResizeForExport?.(outputCanvasSize)` → call site's closure calls `engine.resizeForExport(size)` → `AnimationEngine` sets `canvasSize`, pauses `CanvasResizer`, calls `effectRendererManager.resizeAll()`, resizes main renderer. After export: `options.onRestoreFromExport?.()` → `engine.restoreFromExport()` → resumes `CanvasResizer`, which reads the container's current size and propagates.

#### Files modified

| File | Change |
|------|--------|
| `video-export-types.ts` | Add `onResizeForExport?` and `onRestoreFromExport?` to `VideoExportOrchestratorOptions` |
| `VideoExportOrchestrator.ts` | Call `options.onResizeForExport?.(outputCanvasSize)` before capture loop, `options.onRestoreFromExport?.()` in finally block |
| `AnimationEngine.svelte.ts` | Add `resizeForExport(size)` / `restoreFromExport()` methods |
| `ExportCoordinator.svelte.ts` | Wire callbacks: `onResizeForExport: (s) => engine.resizeForExport(s)` |
| `ExportOrchestrator.ts` | Wire callbacks from animation dependencies |
| `AnimationSheetCoordinator.svelte` | Wire callbacks (compose module export path) |

### Feature 2: Mobile Share Sheet for Video Export

**Approach:** Modify `downloadBlob()` to detect mobile + Web Share API file support. Use `navigator.share()` when available, fall back to anchor download.

#### How it works

1. After the video blob is produced, `downloadBlob()` checks:
   - Does `navigator.share` exist?
   - Does `navigator.canShare` exist?
   - Can we share a File with this MIME type? (`navigator.canShare({ files: [file] })`)

2. If all checks pass, create a `File` object from the blob and call `navigator.share({ files: [file] })`. This opens the native share sheet where the user can save, send, or upload.

3. If any check fails (desktop browser, older mobile browser), fall back to the existing anchor download pattern.

4. The share call may throw if the user dismisses the share sheet — catch `AbortError` silently (user-initiated cancellation, not an error).

#### Files modified

| File | Change |
|------|--------|
| `file-downloader.ts` | Update `downloadBlob()` to try `navigator.share()` first on capable devices |

---

## What's NOT in scope

- GIF export (dropped — MP4 via share sheet covers the social media use case)
- Changes to the 3D export pipeline (`Offline3DExporter`) — that pipeline renders natively at output resolution already
- Changes to the `VideoPreRenderer` (secondary export path) — it uses a standalone Canvas2DAnimationRenderer without the overlay system; trail fidelity there is a separate issue addressed by the TODO at line 376

---

## Success criteria

1. Export a sequence with trails enabled at 1080p. Compare a frame from the export against a screenshot of the live preview at the same step. Trail glow, width, and smoothness should be visually indistinguishable.
2. Export a video on a mobile device. The native share sheet appears instead of a direct download.
3. Export still works on desktop (falls back to download).
4. No visual regression in the live canvas after export completes (size restores correctly).
