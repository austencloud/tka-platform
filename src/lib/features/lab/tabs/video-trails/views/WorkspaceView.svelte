<script lang="ts">
  import { onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import { DETECTOR_REGISTRY } from "../domain/types";
  import type { ExportConfig } from "../domain/types";
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
  const configMapper = container.items.effectConfigMapper as IEffectConfigMapper;
  const tipAdapter = container.items.videoTipAdapter as IVideoTipAdapter;

  // Canvas stack reference
  let canvasStack: EffectCanvasStack | undefined = $state(undefined);

  // Video plumbing
  let videoElement: HTMLVideoElement | null = $state(null);
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;
  let canvasWidth = $state(640);
  let canvasHeight = $state(360);

  // Renderers — created/disposed reactively based on effect enabled state
  let fireRenderer: WebGLFireRenderer | null = null;
  let ledRenderer: WebGLLedRenderer | null = null;
  let charcoalRenderer: CharcoalSparkRenderer | null = null;
  const trailRenderer = new Canvas2DTrailRenderer();

  // Trail point accumulation buffers
  let blueTrailPoints: TrailPoint[] = [];
  let redTrailPoints: TrailPoint[] = [];

  // ---------------------------------------------------------------------------
  // Video source loading
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Playback control
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Renderer lifecycle — create when enabled, dispose when disabled
  // ---------------------------------------------------------------------------

  $effect(() => {
    const enabled = trailsState.effectConfig.fire.enabled;
    if (enabled && !fireRenderer && canvasStack) {
      const rendererContainer = canvasStack.getRendererContainer();
      if (rendererContainer) {
        const r = new WebGLFireRenderer();
        if (r.initialize(rendererContainer, canvasWidth, canvasHeight)) {
          fireRenderer = r;
        }
      }
    } else if (!enabled && fireRenderer) {
      fireRenderer.dispose();
      fireRenderer = null;
    }
  });

  $effect(() => {
    const enabled = trailsState.effectConfig.charcoal.enabled;
    if (enabled && !charcoalRenderer && canvasStack) {
      const rendererContainer = canvasStack.getRendererContainer();
      if (rendererContainer) {
        const r = new CharcoalSparkRenderer();
        if (r.initialize(rendererContainer, canvasWidth, canvasHeight)) {
          charcoalRenderer = r;
        }
      }
    } else if (!enabled && charcoalRenderer) {
      charcoalRenderer.dispose();
      charcoalRenderer = null;
    }
  });

  // LED init deferred to next RAF to prevent shader freeze on Windows/ANGLE
  $effect(() => {
    const enabled = trailsState.effectConfig.led.enabled;
    if (enabled && !ledRenderer && canvasStack) {
      const rendererContainer = canvasStack.getRendererContainer();
      if (rendererContainer) {
        requestAnimationFrame(() => {
          if (!enabled || ledRenderer) return;
          const r = new WebGLLedRenderer();
          if (r.initialize(rendererContainer, canvasWidth, canvasHeight)) {
            ledRenderer = r;
          }
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
    return (container.items as unknown as Record<string, unknown>)[key] as IEndpointDetector;
  }

  function processCurrentFrame(): void {
    if (!videoElement || !offscreenCtx || !offscreenCanvas) return;

    // 1. Draw video frame to offscreen for detection AND to visible canvas
    offscreenCtx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
    canvasStack?.drawVideoFrame();

    // 2. Run endpoint detection
    const frameData = offscreenCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const detector = getDetector();
    const endpoints = detector.detect(frameData, trailsState.detectionConfig);

    const frameIndex = Math.round(videoElement.currentTime * (trailsState.source?.fps ?? 30));
    trailsState.storeFrameDetection(frameIndex, endpoints);
    trailsState.setCurrentFrame(frameIndex);

    const currentTime = performance.now();
    const effects = trailsState.effectConfig;

    // 3. Map endpoints to tip formats
    const fireTips = tipAdapter.mapToFireTips(endpoints, Math.max(canvasWidth, canvasHeight), currentTime);
    const trailPoints = tipAdapter.mapToTrailPoints(endpoints, currentTime);

    // 4. Accumulate trail points (blue = propIndex 0, red = propIndex 1)
    if (effects.trails.enabled) {
      const trailSettings = configMapper.toTrailSettings(effects.trails);
      const maxPoints = trailSettings.maxPoints;

      for (const pt of trailPoints) {
        if (pt.propIndex === 0) {
          blueTrailPoints.push(pt);
          if (blueTrailPoints.length > maxPoints) {
            blueTrailPoints = blueTrailPoints.slice(-maxPoints);
          }
        } else {
          redTrailPoints.push(pt);
          if (redTrailPoints.length > maxPoints) {
            redTrailPoints = redTrailPoints.slice(-maxPoints);
          }
        }
      }

      // Clear and render trails
      const trailCanvas = canvasStack?.getTrailCanvas();
      if (trailCanvas) {
        const ctx = trailCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          trailRenderer.renderTrails(
            ctx,
            blueTrailPoints,
            redTrailPoints,
            trailSettings,
            currentTime,
            blueTrailPoints.length > 0,
            redTrailPoints.length > 0,
            Math.max(canvasWidth, canvasHeight),
          );
        }
      }
    }

    // 5. Fire renderer
    if (effects.fire.enabled && fireRenderer?.isInitialized()) {
      const fireConfig = configMapper.toFireConfig(effects.fire);
      const fireInput: FireFrameInput = {
        tips: fireTips,
        currentTime,
        canvasWidth,
        canvasHeight,
        darkMode: true,
      };
      fireRenderer.renderFire(fireInput, fireConfig);
    }

    // 6. Charcoal renderer (uses FireFrameInput + FireOverlayConfig shapes)
    if (effects.charcoal.enabled && charcoalRenderer?.isInitialized()) {
      const charcoalInput: FireFrameInput = {
        tips: fireTips,
        currentTime,
        canvasWidth,
        canvasHeight,
        darkMode: true,
      };
      // Charcoal config is simpler than fire — map the charcoal-specific fields
      // into the FireOverlayConfig shape that CharcoalSparkRenderer expects.
      charcoalRenderer.renderCharcoal(charcoalInput, {
        enabled: true,
        intensity: 0.8,
        flameHeight: 0.5,
        velocityReactive: true,
        quality: 3,
        colorBlend: 0.0,
      });
    }

    // 7. LED renderer
    if (effects.led.enabled && ledRenderer?.isInitialized()) {
      const ledConfig = configMapper.toLedConfig(effects.led);
      const ledTips = tipAdapter.mapToLedTips(endpoints, currentTime, ledConfig);
      const ledInput: LedFrameInput = {
        tips: ledTips,
        currentTime,
        canvasWidth,
        canvasHeight,
      };
      ledRenderer.renderLeds(ledInput, ledConfig);
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
    if (!videoElement || !canvasStack) return;
    const exporter = container.items.videoTrailsExporter;
    trailsState.setExportState({ phase: "preparing" });

    try {
      const canvases = canvasStack.getAllCanvases();
      const blob = await exporter.export(videoElement, canvases, config, (s) => trailsState.setExportState(s));
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

    if (fireRenderer) {
      fireRenderer.dispose();
      fireRenderer = null;
    }
    if (ledRenderer) {
      ledRenderer.dispose();
      ledRenderer = null;
    }
    if (charcoalRenderer) {
      charcoalRenderer.dispose();
      charcoalRenderer = null;
    }

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
        <EffectCanvasStack
          bind:this={canvasStack}
          {videoElement}
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
