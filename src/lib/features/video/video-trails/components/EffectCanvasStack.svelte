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

  export function drawVideoFrame(video?: HTMLVideoElement): void {
    const el = video ?? videoElement;
    if (!videoCanvas || !el || width === 0) return;
    const ctx = videoCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(el, 0, 0, width, height);
  }

  export function getTrailCanvas(): HTMLCanvasElement | null {
    return trailCanvas ?? null;
  }

  export function getRendererContainer(): HTMLDivElement | null {
    return rendererContainer ?? null;
  }

  export function getVideoCanvas(): HTMLCanvasElement | null {
    return videoCanvas ?? null;
  }

  export function getAllCanvases(): HTMLCanvasElement[] {
    if (!rendererContainer) return [];
    const canvases: HTMLCanvasElement[] = [];
    if (videoCanvas) canvases.push(videoCanvas);
    if (trailCanvas) canvases.push(trailCanvas);
    // Add any WebGL renderer canvases appended by fire/LED/charcoal renderers
    const webglCanvases = rendererContainer.querySelectorAll("canvas");
    webglCanvases.forEach((c) => canvases.push(c));
    return canvases;
  }
</script>

<div class="effect-stack" style="width: {width}px; height: {height}px;">
  <canvas
    bind:this={videoCanvas}
    {width}
    {height}
    class="layer video-layer"
    style="z-index: 1"
  ></canvas>

  <canvas
    bind:this={trailCanvas}
    {width}
    {height}
    class="layer trail-layer"
    style="z-index: 2"
  ></canvas>

  <div
    bind:this={rendererContainer}
    class="layer renderer-container"
    style="z-index: 3; width: {width}px; height: {height}px;"
  ></div>

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
