<!--
  LoopBlockTimeline — the novice bridge for compositional LOOPs.
  Shows what each stretch of the sequence DOES relative to the first block,
  without terminology: equal cells, per-cell transform icons, and a
  continuous rotation ribbon underneath when the loop rotates.
  Cells are equal-width by construction (grid), so signature changes can
  never shift layout.
-->
<script lang="ts">
  import type { BlockTimelineModel } from "$lib/shared/create/services/loop-block-signatures";

  let { model, height = 34 }: { model: BlockTimelineModel; height?: number } = $props();

  const ICONS: Record<string, { fa: string; color: string; label: string }> = {
    mirrored: { fa: "fas fa-left-right", color: "#6F2DA8", label: "Mirrored" },
    flipped: { fa: "fas fa-up-down", color: "#e91e63", label: "Flipped" },
    swapped: { fa: "fas fa-shuffle", color: "#2ecc71", label: "Swapped" },
    inverted: { fa: "fas fa-adjust", color: "#eb7d00", label: "Inverted" },
  };
</script>

<div class="timeline" style="--cells: {model.cells.length}; --h: {height}px;">
  <div class="cells" role="img" aria-label="Loop structure timeline">
    {#each model.cells as cell, i (i)}
      <div class="cell" class:base={cell.size === 0}>
        {#if cell.size === 0}
          <span class="base-dot" aria-hidden="true"></span>
        {:else}
          {#each [...cell].sort() as comp (comp)}
            {#if ICONS[comp]}
              <i class={ICONS[comp].fa} style="color: {ICONS[comp].color}" title={ICONS[comp].label}></i>
            {/if}
          {/each}
        {/if}
      </div>
    {/each}
  </div>
  {#if model.rotation}
    <div class="ribbon" title="Rotates continuously ({model.rotation.interval === 4 ? 'quarter turns' : 'half turns'})">
      <span class="ribbon-line"></span>
      <i class="fas fa-rotate" aria-hidden="true"></i>
    </div>
  {/if}
</div>

<style>
  .timeline { display: flex; flex-direction: column; gap: 3px; width: 100%; }
  .cells {
    display: grid;
    grid-template-columns: repeat(var(--cells), 1fr);
    gap: 3px;
    height: var(--h);
  }
  .cell {
    display: flex; align-items: center; justify-content: center; gap: 4px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: calc(var(--h) * 0.42);
    min-width: 0;
  }
  .cell.base { background: rgba(255, 255, 255, 0.03); }
  .base-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: currentColor; opacity: 0.35;
  }
  .ribbon { display: flex; align-items: center; gap: 5px; color: #36c3ff; font-size: 10px; }
  .ribbon-line {
    flex: 1; height: 2px; border-radius: 2px;
    background: linear-gradient(90deg, transparent, #36c3ff 15%, #36c3ff);
    opacity: 0.7;
  }
</style>
