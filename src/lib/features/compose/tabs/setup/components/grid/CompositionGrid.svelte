<!--
  CompositionGrid.svelte

  Renders the grid of cells for composition.
  Supports sparse layouts (non-rectangular) - only renders enabled cells.
  Supports cell spanning (colSpan/rowSpan) for complex layouts.
  Dynamically sizes cells to fill available space while maintaining square aspect ratio.
  Supports drag-to-resize cells by grabbing edges/corners.
-->
<script lang="ts">
  import CellCanvas from "./CellCanvas.svelte";
  import CellResizeHandles from "./CellResizeHandles.svelte";
  import type { GridCell } from "../../state/arrange-grid-state.svelte";

  let {
    cells,
    currentBeat,
    isPlaying,
    selectedCellId,
    occupiedPositions,
    onSelectCell,
    onSetCellSpan,
  }: {
    cells: GridCell[];
    currentBeat: number;
    isPlaying: boolean;
    selectedCellId: string | null;
    occupiedPositions: Map<string, string>;
    onSelectCell: (cellId: string) => void;
    onSetCellSpan: (cellId: string, colSpan: number, rowSpan: number) => void;
  } = $props();

  // Resize state
  let resizeState = $state<{
    cellId: string;
    direction: "horizontal" | "vertical" | "both";
    startX: number;
    startY: number;
    originalColSpan: number;
    originalRowSpan: number;
    targetColSpan: number;
    targetRowSpan: number;
    isValid: boolean;
  } | null>(null);

  // Container element reference
  let containerEl: HTMLDivElement | null = $state(null);
  let containerWidth = $state(0);
  let containerHeight = $state(0);

  // Get only enabled cells for rendering
  const enabledCells = $derived(cells.filter((c) => c.enabled));

  // Calculate grid bounds from enabled cells - accounts for spans
  const gridBounds = $derived.by(() => {
    if (enabledCells.length === 0) {
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, rows: 1, cols: 1 };
    }

    // Account for spans
    const rowStarts = enabledCells.map((c) => c.row);
    const rowEnds = enabledCells.map((c) => c.row + c.rowSpan - 1);
    const colStarts = enabledCells.map((c) => c.col);
    const colEnds = enabledCells.map((c) => c.col + c.colSpan - 1);

    const minRow = Math.min(...rowStarts);
    const maxRow = Math.max(...rowEnds);
    const minCol = Math.min(...colStarts);
    const maxCol = Math.max(...colEnds);

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

  // Resize handlers
  function handleResizeStart(
    cellId: string,
    direction: "horizontal" | "vertical" | "both",
    e: PointerEvent
  ) {
    const cell = enabledCells.find((c) => c.id === cellId);
    if (!cell) return;

    resizeState = {
      cellId,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      originalColSpan: cell.colSpan,
      originalRowSpan: cell.rowSpan,
      targetColSpan: cell.colSpan,
      targetRowSpan: cell.rowSpan,
      isValid: true,
    };

    // Add global listeners for move/end
    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", handleResizeEnd);
    window.addEventListener("pointercancel", handleResizeEnd);
  }

  function handleResizeMove(e: PointerEvent) {
    const state = resizeState;
    if (!state) return;

    const cell = enabledCells.find((c) => c.id === state.cellId);
    if (!cell) return;

    const gap = 16;
    const unitSize = cellSize + gap;
    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    let targetColSpan = state.originalColSpan;
    let targetRowSpan = state.originalRowSpan;

    if (state.direction !== "vertical") {
      const colDelta = Math.round(deltaX / unitSize);
      targetColSpan = Math.max(
        1,
        Math.min(3 - cell.col, state.originalColSpan + colDelta)
      );
    }

    if (state.direction !== "horizontal") {
      const rowDelta = Math.round(deltaY / unitSize);
      targetRowSpan = Math.max(
        1,
        Math.min(3 - cell.row, state.originalRowSpan + rowDelta)
      );
    }

    // Validate: would overlap other enabled cells?
    const isValid = validateSpan(cell, targetColSpan, targetRowSpan);

    resizeState = { ...state, targetColSpan, targetRowSpan, isValid };
  }

  function handleResizeEnd() {
    if (resizeState && resizeState.isValid) {
      const { targetColSpan, targetRowSpan, originalColSpan, originalRowSpan } =
        resizeState;
      // Only update if span actually changed
      if (
        targetColSpan !== originalColSpan ||
        targetRowSpan !== originalRowSpan
      ) {
        onSetCellSpan(resizeState.cellId, targetColSpan, targetRowSpan);
      }
    }

    resizeState = null;

    // Remove global listeners
    window.removeEventListener("pointermove", handleResizeMove);
    window.removeEventListener("pointerup", handleResizeEnd);
    window.removeEventListener("pointercancel", handleResizeEnd);
  }

  function validateSpan(
    cell: GridCell,
    colSpan: number,
    rowSpan: number
  ): boolean {
    // Check each position the expanded cell would occupy
    for (let r = cell.row; r < cell.row + rowSpan; r++) {
      for (let c = cell.col; c < cell.col + colSpan; c++) {
        // Skip the origin position
        if (r === cell.row && c === cell.col) continue;

        // Check if another enabled cell exists at this position
        const other = enabledCells.find(
          (x) => x.row === r && x.col === c && x.id !== cell.id
        );
        if (other) return false;

        // Check if this position is occupied by another cell's span
        const occupyingId = occupiedPositions.get(`${r}-${c}`);
        if (occupyingId && occupyingId !== cell.id) return false;
      }
    }
    return true;
  }

  // Get the cell being resized (for ghost preview)
  const resizingCell = $derived.by(() => {
    const state = resizeState;
    if (!state) return null;
    return enabledCells.find((c) => c.id === state.cellId) ?? null;
  });
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
          {@const posKey = `${row}-${col}`}
          {@const cell = getCellAt(row, col)}
          {@const isOccupied = occupiedPositions.has(posKey)}

          {#if cell}
            <div
              class="cell-wrapper"
              class:is-resizing={resizeState?.cellId === cell.id}
              style:grid-column="span {cell.colSpan}"
              style:grid-row="span {cell.rowSpan}"
              style:--col-span={cell.colSpan}
              style:--row-span={cell.rowSpan}
            >
              <CellCanvas
                {cell}
                cellIndex={getCellDisplayIndex(cell)}
                {currentBeat}
                {isPlaying}
                isSelected={selectedCellId === cell.id}
                onSelect={() => onSelectCell(cell.id)}
              />

              <CellResizeHandles
                cellId={cell.id}
                canExpandRight={cell.col + cell.colSpan < 3}
                canExpandDown={cell.row + cell.rowSpan < 3}
                onResizeStart={handleResizeStart}
              />
            </div>
          {:else if isOccupied}
            <!-- Skip - this position is covered by a spanning cell -->
          {:else}
            <div class="cell-placeholder"></div>
          {/if}
        {/each}
      {/each}

      <!-- Ghost preview during resize -->
      {#if resizeState && resizingCell}
        <div
          class="resize-ghost"
          class:invalid={!resizeState.isValid}
          style:grid-column="{resizingCell.col - gridBounds.minCol + 1} / span {resizeState.targetColSpan}"
          style:grid-row="{resizingCell.row - gridBounds.minRow + 1} / span {resizeState.targetRowSpan}"
        ></div>
      {/if}
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
    /* Width/height calculated from span and cell size */
    width: calc(var(--col-span, 1) * var(--cell-size, 200px) + (var(--col-span, 1) - 1) * 16px);
    height: calc(var(--row-span, 1) * var(--cell-size, 200px) + (var(--row-span, 1) - 1) * 16px);
  }

  .cell-wrapper.is-resizing {
    /* Slight opacity during resize to show it's being modified */
    opacity: 0.8;
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

  /* Resize ghost preview */
  .resize-ghost {
    background: var(--theme-accent, #8b5cf6);
    opacity: 0.2;
    border: 2px dashed var(--theme-accent, #8b5cf6);
    border-radius: var(--border-radius-md, 8px);
    pointer-events: none;
    z-index: 15;
    transition: none;
  }

  .resize-ghost.invalid {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }
</style>
