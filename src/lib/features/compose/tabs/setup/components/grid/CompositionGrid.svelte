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
  import { GRID_SIZE, type GridCell } from "../../state/arrange-grid-state.svelte";

  let {
    cells,
    currentBeat,
    isPlaying,
    skipStartPosition = true,
    selectedCellId,
    occupiedPositions,
    zoomMode = "auto",
    onSelectCell,
    onSetCellSpan,
    onToggleCell,
  }: {
    cells: GridCell[];
    currentBeat: number;
    isPlaying: boolean;
    skipStartPosition?: boolean;
    selectedCellId: string | null;
    occupiedPositions: Map<string, string>;
    /** "auto" = zoom to enabled cells, "full" = show entire 4x4 grid */
    zoomMode?: "auto" | "full";
    onSelectCell: (cellId: string) => void;
    onSetCellSpan: (cellId: string, colSpan: number, rowSpan: number, newCol?: number, newRow?: number) => void;
    onToggleCell?: (row: number, col: number) => void;
  } = $props();

  // Resize direction type
  type ResizeDirection = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

  // Resize state
  let resizeState = $state<{
    cellId: string;
    direction: ResizeDirection;
    startX: number;
    startY: number;
    originalCol: number;
    originalRow: number;
    originalColSpan: number;
    originalRowSpan: number;
    targetCol: number;
    targetRow: number;
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
  // In "full" zoom mode, always show the entire 4x4 grid
  const gridBounds = $derived.by(() => {
    // In full zoom mode, always show entire 4x4
    if (zoomMode === "full") {
      return { minRow: 0, maxRow: GRID_SIZE - 1, minCol: 0, maxCol: GRID_SIZE - 1, rows: GRID_SIZE, cols: GRID_SIZE };
    }

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
    direction: ResizeDirection,
    e: PointerEvent
  ) {
    const cell = enabledCells.find((c) => c.id === cellId);
    if (!cell) return;

    resizeState = {
      cellId,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      originalCol: cell.col,
      originalRow: cell.row,
      originalColSpan: cell.colSpan,
      originalRowSpan: cell.rowSpan,
      targetCol: cell.col,
      targetRow: cell.row,
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

    const gap = 16;
    const unitSize = cellSize + gap;
    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    let targetCol = state.originalCol;
    let targetRow = state.originalRow;
    let targetColSpan = state.originalColSpan;
    let targetRowSpan = state.originalRowSpan;

    const dir = state.direction;

    // Handle horizontal resizing
    if (dir === "left" || dir === "top-left" || dir === "bottom-left") {
      // Dragging left edge: negative delta = expand left, positive = shrink
      const colDelta = Math.round(deltaX / unitSize);
      const newCol = Math.max(0, state.originalCol + colDelta);
      const colChange = state.originalCol - newCol;
      targetCol = newCol;
      targetColSpan = Math.max(1, state.originalColSpan + colChange);
    } else if (dir === "right" || dir === "top-right" || dir === "bottom-right") {
      // Dragging right edge: positive delta = expand right
      const colDelta = Math.round(deltaX / unitSize);
      targetColSpan = Math.max(1, Math.min(GRID_SIZE - state.originalCol, state.originalColSpan + colDelta));
    }

    // Handle vertical resizing
    if (dir === "top" || dir === "top-left" || dir === "top-right") {
      // Dragging top edge: negative delta = expand up, positive = shrink
      const rowDelta = Math.round(deltaY / unitSize);
      const newRow = Math.max(0, state.originalRow + rowDelta);
      const rowChange = state.originalRow - newRow;
      targetRow = newRow;
      targetRowSpan = Math.max(1, state.originalRowSpan + rowChange);
    } else if (dir === "bottom" || dir === "bottom-left" || dir === "bottom-right") {
      // Dragging bottom edge: positive delta = expand down
      const rowDelta = Math.round(deltaY / unitSize);
      targetRowSpan = Math.max(1, Math.min(GRID_SIZE - state.originalRow, state.originalRowSpan + rowDelta));
    }

    // Ensure we don't exceed grid bounds
    if (targetCol + targetColSpan > GRID_SIZE) {
      targetColSpan = GRID_SIZE - targetCol;
    }
    if (targetRow + targetRowSpan > GRID_SIZE) {
      targetRowSpan = GRID_SIZE - targetRow;
    }

    // Always valid - we'll absorb any cells that get in the way
    const isValid = true;

    resizeState = { ...state, targetCol, targetRow, targetColSpan, targetRowSpan, isValid };
  }

  function handleResizeEnd() {
    if (resizeState && resizeState.isValid) {
      const { cellId, targetCol, targetRow, targetColSpan, targetRowSpan, originalCol, originalRow, originalColSpan, originalRowSpan } =
        resizeState;
      // Only update if something actually changed
      if (
        targetCol !== originalCol ||
        targetRow !== originalRow ||
        targetColSpan !== originalColSpan ||
        targetRowSpan !== originalRowSpan
      ) {
        onSetCellSpan(cellId, targetColSpan, targetRowSpan, targetCol, targetRow);
      }
    }

    resizeState = null;

    // Remove global listeners
    window.removeEventListener("pointermove", handleResizeMove);
    window.removeEventListener("pointerup", handleResizeEnd);
    window.removeEventListener("pointercancel", handleResizeEnd);
  }

  // Only show ghost when something has actually changed from original
  const showGhost = $derived.by(() => {
    const state = resizeState;
    if (!state) return false;
    return (
      state.targetCol !== state.originalCol ||
      state.targetRow !== state.originalRow ||
      state.targetColSpan !== state.originalColSpan ||
      state.targetRowSpan !== state.originalRowSpan
    );
  });

  // Calculate ghost position and size in pixels (absolute positioning)
  const ghostStyle = $derived.by(() => {
    const state = resizeState;
    if (!state) return "";

    const gap = 16;
    const unit = cellSize + gap;

    // Position relative to TARGET position in the grid (not current cell position)
    const colOffset = state.targetCol - gridBounds.minCol;
    const rowOffset = state.targetRow - gridBounds.minRow;

    const left = colOffset * unit;
    const top = rowOffset * unit;
    const width =
      state.targetColSpan * cellSize + (state.targetColSpan - 1) * gap;
    const height =
      state.targetRowSpan * cellSize + (state.targetRowSpan - 1) * gap;

    return `left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;`;
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
              <!-- Key by cell ID AND layer sequence IDs to force re-render when content changes -->
              {#key `${cell.id}-${cell.layers.map(l => l.sequence.id || l.sequence.word).join('-')}`}
                <CellCanvas
                  {cell}
                  cellIndex={getCellDisplayIndex(cell)}
                  {currentBeat}
                  {isPlaying}
                  {skipStartPosition}
                  isSelected={selectedCellId === cell.id}
                  onSelect={() => onSelectCell(cell.id)}
                />
              {/key}

              <CellResizeHandles
                cellId={cell.id}
                canResizeLeft={cell.colSpan > 1 || cell.col > 0}
                canResizeRight={cell.colSpan > 1 || cell.col + cell.colSpan < GRID_SIZE}
                canResizeTop={cell.rowSpan > 1 || cell.row > 0}
                canResizeBottom={cell.rowSpan > 1 || cell.row + cell.rowSpan < GRID_SIZE}
                onResizeStart={handleResizeStart}
              />
            </div>
          {:else if isOccupied}
            <!-- Skip - this position is covered by a spanning cell -->
          {:else if zoomMode === "full"}
            <!-- In full mode, show clickable empty slot to enable cell -->
            <button
              class="cell-slot-empty"
              onclick={() => onToggleCell?.(row, col)}
              aria-label="Enable cell at row {row + 1}, column {col + 1}"
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          {:else}
            <div class="cell-placeholder"></div>
          {/if}
        {/each}
      {/each}

      <!-- Ghost preview during resize (absolute positioned to avoid layout shifts) -->
      {#if showGhost && resizeState}
        <div
          class="resize-ghost"
          class:invalid={!resizeState.isValid}
          style={ghostStyle}
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
    position: relative; /* For absolute positioned ghost */
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

  /* Clickable empty slot in full grid mode */
  .cell-slot-empty {
    width: var(--cell-size, 200px);
    height: var(--cell-size, 200px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .cell-slot-empty i {
    font-size: 1.5rem;
    opacity: 0.5;
    transition: opacity 0.15s ease;
  }

  .cell-slot-empty:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-accent, #8b5cf6);
  }

  .cell-slot-empty:hover i {
    opacity: 1;
  }

  .cell-slot-empty:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
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

  /* Resize ghost preview - absolute positioned to avoid layout shifts */
  .resize-ghost {
    position: absolute;
    background: var(--theme-accent, #8b5cf6);
    opacity: 0.2;
    border: 2px dashed var(--theme-accent, #8b5cf6);
    border-radius: var(--border-radius-md, 8px);
    pointer-events: none;
    z-index: 15;
  }

  .resize-ghost.invalid {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }
</style>
