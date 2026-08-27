<script lang="ts">
  import { getPoiContext } from "../context/poi-context";

  const poi = getPoiContext();

  let canvasRef = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const pattern = poi.activePattern;
    const canvas = canvasRef;
    if (!canvas || !pattern) return;

    const imageData = poi.toImageData();
    if (!imageData) return;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);
  });
</script>

<div class="pov-preview">
  <h3 class="section-title">POV Preview</h3>
  {#if poi.activePattern}
    <div class="preview-frame">
      <canvas
        bind:this={canvasRef}
        class="preview-canvas"
      ></canvas>
      <div class="preview-info">
        {poi.activePattern.ledCount} LEDs x {poi.activePattern.frameCount} frames
      </div>
    </div>
  {:else}
    <div class="empty-state">No pattern loaded</div>
  {/if}
</div>

<style>
  .pov-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-primary, #e2e8f0);
    margin: 0;
  }

  .preview-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: #000;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.1));
  }

  .preview-canvas {
    width: 100%;
    max-height: 200px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .preview-info {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--theme-text-secondary, #94a3b8);
    font-size: var(--font-size-compact, 12px);
  }
</style>
