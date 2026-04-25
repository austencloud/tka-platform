<script lang="ts">

import { getEffectConfigMapper } from "$lib/features/video/video-trails/getEffectConfigMapper";
import { getVideoTipAdapter } from "$lib/features/video/video-trails/getVideoTipAdapter";
import { getVideoTrailsExporter } from "$lib/features/video/video-trails/getVideoTrailsExporter";
import { getLedThresholdDetector } from "$lib/features/video/video-trails/getLedThresholdDetector";
import { getColorEndpointDetector } from "$lib/features/video/video-trails/getColorEndpointDetector";
  import { onMount, onDestroy } from "svelte";
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import { DETECTOR_REGISTRY } from "../domain/types";
  import type { ExportConfig, ExportState } from "../domain/types";
  import type { IEndpointDetector } from "../services/contracts/IEndpointDetector";
  import type { IEffectConfigMapper } from "../services/contracts/IEffectConfigMapper";
  import type { IVideoTipAdapter } from "../services/contracts/IVideoTipAdapter";
  import type { TrailPoint } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import type { FireFrameInput } from "$lib/shared/animation-engine/domain/types/FireTypes";
  import type { LedFrameInput } from "$lib/shared/animation-engine/domain/types/LedTypes";
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

  // DI services
  const configMapper = getEffectConfigMapper() as IEffectConfigMapper;
  const tipAdapter = getVideoTipAdapter() as IVideoTipAdapter;

  // Canvas stack reference
  let canvasStack: EffectCanvasStack | undefined = $state(undefined);

  // Video element — lives in the DOM as a hidden element for reliable playback
  let videoEl: HTMLVideoElement | undefined = $state(undefined);
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;
  let canvasWidth = $state(640);
  let canvasHeight = $state(360);

  // Throttle detection to every Nth frame — detection is CPU-heavy (pixel scanning,
  // flood-fill, k-means) and running it at 60fps causes choppy video playback.
  // The video frame still draws every RAF tick for smooth visuals.
  let detectionFrameCounter = 0;
  const DETECTION_EVERY_N_FRAMES = 3;

  // Renderers
  let fireRenderer: WebGLFireRenderer | null = null;
  let ledRenderer: WebGLLedRenderer | null = null;
  let charcoalRenderer: CharcoalSparkRenderer | null = null;
  const trailRenderer = new Canvas2DTrailRenderer();

  // Trail buffers
  let blueTrailPoints: TrailPoint[] = [];
  let redTrailPoints: TrailPoint[] = [];

  // Persistence key for IndexedDB
  const VIDEO_PERSIST_KEY = "video-trails-last-video";

  // ---------------------------------------------------------------------------
  // Video persistence — store/restore video blob via IndexedDB
  // ---------------------------------------------------------------------------

  async function persistVideoBlob(file: File): Promise<void> {
    try {
      const db = await openPersistDb();
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put({ key: VIDEO_PERSIST_KEY, blob: file, name: file.name });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Persistence is best-effort
    }
  }

  async function loadPersistedVideo(): Promise<{ blob: Blob; name: string } | null> {
    try {
      const db = await openPersistDb();
      const tx = db.transaction("blobs", "readonly");
      const request = tx.objectStore("blobs").get(VIDEO_PERSIST_KEY);
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result?.blob) resolve({ blob: result.blob, name: result.name ?? "video" });
          else resolve(null);
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  function openPersistDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("tka-video-trails-persist", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs", { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------------------------------------------------------------------------
  // On mount: restore persisted video if available
  // ---------------------------------------------------------------------------

  onMount(async () => {
    const persisted = await loadPersistedVideo();
    if (persisted && !trailsState.source) {
      const file = new File([persisted.blob], persisted.name, { type: persisted.blob.type });
      trailsState.loadVideo(file);
    }
  });

  // ---------------------------------------------------------------------------
  // Video source loading — set src on the DOM <video> element
  // ---------------------------------------------------------------------------

  $effect(() => {
    const url = trailsState.source?.url;
    if (!url || !videoEl) return;

    // Guard: don't reload if src is already set to this URL
    if (videoEl.src === url) return;

    videoEl.src = url;
    videoEl.load();
  });

  function handleVideoMetadata() {
    if (!videoEl) return;
    canvasWidth = videoEl.videoWidth;
    canvasHeight = videoEl.videoHeight;
    trailsState.updateSourceMetadata({
      duration: videoEl.duration,
      width: videoEl.videoWidth,
      height: videoEl.videoHeight,
    });

    offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
  }

  function handleVideoCanPlay() {
    // Draw the first frame immediately so the canvas isn't black before playback
    canvasStack?.drawVideoFrame(videoEl!);

    if (trailsState.isPlaying && videoEl?.paused) {
      videoEl.play().catch(() => {});
    }
  }

  // Intercept loadVideo to also persist the blob
  const originalLoadVideo = trailsState.loadVideo.bind(trailsState);
  trailsState.loadVideo = (file: File) => {
    originalLoadVideo(file);
    persistVideoBlob(file);
  };

  // ---------------------------------------------------------------------------
  // Playback control
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (!videoEl) return;

    if (trailsState.isPlaying) {
      videoEl.playbackRate = trailsState.playbackSpeed;
      if (videoEl.readyState >= 3) {
        videoEl.play().catch(() => {});
      }
      startDetectionLoop();
    } else {
      videoEl.pause();
      stopDetectionLoop();
    }
  });

  $effect(() => {
    if (!trailsState.isPlaying && videoEl && trailsState.source && videoEl.readyState >= 2) {
      const time = trailsState.currentFrame / trailsState.source.fps;
      if (Math.abs(videoEl.currentTime - time) > 0.01) {
        videoEl.currentTime = time;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Renderer lifecycle
  // ---------------------------------------------------------------------------

  $effect(() => {
    const enabled = trailsState.effectConfig.fire.enabled;
    if (enabled && !fireRenderer && canvasStack) {
      const rc = canvasStack.getRendererContainer();
      if (rc) {
        const r = new WebGLFireRenderer();
        if (r.initialize(rc, canvasWidth, canvasHeight)) fireRenderer = r;
      }
    } else if (!enabled && fireRenderer) {
      fireRenderer.dispose();
      fireRenderer = null;
    }
  });

  $effect(() => {
    const enabled = trailsState.effectConfig.charcoal.enabled;
    if (enabled && !charcoalRenderer && canvasStack) {
      const rc = canvasStack.getRendererContainer();
      if (rc) {
        const r = new CharcoalSparkRenderer();
        if (r.initialize(rc, canvasWidth, canvasHeight)) charcoalRenderer = r;
      }
    } else if (!enabled && charcoalRenderer) {
      charcoalRenderer.dispose();
      charcoalRenderer = null;
    }
  });

  $effect(() => {
    const enabled = trailsState.effectConfig.led.enabled;
    if (enabled && !ledRenderer && canvasStack) {
      const rc = canvasStack.getRendererContainer();
      if (rc) {
        requestAnimationFrame(() => {
          if (!enabled || ledRenderer) return;
          const r = new WebGLLedRenderer();
          if (r.initialize(rc, canvasWidth, canvasHeight)) ledRenderer = r;
        });
      }
    } else if (!enabled && ledRenderer) {
      ledRenderer.dispose();
      ledRenderer = null;
    }
  });

  // ---------------------------------------------------------------------------
  // Detection + rendering loop
  // ---------------------------------------------------------------------------

  function getDetector(): IEndpointDetector {
    const reg = DETECTOR_REGISTRY.find((r) => r.id === trailsState.activeDetectorId);
    const key = reg?.containerKey ?? "ledThresholdDetector";
    const detectorMap: Record<string, () => IEndpointDetector> = {
      ledThresholdDetector: getLedThresholdDetector,
      colorEndpointDetector: getColorEndpointDetector,
    };
    return (detectorMap[key] ?? getLedThresholdDetector)();
  }

  function processCurrentFrame(): void {
    if (!videoEl || videoEl.readyState < 2) return;

    // Always draw video frame at full framerate for smooth visuals
    canvasStack?.drawVideoFrame(videoEl);

    // Only update reactive state when the frame actually changes to avoid
    // unnecessary Svelte re-renders (setCurrentFrame creates new state objects)
    const frameIndex = Math.round(videoEl.currentTime * (trailsState.source?.fps ?? 30));
    if (frameIndex !== trailsState.currentFrame) {
      trailsState.setCurrentFrame(frameIndex);
    }

    // Throttle the expensive detection work (pixel scanning, flood-fill, k-means)
    // to every Nth frame. Video rendering stays at full framerate above.
    detectionFrameCounter++;
    if (detectionFrameCounter % DETECTION_EVERY_N_FRAMES !== 0) return;

    // Detection requires offscreen canvas
    if (!offscreenCtx || !offscreenCanvas) return;

    offscreenCtx.drawImage(videoEl, 0, 0, canvasWidth, canvasHeight);
    const frameData = offscreenCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const detector = getDetector();
    const endpoints = detector.detect(frameData, trailsState.detectionConfig);
    trailsState.storeFrameDetection(frameIndex, endpoints);

    const currentTime = performance.now();
    const effects = trailsState.effectConfig;

    const fireTips = tipAdapter.mapToFireTips(endpoints, Math.max(canvasWidth, canvasHeight), currentTime);
    const trailPoints = tipAdapter.mapToTrailPoints(endpoints, currentTime);

    // Trails
    if (effects.trails.enabled) {
      const trailSettings = configMapper.toTrailSettings(effects.trails);
      const maxPoints = trailSettings.maxPoints;

      for (const pt of trailPoints) {
        if (pt.propIndex === 0) {
          blueTrailPoints.push(pt);
          if (blueTrailPoints.length > maxPoints) blueTrailPoints = blueTrailPoints.slice(-maxPoints);
        } else {
          redTrailPoints.push(pt);
          if (redTrailPoints.length > maxPoints) redTrailPoints = redTrailPoints.slice(-maxPoints);
        }
      }

      const trailCanvas = canvasStack?.getTrailCanvas();
      if (trailCanvas) {
        const ctx = trailCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          trailRenderer.renderTrails(
            ctx, blueTrailPoints, redTrailPoints, trailSettings,
            currentTime, blueTrailPoints.length > 0, redTrailPoints.length > 0,
            Math.max(canvasWidth, canvasHeight),
          );
        }
      }
    }

    // Fire
    if (effects.fire.enabled && fireRenderer?.isInitialized()) {
      fireRenderer.renderFire(
        { tips: fireTips, currentTime, canvasWidth, canvasHeight, darkMode: true } as FireFrameInput,
        configMapper.toFireConfig(effects.fire),
      );
    }

    // Charcoal
    if (effects.charcoal.enabled && charcoalRenderer?.isInitialized()) {
      charcoalRenderer.renderCharcoal(
        { tips: fireTips, currentTime, canvasWidth, canvasHeight, darkMode: true } as FireFrameInput,
        { intensity: 0.8, flameHeight: 0.5, velocityReactive: true, quality: 3, colorBlend: 0 },
      );
    }

    // LED
    if (effects.led.enabled && ledRenderer?.isInitialized()) {
      const ledConfig = configMapper.toLedConfig(effects.led);
      const ledTips = tipAdapter.mapToLedTips(endpoints, currentTime, ledConfig);
      ledRenderer.renderLeds(
        { tips: ledTips, currentTime, canvasWidth, canvasHeight } as LedFrameInput,
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

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async function handleExport(config: ExportConfig): Promise<void> {
    if (!videoEl || !canvasStack) return;
    const exporter = getVideoTrailsExporter();
    trailsState.setExportState({ phase: "preparing" });
    try {
      const canvases = canvasStack.getAllCanvases();
      const blob = await exporter.export(videoEl, canvases, config, (s: ExportState) => trailsState.setExportState(s));
      trailsState.setExportState({ phase: "complete", blob });
    } catch (err) {
      trailsState.setExportState({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  onDestroy(() => {
    stopDetectionLoop();
    tipAdapter.reset();
    fireRenderer?.dispose();
    ledRenderer?.dispose();
    charcoalRenderer?.dispose();
    fireRenderer = null;
    ledRenderer = null;
    charcoalRenderer = null;
  });
</script>

<!-- Hidden video element in the DOM for reliable cross-browser playback -->
<video
  bind:this={videoEl}
  class="hidden-video"
  muted
  playsinline
  crossorigin="anonymous"
  preload="auto"
  onloadedmetadata={handleVideoMetadata}
  oncanplay={handleVideoCanPlay}
></video>

<div class="workspace">
  <div class="main-area">
    {#if !trailsState.source}
      <VideoSourcePanel />
    {:else}
      <div class="canvas-area">
        <EffectCanvasStack
          bind:this={canvasStack}
          videoElement={videoEl ?? null}
          width={canvasWidth}
          height={canvasHeight}
        />
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
  .hidden-video {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }

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
