<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  interface Props {
    videoElement: HTMLVideoElement | null;
    width: number;
    height: number;
  }

  let { videoElement, width, height }: Props = $props();

  const { state: trailsState } = getVideoTrailsContext();

  let canvas: HTMLCanvasElement;

  $effect(() => {
    if (!canvas || !videoElement || width === 0 || height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(videoElement, 0, 0, width, height);

    const endpoints = trailsState.currentEndpoints;
    for (const ep of endpoints) {
      const radius = 8;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, radius, 0, Math.PI * 2);

      const color = ep.propIndex === 0 ? "#4a90d9" : "#d94a4a";
      ctx.fillStyle = `${color}${Math.round(ep.confidence * 255).toString(16).padStart(2, "0")}`;
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(ep.confidence * 100)}%`, ep.x, ep.y - radius - 4);
    }
  });
</script>

<canvas
  bind:this={canvas}
  {width}
  {height}
  class="detection-canvas"
></canvas>

<style>
  .detection-canvas {
    border-radius: 8px;
    background: var(--theme-panel-bg, #000);
    max-width: 100%;
    height: auto;
  }
</style>
