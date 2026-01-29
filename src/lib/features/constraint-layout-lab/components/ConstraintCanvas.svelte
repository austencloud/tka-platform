<!--
  ConstraintCanvas.svelte

  Interactive canvas for constraint-based layout editing.
  Supports:
  - Drag to move cells
  - Resize handles on all edges
  - Snap guides during manipulation
  - Z-index visualization
-->
<script lang="ts">
  import type { ConstraintCell, DragState, ContainerBounds } from "../domain/types";
  import { generateSnapGuides, findSnapPosition } from "../services/ConstraintSolver";

  let {
    cells,
    containerBounds,
    selectedCellId,
    onSelectCell,
    onUpdateCellPosition,
    onUpdateCellSize,
  }: {
    cells: ConstraintCell[];
    containerBounds: ContainerBounds;
    selectedCellId: string | null;
    onSelectCell: (cellId: string | null) => void;
    onUpdateCellPosition: (cellId: string, x: number, y: number) => void;
    onUpdateCellSize: (cellId: string, width: number, height: number, x?: number, y?: number) => void;
  } = $props();

  // Container reference
  let containerEl: HTMLDivElement | null = $state(null);

  // Drag state
  let dragState = $state<DragState | null>(null);

  // Active snap guides during drag
  let activeSnapGuidesX = $state<number[]>([]);
  let activeSnapGuidesY = $state<number[]>([]);

  // Sort cells by z-index for rendering
  const sortedCells = $derived(
    [...cells].sort((a, b) => a.zIndex - b.zIndex)
  );

  // Track which cell is being hovered
  let hoveredCellId = $state<string | null>(null);

  function handleCellPointerDown(cell: ConstraintCell, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    onSelectCell(cell.id);

    // Capture pointer for reliable drag on touch devices
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Start move drag
    dragState = {
      cellId: cell.id,
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      startCellBounds: { ...cell.computed },
      activeSnapGuides: [],
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleResizePointerDown(
    cell: ConstraintCell,
    handle: DragState["handle"],
    e: PointerEvent
  ) {
    e.stopPropagation();
    e.preventDefault();
    onSelectCell(cell.id);

    // Capture pointer for reliable drag on touch devices
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragState = {
      cellId: cell.id,
      mode: "resize",
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCellBounds: { ...cell.computed },
      activeSnapGuides: [],
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent) {
    const state = dragState;
    if (!state) return;

    const cell = cells.find((c) => c.id === state.cellId);
    if (!cell) return;

    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    // Generate snap guides
    const guides = generateSnapGuides(cells, containerBounds, state.cellId);

    if (state.mode === "move") {
      let newX = state.startCellBounds.x + deltaX;
      let newY = state.startCellBounds.y + deltaY;

      // Snap to guides
      const snapX = findSnapPosition(newX, guides.x);
      const snapXRight = findSnapPosition(newX + cell.computed.width, guides.x);
      const snapXCenter = findSnapPosition(newX + cell.computed.width / 2, guides.x);

      const snapY = findSnapPosition(newY, guides.y);
      const snapYBottom = findSnapPosition(newY + cell.computed.height, guides.y);
      const snapYCenter = findSnapPosition(newY + cell.computed.height / 2, guides.y);

      // Apply snapping (prefer edge snaps over center)
      const snappedX: number[] = [];
      const snappedY: number[] = [];

      if (snapX.guide !== null) {
        newX = snapX.snapped;
        snappedX.push(snapX.guide);
      } else if (snapXRight.guide !== null) {
        newX = snapXRight.snapped - cell.computed.width;
        snappedX.push(snapXRight.guide);
      } else if (snapXCenter.guide !== null) {
        newX = snapXCenter.snapped - cell.computed.width / 2;
        snappedX.push(snapXCenter.guide);
      }

      if (snapY.guide !== null) {
        newY = snapY.snapped;
        snappedY.push(snapY.guide);
      } else if (snapYBottom.guide !== null) {
        newY = snapYBottom.snapped - cell.computed.height;
        snappedY.push(snapYBottom.guide);
      } else if (snapYCenter.guide !== null) {
        newY = snapYCenter.snapped - cell.computed.height / 2;
        snappedY.push(snapYCenter.guide);
      }

      activeSnapGuidesX = snappedX;
      activeSnapGuidesY = snappedY;

      onUpdateCellPosition(state.cellId, newX, newY);
    } else if (state.mode === "resize" && state.handle) {
      let { x, y, width, height } = state.startCellBounds;
      const handle = state.handle;
      const isCorner = handle.includes("-"); // e.g., "top-left", "bottom-right"
      const shiftHeld = e.shiftKey;

      // Adjust based on handle
      if (handle.includes("right")) {
        width = Math.max(50, state.startCellBounds.width + deltaX);
        const snapRight = findSnapPosition(x + width, guides.x);
        if (snapRight.guide !== null) {
          width = snapRight.guide - x;
          activeSnapGuidesX = [snapRight.guide];
        } else {
          activeSnapGuidesX = [];
        }
      }

      if (handle.includes("left")) {
        const newX = state.startCellBounds.x + deltaX;
        const newWidth = state.startCellBounds.width - deltaX;
        if (newWidth >= 50) {
          x = newX;
          width = newWidth;
          const snapLeft = findSnapPosition(x, guides.x);
          if (snapLeft.guide !== null) {
            const diff = snapLeft.guide - x;
            x = snapLeft.guide;
            width -= diff;
            activeSnapGuidesX = [snapLeft.guide];
          } else {
            activeSnapGuidesX = [];
          }
        }
      }

      if (handle.includes("bottom")) {
        height = Math.max(50, state.startCellBounds.height + deltaY);
        const snapBottom = findSnapPosition(y + height, guides.y);
        if (snapBottom.guide !== null) {
          height = snapBottom.guide - y;
          activeSnapGuidesY = [snapBottom.guide];
        } else {
          activeSnapGuidesY = [];
        }
      }

      if (handle.includes("top")) {
        const newY = state.startCellBounds.y + deltaY;
        const newHeight = state.startCellBounds.height - deltaY;
        if (newHeight >= 50) {
          y = newY;
          height = newHeight;
          const snapTop = findSnapPosition(y, guides.y);
          if (snapTop.guide !== null) {
            const diff = snapTop.guide - y;
            y = snapTop.guide;
            height -= diff;
            activeSnapGuidesY = [snapTop.guide];
          } else {
            activeSnapGuidesY = [];
          }
        }
      }

      // Shift + corner drag = constrain to square
      if (shiftHeld && isCorner) {
        const size = Math.max(width, height);
        // Snap the square size to grid
        const snappedSize = findSnapPosition(size, guides.x).snapped;

        // Adjust position based on which corner is being dragged
        if (handle === "top-left") {
          x = state.startCellBounds.x + state.startCellBounds.width - snappedSize;
          y = state.startCellBounds.y + state.startCellBounds.height - snappedSize;
        } else if (handle === "top-right") {
          y = state.startCellBounds.y + state.startCellBounds.height - snappedSize;
        } else if (handle === "bottom-left") {
          x = state.startCellBounds.x + state.startCellBounds.width - snappedSize;
        }
        // bottom-right: x and y stay the same

        width = snappedSize;
        height = snappedSize;
      }

      onUpdateCellSize(state.cellId, width, height, x, y);
    }
  }

  function handlePointerUp(e: PointerEvent) {
    // Release pointer capture
    if (e.target instanceof HTMLElement) {
      e.target.releasePointerCapture(e.pointerId);
    }

    dragState = null;
    activeSnapGuidesX = [];
    activeSnapGuidesY = [];

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  function handleCanvasClick() {
    onSelectCell(null);
  }
</script>

<div
  class="constraint-canvas"
  bind:this={containerEl}
  onclick={handleCanvasClick}
  role="presentation"
>
  <!-- Cells -->
  {#each sortedCells as cell (cell.id)}
    {@const isSelected = selectedCellId === cell.id}
    {@const isHovered = hoveredCellId === cell.id}
    {@const isDragging = dragState?.cellId === cell.id}
    {@const showHandles = isSelected || isHovered}
    <div
      class="cell"
      class:selected={isSelected}
      class:dragging={isDragging}
      style:left="{cell.computed.x}px"
      style:top="{cell.computed.y}px"
      style:width="{cell.computed.width}px"
      style:height="{cell.computed.height}px"
      style:z-index={cell.zIndex}
      style:--cell-color={cell.color}
      onpointerdown={(e) => handleCellPointerDown(cell, e)}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCell(cell.id); } }}
      onpointerenter={() => hoveredCellId = cell.id}
      onpointerleave={() => { if (hoveredCellId === cell.id) hoveredCellId = null; }}
      role="button"
      tabindex="0"
      aria-label="{cell.label}, z-index {cell.zIndex}"
    >
      <div class="cell-content">
        {#if cell.mediaType === "video"}
          <i class="fas fa-video cell-icon" aria-hidden="true"></i>
        {:else if cell.mediaType === "animation"}
          <i class="fas fa-play-circle cell-icon" aria-hidden="true"></i>
        {:else if cell.mediaType === "image"}
          <i class="fas fa-image cell-icon" aria-hidden="true"></i>
        {:else if cell.mediaType === "choreo-card"}
          <i class="fas fa-th cell-icon" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-square cell-icon" aria-hidden="true"></i>
        {/if}
        <span class="cell-label">{cell.label}</span>
      </div>

      <!-- Resize handles (on hover or selected) -->
      {#if showHandles}
        <div
          class="resize-handle top-left"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "top-left", e)}
        ></div>
        <div
          class="resize-handle top"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "top", e)}
        ></div>
        <div
          class="resize-handle top-right"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "top-right", e)}
        ></div>
        <div
          class="resize-handle left"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "left", e)}
        ></div>
        <div
          class="resize-handle right"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "right", e)}
        ></div>
        <div
          class="resize-handle bottom-left"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "bottom-left", e)}
        ></div>
        <div
          class="resize-handle bottom"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "bottom", e)}
        ></div>
        <div
          class="resize-handle bottom-right"
          class:selected={isSelected}
          onpointerdown={(e) => handleResizePointerDown(cell, "bottom-right", e)}
        ></div>
      {/if}
    </div>
  {/each}

  <!-- Snap guides -->
  {#each activeSnapGuidesX as x}
    <div class="snap-guide vertical" style:left="{x}px"></div>
  {/each}
  {#each activeSnapGuidesY as y}
    <div class="snap-guide horizontal" style:top="{y}px"></div>
  {/each}
</div>

<style>
  .constraint-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;

    /* Grid pattern background - 50px squares with visible lines */
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
    background-size: 50px 50px;
  }

  .cell {
    position: absolute;
    background: var(--cell-color, #8b5cf6);
    opacity: 0.85;
    border-radius: var(--border-radius-md, 8px);
    cursor: move;
    transition: box-shadow 0.15s ease, opacity 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none; /* Prevent browser touch gestures during drag */
  }

  .cell:hover {
    opacity: 0.95;
  }

  .cell.selected {
    opacity: 1;
    box-shadow:
      0 0 0 2px var(--theme-panel-bg, #12121c),
      0 0 0 4px var(--cell-color, #8b5cf6),
      0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .cell.dragging {
    opacity: 0.9;
    cursor: grabbing;
  }

  .cell-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: white;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }

  .cell-icon {
    font-size: 32px;
    opacity: 0.9;
  }

  .cell-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
  }

  /* Resize handles - 48px touch target for WCAG AAA compliance */
  .resize-handle {
    position: absolute;
    width: 48px;
    height: 48px;
    z-index: 10;
    touch-action: none; /* Prevent browser touch gestures during resize */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Visual dot inside the touch target */
  .resize-handle::after {
    content: "";
    width: 14px;
    height: 14px;
    background: rgba(255, 255, 255, 0.7);
    border: 2px solid var(--cell-color, #8b5cf6);
    border-radius: 50%;
    opacity: 0.7;
    transition: opacity 0.1s ease, transform 0.1s ease;
  }

  .resize-handle.selected::after {
    background: white;
    opacity: 1;
  }

  .resize-handle:hover::after {
    transform: scale(1.3);
    opacity: 1;
  }

  .resize-handle.top-left {
    top: -24px;
    left: -24px;
    cursor: nwse-resize;
  }

  .resize-handle.top {
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    cursor: ns-resize;
  }

  .resize-handle.top-right {
    top: -24px;
    right: -24px;
    cursor: nesw-resize;
  }

  .resize-handle.left {
    top: 50%;
    left: -24px;
    transform: translateY(-50%);
    cursor: ew-resize;
  }

  .resize-handle.right {
    top: 50%;
    right: -24px;
    transform: translateY(-50%);
    cursor: ew-resize;
  }

  .resize-handle.bottom-left {
    bottom: -24px;
    left: -24px;
    cursor: nesw-resize;
  }

  .resize-handle.bottom {
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    cursor: ns-resize;
  }

  .resize-handle.bottom-right {
    bottom: -24px;
    right: -24px;
    cursor: nwse-resize;
  }

  /* Snap guides - high visibility */
  .snap-guide {
    position: absolute;
    background: #f59e0b;
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 0 4px 1px rgba(245, 158, 11, 0.5);
  }

  .snap-guide.vertical {
    width: 2px;
    top: 0;
    bottom: 0;
  }

  .snap-guide.horizontal {
    height: 2px;
    left: 0;
    right: 0;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .cell,
    .resize-handle {
      transition: none;
    }
  }
</style>
