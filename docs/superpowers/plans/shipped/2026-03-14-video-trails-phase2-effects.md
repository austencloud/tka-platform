# Video Trails Phase 2: Full Effects Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire existing TKA effect renderers (fire, LED, charcoal, trails) into the Video Trails workspace so detected endpoints drive real visual effects on the video.

**Architecture:** Create an EffectCanvasStack component that manages a layered canvas container (video + trail + fire + LED + detection overlay). WorkspaceView instantiates renderers on-demand based on effect toggles and calls them each frame after detection. An EffectConfigMapper service bridges the simple Video Trails EffectConfig to the full renderer configs (FireOverlayConfig, LedOverlayConfig, TrailSettings).

**Tech Stack:** WebGL2 (fire/LED/charcoal), Canvas2D (trails), Svelte 5 runes

**Design Spec:** `docs/superpowers/specs/2026-03-14-video-trails-design.md` (lines 274-341, 815-843)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/features/lab/tabs/video-trails/components/EffectCanvasStack.svelte` | Create | Layered canvas container: video, trail, fire/LED (renderer-managed), detection overlay |
| `src/lib/features/lab/tabs/video-trails/services/contracts/IEffectConfigMapper.ts` | Create | Interface for mapping simple EffectConfig to renderer-native configs |
| `src/lib/features/lab/tabs/video-trails/services/implementations/EffectConfigMapper.ts` | Create | Maps FireEffectConfig→FireOverlayConfig, LedEffectConfig→LedOverlayConfig, TrailEffectConfig→TrailSettings |
| `src/lib/features/lab/tabs/video-trails/views/WorkspaceView.svelte` | Rewrite | Replace DetectionPreview with EffectCanvasStack, add renderer lifecycle, update processFrame |
| `src/lib/shared/di/containers/video-trails-container.ts` | Modify | Add effectConfigMapper registration |
| `src/lib/shared/di/container-types.ts` | No change needed | VideoTrailsItems already covers the container |

---

## Chunk 1: EffectConfigMapper + EffectCanvasStack + WorkspaceView Rewrite

### Task 1: EffectConfigMapper (contract + implementation)

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/services/contracts/IEffectConfigMapper.ts`
- Create: `src/lib/features/lab/tabs/video-trails/services/implementations/EffectConfigMapper.ts`
- Modify: `src/lib/shared/di/containers/video-trails-container.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/features/lab/tabs/video-trails/services/contracts/IEffectConfigMapper.ts

import type { EffectConfig } from "../../domain/types";
import type { FireOverlayConfig } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/TrailTypes";

export interface IEffectConfigMapper {
  toFireConfig(effect: EffectConfig["fire"]): FireOverlayConfig;
  toLedConfig(effect: EffectConfig["led"]): LedOverlayConfig;
  toTrailSettings(effect: EffectConfig["trails"]): TrailSettings;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/features/lab/tabs/video-trails/services/implementations/EffectConfigMapper.ts

import type { IEffectConfigMapper } from "../contracts/IEffectConfigMapper";
import type { EffectConfig } from "../../domain/types";
import type { FireOverlayConfig } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import { TrailMode, TrailEffect, type TrailSettings } from "$lib/shared/animation-engine/domain/types/TrailTypes";

export class EffectConfigMapper implements IEffectConfigMapper {
  toFireConfig(effect: EffectConfig["fire"]): FireOverlayConfig {
    return {
      enabled: effect.enabled,
      intensity: effect.intensity,
      flameHeight: effect.flameHeight,
      velocityReactive: true,
      quality: 3,
      colorBlend: effect.colorBlend,
    };
  }

  toLedConfig(effect: EffectConfig["led"]): LedOverlayConfig {
    return {
      enabled: effect.enabled,
      glowRadius: effect.glowRadius,
      bloomIntensity: effect.bloom,
      trailFadeRate: 0.92,
      patternId: effect.patternId,
      patternSpeed: 1.0,
      primaryColor: effect.color,
      brightness: effect.brightness,
      colorMode: "unified",
      blueHandColor: effect.color,
      redHandColor: effect.color,
    };
  }

  toTrailSettings(effect: EffectConfig["trails"]): TrailSettings {
    return {
      enabled: effect.enabled,
      mode: effect.mode as TrailMode,
      effect: effect.glow ? TrailEffect.GLOW : TrailEffect.NONE,
      fadeDurationMs: effect.length * 1000 / 60,
      maxPoints: effect.length * 4,
      lineWidth: effect.width,
      glowBlur: effect.glow ? 8 : 0,
      blueColor: effect.color.blue,
      redColor: effect.color.red,
      additionalLayerColors: [],
      minOpacity: 1 - effect.fade,
      maxOpacity: 1.0,
      trackingMode: "both_ends",
      hideProps: false,
      usePathCache: false,
      previewMode: false,
    };
  }
}
```

- [ ] **Step 3: Register in DI container**

Add to `src/lib/shared/di/containers/video-trails-container.ts`:
```typescript
import { EffectConfigMapper } from "$lib/features/lab/tabs/video-trails/services/implementations/EffectConfigMapper";
// In .add():
effectConfigMapper: () => new EffectConfigMapper(),
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(video-trails): add EffectConfigMapper to bridge simple config to renderer configs"
```

---

### Task 2: EffectCanvasStack Component

**Files:**
- Create: `src/lib/features/lab/tabs/video-trails/components/EffectCanvasStack.svelte`

- [ ] **Step 1: Create the layered canvas component**

This component:
- Renders the video frame onto a base canvas
- Provides a trail canvas for Canvas2DTrailRenderer
- Provides a container div for WebGL renderers (they create their own canvases)
- Renders detection endpoint markers as an SVG overlay on top
- Exposes the container element and canvas refs via bindable props

```svelte
<!-- src/lib/features/lab/tabs/video-trails/components/EffectCanvasStack.svelte -->
<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  interface Props {
    videoElement: HTMLVideoElement | null;
    width: number;
    height: number;
  }

  let { videoElement, width, height }: Props = $props();

  const { state: trailsState } = getVideoTrailsContext();

  let videoCanvas: HTMLCanvasElement;
  let trailCanvas: HTMLCanvasElement;
  let rendererContainer: HTMLDivElement;

  // Draw video frame onto the base canvas
  export function drawVideoFrame(): void {
    if (!videoCanvas || !videoElement || width === 0) return;
    const ctx = videoCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoElement, 0, 0, width, height);
  }

  // Expose refs for parent to use
  export function getTrailCanvas(): HTMLCanvasElement | null {
    return trailCanvas ?? null;
  }

  export function getRendererContainer(): HTMLDivElement | null {
    return rendererContainer ?? null;
  }

  export function getVideoCanvas(): HTMLCanvasElement | null {
    return videoCanvas ?? null;
  }

  // Collect all canvases for export compositing
  export function getAllCanvases(): HTMLCanvasElement[] {
    if (!rendererContainer) return [];
    return Array.from(rendererContainer.querySelectorAll("canvas"));
  }
</script>

<div class="effect-stack" style="width: {width}px; height: {height}px;">
  <!-- Layer 1: Video frame -->
  <canvas
    bind:this={videoCanvas}
    {width}
    {height}
    class="layer video-layer"
    style="z-index: 1"
  ></canvas>

  <!-- Layer 2: Trail canvas (Canvas2D) -->
  <canvas
    bind:this={trailCanvas}
    {width}
    {height}
    class="layer trail-layer"
    style="z-index: 2"
  ></canvas>

  <!-- Layer 3-4: WebGL renderer container (fire, LED, charcoal create their own canvases here) -->
  <div
    bind:this={rendererContainer}
    class="layer renderer-container"
    style="z-index: 3; width: {width}px; height: {height}px;"
  ></div>

  <!-- Layer 5: Detection endpoint overlay -->
  <svg
    class="layer detection-overlay"
    style="z-index: 5"
    viewBox="0 0 {width} {height}"
    xmlns="http://www.w3.org/2000/svg"
  >
    {#each trailsState.currentEndpoints as ep}
      {@const color = ep.propIndex === 0 ? "#4a90d9" : "#d94a4a"}
      <circle
        cx={ep.x}
        cy={ep.y}
        r="8"
        fill="{color}"
        fill-opacity={ep.confidence * 0.6}
        stroke={color}
        stroke-width="2"
      />
      <text
        x={ep.x}
        y={ep.y - 12}
        text-anchor="middle"
        fill="white"
        font-size="10"
        font-family="monospace"
      >{Math.round(ep.confidence * 100)}%</text>
    {/each}
  </svg>
</div>

<style>
  .effect-stack {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: var(--theme-panel-bg, #000);
  }

  .layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .renderer-container {
    /* WebGL renderers append their own canvases here */
    position: absolute;
    top: 0;
    left: 0;
  }

  .renderer-container :global(canvas) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .detection-overlay {
    pointer-events: none;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(video-trails): add EffectCanvasStack with layered video/trail/renderer/overlay canvases"
```

---

### Task 3: WorkspaceView Rewrite (Renderer Integration)

**Files:**
- Modify: `src/lib/features/lab/tabs/video-trails/views/WorkspaceView.svelte`

- [ ] **Step 1: Rewrite WorkspaceView to use EffectCanvasStack and manage renderer lifecycle**

The key changes:
1. Replace `DetectionPreview` with `EffectCanvasStack`
2. Add renderer lifecycle management ($effect per renderer type)
3. Update `processCurrentFrame` to call each active renderer
4. Pass all canvases to exporter

```svelte
<!-- Full rewrite of WorkspaceView.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import { DETECTOR_REGISTRY } from "../domain/types";
  import type { ExportConfig } from "../domain/types";
  import type { IEndpointDetector } from "../services/contracts/IEndpointDetector";
  import type { IEffectConfigMapper } from "../services/contracts/IEffectConfigMapper";
  import { WebGLFireRenderer } from "$lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer";
  import { WebGLLedRenderer } from "$lib/shared/animation-engine/services/implementations/led/WebGLLedRenderer";
  import { CharcoalSparkRenderer } from "$lib/shared/animation-engine/services/implementations/charcoal/CharcoalSparkRenderer";
  import { Canvas2DTrailRenderer } from "$lib/features/compose/services/implementations/canvas2d/Canvas2DTrailRenderer";
  import VideoSourcePanel from "../components/VideoSourcePanel.svelte";
  import EffectCanvasStack from "../components/EffectCanvasStack.svelte";
  import PlaybackControls from "../components/PlaybackControls.svelte";
  import EffectsControlPanel from "../components/EffectsControlPanel.svelte";
  import ExportPanel from "../components/ExportPanel.svelte";

  const { state: trailsState } = getVideoTrailsContext();
  const configMapper = container.items.effectConfigMapper as IEffectConfigMapper;
  const tipAdapter = container.items.videoTipAdapter;

  // Video
  let videoElement: HTMLVideoElement | null = $state(null);
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;
  let canvasWidth = $state(640);
  let canvasHeight = $state(360);

  // Canvas stack ref
  let canvasStack: EffectCanvasStack;

  // Renderers (created on-demand)
  let fireRenderer: WebGLFireRenderer | null = null;
  let ledRenderer: WebGLLedRenderer | null = null;
  let charcoalRenderer: CharcoalSparkRenderer | null = null;
  let trailRenderer: Canvas2DTrailRenderer | null = null;

  // Trail point buffers
  let blueTrailPoints: import("$lib/shared/animation-engine/domain/types/TrailTypes").TrailPoint[] = [];
  let redTrailPoints: import("$lib/shared/animation-engine/domain/types/TrailTypes").TrailPoint[] = [];

  // --- Video source lifecycle ---
  $effect(() => {
    if (!trailsState.source?.url) return;

    if (!videoElement) {
      videoElement = document.createElement("video");
      videoElement.crossOrigin = "anonymous";
      videoElement.playsInline = true;
      videoElement.muted = true;
    }

    videoElement.src = trailsState.source.url;
    videoElement.onloadedmetadata = () => {
      if (!videoElement) return;
      canvasWidth = videoElement.videoWidth;
      canvasHeight = videoElement.videoHeight;
      trailsState.updateSourceMetadata({
        duration: videoElement.duration,
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
      });

      offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = canvasWidth;
      offscreenCanvas.height = canvasHeight;
      offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
    };
  });

  // --- Playback control ---
  $effect(() => {
    if (trailsState.isPlaying && videoElement) {
      videoElement.playbackRate = trailsState.playbackSpeed;
      if (videoElement.readyState >= 2) {
        videoElement.play().catch(() => {});
      }
      startDetectionLoop();
    } else if (videoElement) {
      videoElement.pause();
      stopDetectionLoop();
    }
  });

  $effect(() => {
    if (!trailsState.isPlaying && videoElement && trailsState.source) {
      const time = trailsState.currentFrame / trailsState.source.fps;
      if (Math.abs(videoElement.currentTime - time) > 0.01) {
        videoElement.currentTime = time;
      }
    }
  });

  // --- Renderer lifecycle (sync with effect toggles) ---
  $effect(() => {
    const fireEnabled = trailsState.effectConfig.fire.enabled;
    const rendererContainer = canvasStack?.getRendererContainer();

    if (fireEnabled && !fireRenderer?.isInitialized() && rendererContainer && canvasWidth > 0) {
      fireRenderer = new WebGLFireRenderer();
      const ok = fireRenderer.initialize(rendererContainer, canvasWidth, canvasHeight);
      if (!ok) fireRenderer = null;
    } else if (!fireEnabled && fireRenderer) {
      fireRenderer.dispose();
      fireRenderer = null;
    }
  });

  $effect(() => {
    const ledEnabled = trailsState.effectConfig.led.enabled;
    const rendererContainer = canvasStack?.getRendererContainer();

    if (ledEnabled && !ledRenderer?.isInitialized() && rendererContainer && canvasWidth > 0) {
      // Defer LED init to next RAF (prevents shader compilation freeze on Windows/ANGLE)
      requestAnimationFrame(() => {
        if (!trailsState.effectConfig.led.enabled) return;
        const cont = canvasStack?.getRendererContainer();
        if (!cont) return;
        ledRenderer = new WebGLLedRenderer();
        const ok = ledRenderer.initialize(cont, canvasWidth, canvasHeight);
        if (!ok) ledRenderer = null;
      });
    } else if (!ledEnabled && ledRenderer) {
      ledRenderer.dispose();
      ledRenderer = null;
    }
  });

  $effect(() => {
    const charcoalEnabled = trailsState.effectConfig.charcoal.enabled;
    const rendererContainer = canvasStack?.getRendererContainer();

    if (charcoalEnabled && !charcoalRenderer?.isInitialized() && rendererContainer && canvasWidth > 0) {
      charcoalRenderer = new CharcoalSparkRenderer();
      const ok = charcoalRenderer.initialize(rendererContainer, canvasWidth, canvasHeight);
      if (!ok) charcoalRenderer = null;
    } else if (!charcoalEnabled && charcoalRenderer) {
      charcoalRenderer.dispose();
      charcoalRenderer = null;
    }
  });

  $effect(() => {
    if (trailsState.effectConfig.trails.enabled && !trailRenderer) {
      trailRenderer = new Canvas2DTrailRenderer();
    }
  });

  // --- Detection + Rendering Loop ---
  function getDetector(): IEndpointDetector {
    const reg = DETECTOR_REGISTRY.find((r) => r.id === trailsState.activeDetectorId);
    const key = reg?.containerKey ?? "ledThresholdDetector";
    return (container.items as unknown as Record<string, unknown>)[key] as IEndpointDetector;
  }

  function processCurrentFrame(): void {
    if (!videoElement || !offscreenCtx || !offscreenCanvas || !canvasStack) return;

    const currentTime = performance.now();

    // 1. Extract frame for detection
    offscreenCtx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
    const frameData = offscreenCtx.getImageData(0, 0, canvasWidth, canvasHeight);

    // 2. Detect endpoints
    const detector = getDetector();
    const endpoints = detector.detect(frameData, trailsState.detectionConfig);
    const frameIndex = Math.round(videoElement.currentTime * (trailsState.source?.fps ?? 30));
    trailsState.storeFrameDetection(frameIndex, endpoints);
    trailsState.setCurrentFrame(frameIndex);

    // 3. Get corrected endpoints
    const corrected = trailsState.currentEndpoints;

    // 4. Draw video frame onto base canvas
    canvasStack.drawVideoFrame();

    // 5. Map endpoints to renderer formats
    const fireTips = tipAdapter.mapToFireTips(corrected, canvasWidth, currentTime);
    const ledTips = tipAdapter.mapToLedTips(corrected, currentTime, configMapper.toLedConfig(trailsState.effectConfig.led));
    const trailPoints = tipAdapter.mapToTrailPoints(corrected, currentTime);

    // 6. Accumulate trail points
    for (const tp of trailPoints) {
      if (tp.propIndex === 0) blueTrailPoints.push(tp);
      else redTrailPoints.push(tp);
    }
    // Cap trail buffer length
    const maxPts = trailsState.effectConfig.trails.length * 4;
    if (blueTrailPoints.length > maxPts) blueTrailPoints = blueTrailPoints.slice(-maxPts);
    if (redTrailPoints.length > maxPts) redTrailPoints = redTrailPoints.slice(-maxPts);

    // 7. Render trails
    if (trailRenderer && trailsState.effectConfig.trails.enabled) {
      const trailCanvas = canvasStack.getTrailCanvas();
      if (trailCanvas) {
        const trailCtx = trailCanvas.getContext("2d");
        if (trailCtx) {
          trailCtx.clearRect(0, 0, canvasWidth, canvasHeight);
          const trailSettings = configMapper.toTrailSettings(trailsState.effectConfig.trails);
          trailRenderer.renderTrails(
            trailCtx, blueTrailPoints, redTrailPoints, trailSettings,
            currentTime, blueTrailPoints.length > 0, redTrailPoints.length > 0, canvasWidth,
          );
        }
      }
    }

    // 8. Render fire
    if (fireRenderer?.isInitialized() && trailsState.effectConfig.fire.enabled) {
      const fireConfig = configMapper.toFireConfig(trailsState.effectConfig.fire);
      fireRenderer.renderFire(
        { tips: fireTips, currentTime, canvasWidth, canvasHeight, darkMode: true },
        fireConfig,
      );
    }

    // 9. Render charcoal (uses same input as fire)
    if (charcoalRenderer?.isInitialized() && trailsState.effectConfig.charcoal.enabled) {
      const fireConfig = configMapper.toFireConfig(trailsState.effectConfig.fire);
      charcoalRenderer.renderCharcoal(
        { tips: fireTips, currentTime, canvasWidth, canvasHeight, darkMode: true },
        fireConfig,
      );
    }

    // 10. Render LED glow
    if (ledRenderer?.isInitialized() && trailsState.effectConfig.led.enabled) {
      const ledConfig = configMapper.toLedConfig(trailsState.effectConfig.led);
      ledRenderer.renderLeds(
        { tips: ledTips, currentTime, canvasWidth, canvasHeight },
        ledConfig,
      );
    }
  }

  function startDetectionLoop(): void {
    if (animFrameId !== null) return;
    function loop() {
      processCurrentFrame();
      animFrameId = requestAnimationFrame(loop);
    }
    animFrameId = requestAnimationFrame(loop);
  }

  function stopDetectionLoop(): void {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  async function handleExport(config: ExportConfig): Promise<void> {
    if (!videoElement || !canvasStack) return;
    const exporter = container.items.videoTrailsExporter;
    trailsState.setExportState({ phase: "preparing" });

    try {
      const allCanvases = canvasStack.getAllCanvases();
      const blob = await exporter.export(videoElement, allCanvases, config, (s) => trailsState.setExportState(s));
      trailsState.setExportState({ phase: "complete", blob });
    } catch (err) {
      trailsState.setExportState({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  // --- Cleanup ---
  onDestroy(() => {
    stopDetectionLoop();
    fireRenderer?.dispose();
    ledRenderer?.dispose();
    charcoalRenderer?.dispose();
    fireRenderer = null;
    ledRenderer = null;
    charcoalRenderer = null;
    trailRenderer = null;
    if (videoElement) {
      videoElement.pause();
      videoElement.src = "";
    }
  });
</script>

<div class="workspace">
  <div class="main-area">
    {#if !trailsState.source}
      <VideoSourcePanel />
    {:else}
      <div class="canvas-area">
        <EffectCanvasStack bind:this={canvasStack} {videoElement} width={canvasWidth} height={canvasHeight} />
      </div>
      <PlaybackControls />
    {/if}
  </div>

  <aside class="sidebar">
    {#if trailsState.source}
      <VideoSourcePanel />
    {/if}
    <EffectsControlPanel />
    <ExportPanel onExport={handleExport} />
  </aside>
</div>

<style>
  .workspace {
    display: flex;
    gap: 16px;
    padding: 16px;
    height: 100%;
    min-height: 0;
    container-type: inline-size;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  @container (max-width: 768px) {
    .workspace {
      flex-direction: column;
    }
    .sidebar {
      width: 100%;
    }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(video-trails): integrate fire/LED/charcoal/trail renderers into workspace canvas stack"
```

---

### Task 4: Verify & Cleanup

- [ ] **Step 1: Run all video-trails tests**

Run: `npx vitest run tests/unit/video-trails/`
Expected: All 14 tests pass (no regression)

- [ ] **Step 2: Verify svelte-check has no new errors**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep video-trails | grep Error`
Expected: No new errors

- [ ] **Step 3: Manual verification**

Load the Video Trails tab, upload a video of LED props in the dark:
- Toggle Trails ON → colored trail lines appear following detected endpoints
- Toggle Fire ON → fire simulation renders at endpoint positions
- Toggle LED ON → glow halos appear at endpoints
- Toggle Charcoal ON → sparks emit from endpoints
- All effects composite correctly on top of video
- Export produces video with effects baked in
