<script lang="ts">
  import { onMount } from "svelte";
  import type { TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
  import type { TreeSample } from "../services/contracts/ITreeFeedbackPersister";
  import type { ITreeLabRenderer, TreeAlgorithmParams } from "../services/contracts/ITreeLabRenderer";

  interface Props {
    treeType: TreeType;
    samples: TreeSample[];
    renderer: ITreeLabRenderer;
    params: TreeAlgorithmParams;
    onToggleStatus: (index: number) => void;
    onCopySVG: (seed: number) => void;
  }

  let {
    treeType,
    samples,
    renderer,
    params,
    onToggleStatus,
    onCopySVG,
  }: Props = $props();

  function renderSamples() {
    // Render each canvas in the grid after they're mounted
    setTimeout(() => {
      samples.forEach((sample, i) => {
        const canvasEl = document.querySelector(`[data-tree-index="${i}"]`) as HTMLCanvasElement;
        if (canvasEl) {
          renderer.drawTreeSample(canvasEl, treeType, sample.seed, params);
        }
      });
    }, 50);
  }

  // Re-render when samples change
  $effect(() => {
    if (samples.length > 0) {
      renderSamples();
    }
  });

  onMount(() => {
    renderSamples();
  });
</script>

<div class="tree-lab-grid">
  {#each samples as sample, i}
    <div
      class="tree-sample"
      class:approved={sample.status === "approved"}
      class:rejected={sample.status === "rejected"}
    >
      <button class="tree-canvas-btn" onclick={() => onToggleStatus(i)}>
        <canvas
          data-tree-index={i}
          width="150"
          height="225"
        ></canvas>
      </button>
      <div class="tree-footer">
        <span class="seed-label">#{sample.seed}</span>
        <button class="copy-svg-btn" onclick={() => onCopySVG(sample.seed)} title="Copy SVG">
          <i class="fas fa-copy"></i>
        </button>
      </div>
      <span class="status-icon">
        {#if sample.status === "approved"}
          <i class="fas fa-check-circle"></i>
        {:else if sample.status === "rejected"}
          <i class="fas fa-times-circle"></i>
        {:else}
          <i class="fas fa-circle"></i>
        {/if}
      </span>
    </div>
  {/each}
</div>

<style>
  .tree-lab-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    background: #1a1a2e;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    align-content: flex-start;
  }

  .tree-sample {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 2px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    width: calc(25% - 9px);
    box-sizing: border-box;
  }

  .tree-sample:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }

  .tree-sample.approved {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.08);
  }

  .tree-sample.rejected {
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.08);
  }

  .tree-canvas-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
  }

  .tree-canvas-btn canvas {
    display: block;
    border-radius: 8px;
  }

  .tree-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 6px;
    gap: 8px;
  }

  .seed-label {
    font-size: 0.65rem;
    font-family: monospace;
    color: #6b7280;
  }

  .copy-svg-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    color: #9ca3af;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-svg-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .status-icon {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .tree-sample:not(.approved):not(.rejected) .status-icon {
    color: #6b7280;
  }

  .tree-sample.approved .status-icon {
    color: #22c55e;
  }

  .tree-sample.rejected .status-icon {
    color: #ef4444;
  }

  @media (max-width: 900px) {
    .tree-sample {
      width: calc(50% - 6px);
    }
  }
</style>
