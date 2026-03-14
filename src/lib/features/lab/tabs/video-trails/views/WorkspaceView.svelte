<script lang="ts">
  import { onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import { DETECTOR_REGISTRY } from "../domain/types";
  import type { ExportConfig } from "../domain/types";
  import type { IEndpointDetector } from "../services/contracts/IEndpointDetector";
  import VideoSourcePanel from "../components/VideoSourcePanel.svelte";
  import DetectionPreview from "../components/DetectionPreview.svelte";
  import PlaybackControls from "../components/PlaybackControls.svelte";
  import EffectsControlPanel from "../components/EffectsControlPanel.svelte";
  import ExportPanel from "../components/ExportPanel.svelte";

  const { state: trailsState } = getVideoTrailsContext();

  let videoElement: HTMLVideoElement | null = $state(null);
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;
  let canvasWidth = $state(640);
  let canvasHeight = $state(360);

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

  $effect(() => {
    if (trailsState.isPlaying && videoElement) {
      videoElement.playbackRate = trailsState.playbackSpeed;
      videoElement.play();
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

  function getDetector(): IEndpointDetector {
    const reg = DETECTOR_REGISTRY.find((r) => r.id === trailsState.activeDetectorId);
    const key = reg?.containerKey ?? "ledThresholdDetector";
    return (container.items as Record<string, unknown>)[key] as IEndpointDetector;
  }

  function processCurrentFrame(): void {
    if (!videoElement || !offscreenCtx || !offscreenCanvas) return;

    offscreenCtx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
    const frameData = offscreenCtx.getImageData(0, 0, canvasWidth, canvasHeight);

    const detector = getDetector();
    const endpoints = detector.detect(frameData, trailsState.detectionConfig);

    const frameIndex = Math.round(videoElement.currentTime * (trailsState.source?.fps ?? 30));
    trailsState.storeFrameDetection(frameIndex, endpoints);
    trailsState.setCurrentFrame(frameIndex);
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
    if (!videoElement) return;
    const exporter = container.items.videoTrailsExporter;
    trailsState.setExportState({ phase: "preparing" });

    try {
      const blob = await exporter.export(videoElement, [], config, (s) => trailsState.setExportState(s));
      trailsState.setExportState({ phase: "complete", blob });
    } catch (err) {
      trailsState.setExportState({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  onDestroy(() => {
    stopDetectionLoop();
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
        <DetectionPreview {videoElement} width={canvasWidth} height={canvasHeight} />
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
