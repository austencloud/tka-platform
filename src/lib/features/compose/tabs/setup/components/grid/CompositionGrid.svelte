<!--
  CompositionGrid.svelte

  Renders the grid of cells for composition.
  Supports sparse layouts (non-rectangular) - only renders enabled cells.
  Dynamically sizes cells to fill available space while maintaining square aspect ratio.
-->
<script lang="ts">
  import CellCanvas from "./CellCanvas.svelte";
  import type { GridCell } from "../../state/arrange-grid-state.svelte";

  let {
    cells,
    currentBeat,
    isPlaying,
    selectedCellId,
    onSelectCell,
  }: {
    cells: GridCell[];
    currentBeat: number;
    isPlaying: boolean;
    selectedCellId: string | null;
    onSelectCell: (cellId: string) => void;
  } = $props();

  // Container element reference
  let containerEl: HTMLDivElement | null = $state(null);
  let containerWidth = $state(0);
  let containerHeight = $state(0);

  // Get only enabled cells for rendering
  const enabledCells = $derived(cells.filter((c) => c.enabled));

  // Calculate grid bounds from enabled cells
  const gridBounds = $derived.by(() => {
    if (enabledCells.length === 0) {
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, rows: 1, cols: 1 };
    }

    const rows = enabledCells.map((c) => c.row);
    const colsArr = enabledCells.map((c) => c.col);

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...colsArr);
    const maxCol = Math.max(...colsArr);

    return {
      minRow,
      maxRow,
      minCol,
      maxCol,
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1,
    };
  });

  // Calculate cell size reactively based on container AND gridBounds
  // Goal: Fill 90% of container, clamped at 800px max
  const cellSize = $derived.by(() => {
    if (containerWidth === 0 || containerHeight === 0) return 200;

    const gap = 16; // Gap between cells
    const fillRatio = 0.9; // Fill 90% of container

    const { rows, cols } = gridBounds;

    // Calculate available space (90% of container minus gaps)
    const availableWidth = containerWidth * fillRatio - (cols - 1) * gap;
    const availableHeight = containerHeight * fillRatio - (rows - 1) * gap;

    const maxCellFromWidth = availableWidth / cols;
    const maxCellFromHeight = availableHeight / rows;

    // Use the smaller dimension to keep cells square
    const naturalSize = Math.floor(Math.min(maxCellFromWidth, maxCellFromHeight));

    // Hard limits: min 150px for usability, max 800px
    return Math.max(150, Math.min(naturalSize, 800));
  });

  // ResizeObserver to track container size
  $effect(() => {
    if (!containerEl) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      containerWidth = entry.contentRect.width;
      containerHeight = entry.contentRect.height;
    });

    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  // Check if a cell should be rendered at a specific grid position
  function getCellAt(row: number, col: number): GridCell | undefined {
    return enabledCells.find((c) => c.row === row && c.col === col);
  }

  // Get display index for a cell (1-based, only counting enabled cells)
  function getCellDisplayIndex(cell: GridCell): number {
    const sorted = [...enabledCells].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    return sorted.findIndex((c) => c.id === cell.id) + 1;
  }
</script>

<div
  class="composition-grid"
  bind:this={containerEl}
  style:--grid-rows={gridBounds.rows}
  style:--grid-cols={gridBounds.cols}
  style:--cell-size="{cellSize}px"
>
  {#if enabledCells.length === 0}
    <div class="empty-state">
      <i class="fas fa-th" aria-hidden="true"></i>
      <p>Enable cells in the grid picker to start</p>
    </div>
  {:else}
    <div class="grid-content">
      {#each { length: gridBounds.rows } as _, rowOffset}
        {#each { length: gridBounds.cols } as _, colOffset}
          {@const row = gridBounds.minRow + rowOffset}
          {@const col = gridBounds.minCol + colOffset}
          {@const cell = getCellAt(row, col)}

          {#if cell}
            <div class="cell-wrapper">
              <CellCanvas
                {cell}
                cellIndex={getCellDisplayIndex(cell)}
                {currentBeat}
                {isPlaying}
                isSelected={selectedCellId === cell.id}
                onSelect={() => onSelectCell(cell.id)}
              />
            </div>
          {:else}
            <div class="cell-placeholder"></div>
          {/if}
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .composition-grid {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .grid-content {
    display: grid;
    grid-template-rows: repeat(var(--grid-rows, 1), var(--cell-size, 200px));
    grid-template-columns: repeat(var(--grid-cols, 1), var(--cell-size, 200px));
    gap: 16px;
    place-content: center;
  }

  .cell-wrapper {
    position: relative;
    width: var(--cell-size, 200px);
    height: var(--cell-size, 200px);
  }

  .cell-placeholder {
    /* Empty slot in sparse grid - invisible but maintains layout */
    width: var(--cell-size, 200px);
    height: var(--cell-size, 200px);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-align: center;
    padding: var(--spacing-xl, 24px);
  }

  .empty-state i {
    font-size: 3rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }
</style>
