<script lang="ts">
  import { onMount } from "svelte";
  import type { ITreeLabRenderer, TreeAlgorithmParams } from "../services/contracts/ITreeLabRenderer";

  interface Props {
    seeds: number[];
    renderer: ITreeLabRenderer;
    params: TreeAlgorithmParams;
  }

  let {
    seeds,
    renderer,
    params,
  }: Props = $props();

  function renderSamples() {
    setTimeout(() => {
      seeds.forEach((seed, i) => {
        const canvasEl = document.querySelector(`[data-pine-index="${i}"]`) as HTMLCanvasElement;
        if (canvasEl) {
          renderer.drawTreeSample(canvasEl, "pine", seed, params);
        }
      });
    }, 50);
  }

  // Re-render when params or seeds change
  $effect(() => {
    // Track dependencies
    void seeds;
    void params;
    renderSamples();
  });

  onMount(() => {
    renderSamples();
  });
</script>

<div class="pine-tuning-grid">
  {#each seeds as seed, i}
    <div class="pine-sample">
      <canvas
        data-pine-index={i}
        width="200"
        height="300"
      ></canvas>
      <span class="seed-label">Seed #{seed}</span>
    </div>
  {/each}
</div>

<style>
  .pine-tuning-grid {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    padding: 32px;
    background: #1a1a2e;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    height: 100%;
  }

  .pine-sample {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(245, 158, 11, 0.15);
    border-radius: 16px;
  }

  .pine-sample canvas {
    display: block;
    border-radius: 12px;
  }

  .seed-label {
    font-size: 0.75rem;
    font-family: monospace;
    color: #fbbf24;
  }
</style>
