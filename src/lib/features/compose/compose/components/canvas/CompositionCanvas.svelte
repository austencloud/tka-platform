<script lang="ts">
  /**
   * CompositionCanvas - The main composition grid view
   *
   * Renders the composition cells in a CSS Grid layout.
   * This is both the build view and the playback view.
   */

  import type { Composition } from "../../domain/types";
  import CompositionCell from "./CompositionCell.svelte";

  interface Props {
    composition: Composition;
    isPlaying: boolean;
    isPreviewing: boolean;
    selectedCellId: string | null;
    onCellClick: (cellId: string) => void;
  }

  let {
    composition,
    isPlaying,
    isPreviewing,
    selectedCellId,
    onCellClick,
  }: Props = $props();

  // Grid template based on layout
  const gridTemplate = $derived(
    `repeat(${composition.layout.rows}, 1fr) / repeat(${composition.layout.cols}, 1fr)`
  );

  // Aspect ratio: cols:rows (since each cell is 1:1)
  const aspectRatio = $derived(
    `${composition.layout.cols} / ${composition.layout.rows}`
  );
</script>

<div
  class="composition-canvas"
  style:grid-template={gridTemplate}
  style:aspect-ratio={aspectRatio}
  role="grid"
  aria-label="Composition grid with {composition.layout
    .rows} rows and {composition.layout.cols} columns"
>
  {#each composition.cells as cell (cell.id)}
    <CompositionCell
      {cell}
      {isPlaying}
      {isPreviewing}
      isSelected={selectedCellId === cell.id}
      onClick={() => onCellClick(cell.id)}
    />
  {/each}
</div>

<style>
  .composition-canvas {
    display: grid;
    gap: 0;
    width: auto;
    height: 100%;
    max-height: min(90cqb, 100%);
    /* Canvas aspect ratio matches grid layout (set via style binding) */
    background: var(--theme-panel-bg);
    border-radius: 0;
    box-shadow: var(
      --theme-shadow,
      0 clamp(4px, 1cqi, 12px) clamp(16px, 4cqi, 40px) rgba(0, 0, 0, 0.4)
    );
    container-type: size;
    container-name: grid;
    overflow: hidden;
  }
</style>
