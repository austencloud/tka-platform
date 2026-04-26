# 3D Video Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the 3D scene as video, capturing whatever camera angle the user has set, with live camera interaction during recording.

**Architecture:** Real-time recording using `canvas.captureStream()` on the Three.js WebGL canvas, fed into the existing `BackgroundVideoEncoder` (WebCodecs + mp4-muxer). The 2D frame-by-frame export doesn't work here because (a) Three.js renders via its own rAF loop and (b) the user needs to interact with the camera during recording. Instead, playback runs in real-time at the selected BPM and every frame is captured as it renders. A new `Realtime3DExporter` service handles the capture loop, reusing the existing encoder for MP4 output.

**Tech Stack:** Three.js (via Threlte), WebCodecs VideoEncoder, mp4-muxer, canvas.captureStream()

---

## Architecture Decisions

### Why real-time, not frame-by-frame?

The 2D export pauses playback and manually steps beat-by-beat, calling `calculateStateForBeat()` then waiting 2 rAF cycles for the canvas to update. This works because PixiJS renders synchronously when its state changes.

Three.js/Threlte has its own render loop managed by `useTask()`. Manually stepping beats and trying to force Three.js to render a single frame is fragile and conflicts with Threlte's internal scheduling. More importantly, the user explicitly wants camera orbit during recording — this requires real-time playback.

### Capture strategy

1. Get the WebGL canvas from Threlte via `useThrelte().renderer.domElement`
2. Each frame: call `renderer.domElement.toDataURL('image/png')` — **NO**, too slow
3. Better: use `canvas.captureStream(fps)` → MediaStream → feed frames to encoder

Actually, the most reliable approach for MP4 output with the existing encoder:
- Use `requestAnimationFrame` loop during recording
- Each frame: read pixels from WebGL canvas via a 2D offscreen canvas (`drawImage` from WebGL canvas → `getImageData`)
- Feed `ImageData` to `BackgroundVideoEncoder` (same as 2D path)
- This keeps MP4 output, resolution control, and bitrate management identical to 2D

The key difference from 2D: instead of manually stepping beats, playback runs normally and we capture whatever Three.js rendered that frame.

### WebGL `preserveDrawingBuffer`

By default, WebGL clears the drawing buffer after compositing. To read pixels after render, we need `preserveDrawingBuffer: true` on the WebGL context. Threlte's `<Canvas>` component accepts renderer props.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts` | Real-time frame capture loop, coordinates encoder |
| Create | `src/lib/shared/3d/services/contracts/IRealtime3DExporter.ts` | Interface for the service |
| Create | `src/lib/shared/3d/components/Viewer3DCanvasRef.svelte` | Bridge component to expose WebGL canvas ref |
| Create | `src/lib/features/compose/shared/domain/video-export-calculations.ts` | Shared dimension/bitrate helpers (extracted from VideoExportOrchestrator) |
| Modify | `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Mount bridge + preserveDrawingBuffer |
| Modify | `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | Store WebGL canvas ref, expose to exporter |
| Modify | `src/lib/shared/di/containers/animator-container.ts` | Register Realtime3DExporter |
| Modify | `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | Branch export logic: 2D vs 3D path |
| Modify | `src/lib/shared/sequence-viewer/services/implementations/SequenceModalExporter.svelte.ts` | Add `export3DAnimation()` method + cancel awareness |
| Modify | `src/lib/shared/sequence-viewer/services/contracts/ISequenceModalExporter.ts` | Add 3D export types to interface |
| Modify | `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts` | Use shared dimension/bitrate helpers |

---

## Task 1: Expose WebGL Canvas from Threlte

The Three.js canvas must be accessible for frame capture. Currently it's buried inside Threlte's `<Canvas>` component with no ref exposed.

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Add `webglCanvas` to viewer-3d-state**

In `viewer-3d-state.svelte.ts`, add a reactive field to hold the WebGL canvas reference:

```typescript
let webglCanvas = $state<HTMLCanvasElement | null>(null);

// In the return object:
get webglCanvas() { return webglCanvas; },
setWebglCanvas(canvas: HTMLCanvasElement | null) { webglCanvas = canvas; },
```

- [ ] **Step 2: Create a canvas-ref bridge component**

Threlte's `<Canvas>` doesn't expose a ref prop, but we can access the renderer inside a child component using `useThrelte()`. Create a tiny bridge component:

Create: `src/lib/shared/3d/components/Viewer3DCanvasRef.svelte`

```svelte
<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";

  const { renderer } = useThrelte();
  const viewer3DState = getViewer3DContext();

  onMount(() => {
    const canvas = renderer.domElement;
    if (canvas) {
      viewer3DState.setWebglCanvas(canvas);
    }
    return () => viewer3DState.setWebglCanvas(null);
  });
</script>
```

- [ ] **Step 3: Mount the bridge inside Viewer3DCanvas**

In `Viewer3DCanvas.svelte`, add `Viewer3DCanvasRef` as a child of `<Canvas>`:

```svelte
<Canvas>
  <Viewer3DCanvasRef />
  <Viewer3DCamera />
  <Viewer3DScene ... />
</Canvas>
```

- [ ] **Step 4: Enable preserveDrawingBuffer on the Threlte Canvas**

Threlte's `<Canvas>` passes extra props through to the WebGLRenderer. Add:

```svelte
<Canvas rendererParameters={{ preserveDrawingBuffer: true }}>
```

This ensures we can read pixels from the canvas after Three.js renders a frame.

- [ ] **Step 5: Verify canvas ref is populated**

Add a temporary `$effect` in `Viewer3DCanvas.svelte`:
```typescript
$effect(() => {
  console.log("[3D Export] WebGL canvas ref:", viewer3DState.webglCanvas?.tagName, viewer3DState.webglCanvas?.width);
});
```

Run `npm run build` to verify no type errors. Remove the debug log after verification.

- [ ] **Step 6: Commit**

```
feat(3d): expose WebGL canvas reference for video export
```

---

## Task 2: Create the Realtime3DExporter Service

This service runs a real-time capture loop: playback runs at the user's BPM, and each animation frame is captured from the WebGL canvas and fed to the encoder.

**Files:**
- Create: `src/lib/shared/3d/services/contracts/IRealtime3DExporter.ts`
- Create: `src/lib/shared/3d/services/implementations/Realtime3DExporter.ts`

- [ ] **Step 1: Define the interface**

```typescript
// src/lib/shared/3d/services/contracts/IRealtime3DExporter.ts
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";

export interface Realtime3DExportOptions {
  fps: number;
  resolution: number;        // 720, 1080, 2160, 4320
  loopCount: number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
}

export interface IRealtime3DExporter {
  export3D(
    webglCanvas: HTMLCanvasElement,
    startPlayback: () => void,
    stopPlayback: () => void,
    getTotalDurationSeconds: () => number,
    onProgress: (progress: VideoExportProgress) => void,
    options: Realtime3DExportOptions
  ): Promise<Blob>;

  cancel(): void;
}
```

- [ ] **Step 2: Implement the service**

The core loop:
1. Create offscreen canvas at export resolution
2. Initialize `BackgroundVideoEncoder` with dimensions, fps, bitrate
3. Call `startPlayback()` to begin real-time animation
4. On each `requestAnimationFrame`:
   - Draw WebGL canvas onto offscreen canvas (scaling to export resolution)
   - Extract `ImageData` from offscreen canvas
   - Feed to encoder with calculated timestamp
   - Report progress
5. After `totalDurationSeconds` elapsed, call `stopPlayback()` and finalize

```typescript
// src/lib/shared/3d/services/implementations/Realtime3DExporter.ts
import type { IRealtime3DExporter, Realtime3DExportOptions } from "../contracts/IRealtime3DExporter";
import type { IBackgroundVideoEncoder } from "$lib/features/compose/services/contracts/IBackgroundVideoEncoder";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";

function getExportDimensions(resolution: number, aspectRatio: number): { width: number; height: number } {
  const height = resolution;
  let width = Math.round(height * aspectRatio);
  if (width % 2 !== 0) width++;
  return { width, height };
}

function calculateBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  const base = pixels <= 921600 ? 4_000_000 : pixels <= 2073600 ? 6_000_000 : pixels <= 8294400 ? 20_000_000 : 50_000_000;
  const fpsMultiplier = fps <= 30 ? 1 : fps <= 60 ? 1.33 : 2.5;
  return Math.round(base * fpsMultiplier);
}

export class Realtime3DExporter implements IRealtime3DExporter {
  private shouldCancel = false;
  private animFrameId: number | null = null;

  constructor(private readonly backgroundEncoder: IBackgroundVideoEncoder) {}

  async export3D(
    webglCanvas: HTMLCanvasElement,
    startPlayback: () => void,
    stopPlayback: () => void,
    getTotalDurationSeconds: () => number,
    onProgress: (progress: VideoExportProgress) => void,
    options: Realtime3DExportOptions
  ): Promise<Blob> {
    this.shouldCancel = false;

    const { fps, resolution, loopCount } = options;
    const aspectRatio = webglCanvas.width / webglCanvas.height;
    const { width: outputWidth, height: outputHeight } = getExportDimensions(resolution, aspectRatio);
    const bitrate = calculateBitrate(outputWidth, outputHeight, fps);
    const totalDuration = getTotalDurationSeconds() * loopCount;
    const totalFrames = Math.ceil(totalDuration * fps);
    const frameDurationMicros = Math.round(1_000_000 / fps);
    const keyframeInterval = fps * 2;

    // Create offscreen canvas for scaling
    const offscreen = document.createElement("canvas");
    offscreen.width = outputWidth;
    offscreen.height = outputHeight;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offCtx) throw new Error("Failed to create offscreen canvas");

    // Initialize encoder
    await this.backgroundEncoder.initialize({
      width: outputWidth,
      height: outputHeight,
      fps,
      bitrate,
      totalFrames,
    });

    onProgress({ progress: 0, stage: "capturing" });

    // Start real-time playback
    startPlayback();

    const startTime = performance.now();
    let frameIndex = 0;

    return new Promise<Blob>((resolve, reject) => {
      const captureFrame = () => {
        if (this.shouldCancel) {
          stopPlayback();
          reject(new Error("Export cancelled"));
          return;
        }

        const elapsed = (performance.now() - startTime) / 1000;

        if (elapsed >= totalDuration) {
          // Done capturing
          stopPlayback();
          this.animFrameId = null;

          onProgress({ progress: 0.95, stage: "encoding", totalFrames: frameIndex });

          this.backgroundEncoder.finish()
            .then((blob) => {
              onProgress({ progress: 1, stage: "complete", totalFrames: frameIndex });
              resolve(blob);
            })
            .catch(reject);
          return;
        }

        // Capture at target FPS rate
        const expectedFrame = Math.floor(elapsed * fps);
        if (expectedFrame > frameIndex) {
          // Draw WebGL canvas to offscreen at export resolution
          offCtx.drawImage(webglCanvas, 0, 0, outputWidth, outputHeight);
          const imageData = offCtx.getImageData(0, 0, outputWidth, outputHeight);

          const timestampMicros = frameIndex * frameDurationMicros;
          const isKeyframe = frameIndex % keyframeInterval === 0;

          this.backgroundEncoder.addFrame(imageData, frameIndex, timestampMicros, isKeyframe);
          frameIndex++;

          onProgress({
            progress: elapsed / totalDuration * 0.9,
            stage: "capturing",
            totalFrames: frameIndex,
          });
        }

        this.animFrameId = requestAnimationFrame(captureFrame);
      };

      this.animFrameId = requestAnimationFrame(captureFrame);
    });
  }

  cancel(): void {
    this.shouldCancel = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    // Clean up the encoder worker to prevent leaks
    this.backgroundEncoder.cancel();
  }
}
```

- [ ] **Step 3: Extract shared dimension/bitrate helpers**

Create `src/lib/features/compose/shared/domain/video-export-calculations.ts` with `getExportDimensions()` and `calculateBitrate()` extracted from `VideoExportOrchestrator.ts`. Update `VideoExportOrchestrator.ts` to import from the shared module instead of defining locally. Use the shared helpers in `Realtime3DExporter.ts` too — remove the inline duplicates.

- [ ] **Step 4: Register in DI container**

In `src/lib/shared/di/containers/animator-container.ts`, add:

```typescript
import { Realtime3DExporter } from "$lib/shared/3d/services/implementations/Realtime3DExporter";

// In the container chain, after backgroundVideoEncoder is defined:
.add((ctx) => ({
  realtime3DExporter: () => new Realtime3DExporter(ctx.backgroundVideoEncoder),
}))
```

Add the type to `container-types.ts` as well.

- [ ] **Step 5: Commit**

```
feat(3d): add Realtime3DExporter service for live 3D recording
```

---

## Task 3: Wire 3D Export into SequenceModalExporter

Add a new `export3DAnimation()` method that uses the real-time exporter instead of the frame-by-frame orchestrator.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/contracts/ISequenceModalExporter.ts`
- Modify: `src/lib/shared/sequence-viewer/services/implementations/SequenceModalExporter.svelte.ts`

- [ ] **Step 1: Add 3D export types to the interface**

Add to `ISequenceModalExporter.ts`:

```typescript
export interface Video3DExportDependencies {
  webglCanvas: HTMLCanvasElement;
  startPlayback: () => void;
  stopPlayback: () => void;
  getTotalDurationSeconds: () => number;
}

// Add to ISequenceModalExporter interface:
export3DAnimation(
  options: VideoExportOptions,
  deps: Video3DExportDependencies,
  callbacks: ExportCallbacks
): Promise<void>;
```

- [ ] **Step 2: Implement `export3DAnimation` in SequenceModalExporter**

Similar to `exportAnimation` but delegates to `Realtime3DExporter` instead of `VideoExportOrchestrator`:

```typescript
async export3DAnimation(
  options: VideoExportOptions,
  deps: Video3DExportDependencies,
  callbacks: ExportCallbacks
): Promise<void> {
  const exporter = container.items.realtime3DExporter as IRealtime3DExporter;
  if (!exporter) {
    this._error = "3D export services not ready.";
    return;
  }

  this._isExporting = true;
  this._error = null;
  this._progress = { progress: 0, stage: "capturing" };
  this.revokePreviewUrl();

  try {
    const blob = await exporter.export3D(
      deps.webglCanvas,
      deps.startPlayback,
      deps.stopPlayback,
      deps.getTotalDurationSeconds,
      (progress) => {
        this._progress = progress;
        if (progress.stage === "complete") {
          callbacks.onHaptic("success");
          callbacks.onSuccess("3D video exported!");
        }
      },
      {
        fps: options.fps,
        resolution: options.resolution,
        loopCount: options.loopCount,
        includeStartPosition: options.includeStartPosition ?? true,
        includeEndHold: options.includeEndHold ?? false,
      }
    );

    this._previewBlobUrl = URL.createObjectURL(blob);
  } catch (error) {
    if ((error as Error).message !== "Export cancelled") {
      console.error("[SequenceModalExporter] 3D export failed:", error);
      this._error = "3D export failed. Please try again.";
      callbacks.onError(this._error);
    }
  } finally {
    this._isExporting = false;
    this._progress = null;
  }
}
```

- [ ] **Step 3: Update `cancel()` for 3D awareness**

The current `cancel()` only handles `videoExportOrchestrator`. Add a `_activeRealtime3DExporter` field to track the 3D exporter when active, and cancel it too:

```typescript
private _activeRealtime3DExporter: IRealtime3DExporter | null = null;

cancel(): void {
  this.videoExportOrchestrator?.cancelExport();
  this._activeRealtime3DExporter?.cancel();
  this._activeRealtime3DExporter = null;
  this._isExporting = false;
  this._progress = null;
}
```

Set `this._activeRealtime3DExporter = exporter` at the start of `export3DAnimation()` and clear it in the `finally` block.

- [ ] **Step 4: Commit**

```
feat(3d): add export3DAnimation method to SequenceModalExporter
```

---

## Task 4: Branch Export Logic in the Orchestrator

The `handleExport` function in `SequenceViewerOrchestrator.svelte` currently only handles the 2D path. Add a branch for 3D mode.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Get render mode and WebGL canvas in the orchestrator**

The orchestrator already has access to `viewer3DState` (from context). Use it to detect 3D mode and get the canvas:

```typescript
const is3DMode = viewer3DState?.renderMode === '3d';
const webglCanvas = viewer3DState?.webglCanvas;
```

- [ ] **Step 2: Add 3D branch to handleExport**

Inside `handleExport()`, before the existing 2D animation path:

```typescript
if (exportType === "animation" && is3DMode && webglCanvas && playbackController) {
  const opts = exportOptions.getVideoOptions();
  const secondsPerBeat = 1.0 / modalAnimationState.speed;
  const steps = effectiveSequence?.steps ?? [];
  const totalDurationUnits = steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
  const startDur = opts.includeStartPosition ? 1 : 0;
  const endDur = opts.includeEndHold ? 1 : 0;

  await sequenceModalExporter.export3DAnimation(
    {
      fps: opts.fps,
      loopCount: opts.loopCount,
      resolution: opts.resolution,
      includeStartPosition: opts.includeStartPosition,
      includeEndHold: opts.includeEndHold,
    },
    {
      webglCanvas,
      startPlayback: () => {
        // Reset to beginning and start playing
        playbackController.jumpToStep(0);
        if (!isPlayingLocal) playbackController.togglePlayback();
      },
      stopPlayback: () => {
        if (isPlayingLocal) playbackController.togglePlayback();
      },
      getTotalDurationSeconds: () => {
        return (startDur + totalDurationUnits + endDur) * secondsPerBeat;
      },
    },
    callbacks
  );
  return;
}
```

- [ ] **Step 3: Commit**

```
feat(3d): wire 3D export path into SequenceViewerOrchestrator
```

---

## Task 5: Handle Canvas Ready for 3D Mode

Currently `onCanvasReady` only fires for the 2D `AnimatorCanvas`. When in 3D mode, the export button shows "Loading..." because `canvasReady` is false. We need to signal readiness from the 3D canvas too.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Forward 3D canvas ready state**

In `ViewerSplitPane.svelte`, resolve the 3D context at the top-level script (not inside an `$effect`), then add a reactive effect that signals canvas ready when in 3D mode:

```svelte
<!-- At top of script block -->
const viewer3DState = getViewer3DContext();

<!-- Reactive effect -->
$effect(() => {
  if (renderMode === '3d' && viewer3DState.webglCanvas) {
    onCanvasReady(viewer3DState.webglCanvas);
  }
});
```

- [ ] **Step 2: In the orchestrator, treat 3D canvas as valid for `canvasReady`**

The `canvasReady` derived state should be true when either the 2D canvas OR the 3D canvas is available (depending on render mode).

- [ ] **Step 3: Commit**

```
feat(3d): signal canvas ready for 3D export mode
```

---

## Task 6: End-to-End Testing

**Files:**
- No new test files needed (this is a real-time recording feature that requires visual verification)

- [ ] **Step 1: Build and verify no type errors**

```bash
npm run build
npm run check
```

- [ ] **Step 2: Manual test flow**

1. Open a sequence in the viewer
2. Switch to 3D mode
3. Tap "Download Animation"
4. Verify the export drawer appears with settings
5. Set desired FPS/resolution
6. Tap "Download Animation" button
7. Verify progress bar shows during recording
8. Verify the animation plays in real-time during recording
9. Orbit the camera during recording
10. Verify export completes and preview panel shows
11. Play back the preview — camera movements should be captured
12. Tap "Done" — should return to export drawer (not viewer)

- [ ] **Step 3: Test cancel flow**

1. Start a 3D export
2. Tap "Cancel" during recording
3. Verify playback stops and no blob is created

- [ ] **Step 4: Commit**

```
test(3d): verify 3D video export end-to-end
```

---

## UI Reuse Note

The existing `VideoPreviewPanel.svelte` and `ExportVideoDrawer.svelte` are fully reused for 3D export. No UI changes needed — the same preview, re-download, and done buttons work because the export produces the same blob URL regardless of 2D vs 3D source.

---

## Risk Notes

1. **`preserveDrawingBuffer` performance**: Enabling this can reduce WebGL performance by ~10-15% because the browser can't discard the back buffer. This is acceptable during export but we could toggle it only when recording starts (requires recreating the WebGL context — complex and likely not worth it for the performance difference).

2. **Frame timing**: Real-time capture means frame rate depends on device performance. If the device can't maintain 60fps rendering, the exported video will have fewer frames than expected. The capture loop handles this by checking elapsed time vs expected frame count.

3. **Audio**: No audio track is included (same as 2D export). Future enhancement.

4. **Mobile**: WebGL canvas capture on mobile may be slower. The resolution options (720p, 1080p) give users control to reduce load.
