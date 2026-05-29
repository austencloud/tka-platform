<!--
  CompositionCanvas.svelte

  Interactive canvas for composition layout editing.
  Supports:
  - Drag to move cells
  - Resize handles on all edges
  - Snap guides during manipulation
  - Z-index visualization
  - Spacebar + drag to pan the viewport
-->
<script lang="ts">
  import type { ConstraintCell, DragState, ContainerBounds } from "../domain/types";
  import { generateSnapGuides, findSnapPosition } from "../services/constraint-solver";

  let {
    cells,
    containerBounds,
    selectedCellIds,
    onSelectCell,
    onUpdateCellPosition,
    onUpdateCellSize,
    onDuplicateCell,
    onDragStart,
  }: {
    cells: ConstraintCell[];
    containerBounds: ContainerBounds;
    selectedCellIds: Set<string>;
    onSelectCell: (cellId: string | null, additive?: boolean) => void;
    onUpdateCellPosition: (cellId: string, x: number, y: number) => void;
    onUpdateCellSize: (cellId: string, width: number, height: number, x?: number, y?: number) => void;
    onDuplicateCell: (cellId: string, x: number, y: number) => string;
    onDragStart?: () => void;
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

  // ── Viewport pan & zoom state ──
  let panX = $state(0);
  let panY = $state(0);
  let zoom = $state(1);
  let spaceHeld = $state(false);
  let isPanning = $state(false);
  let panStartX = 0;
  let panStartY = 0;
  let panStartOffsetX = 0;
  let panStartOffsetY = 0;

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.1;

  // Zoom indicator fade
  let showZoomIndicator = $state(false);
  let zoomIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;
  const zoomPercent = $derived(Math.round(zoom * 100));

  // Listen for spacebar to enter pan mode
  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === "Space" && !e.repeat) {
      // Don't hijack space if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      e.stopPropagation();
      spaceHeld = true;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === "Space") {
      e.preventDefault();
      e.stopPropagation();
      spaceHeld = false;
      // If we were mid-pan, end it
      if (isPanning) {
        endPan();
      }
    }
  }

  // Attach/detach global keyboard listeners
  // Use capture phase so we intercept before anything else can react
  $effect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  });

  // Track the active pan pointer so we can release capture reliably
  let panPointerId: number | null = null;

  function startPan(e: PointerEvent) {
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartOffsetX = panX;
    panStartOffsetY = panY;
    panPointerId = e.pointerId;

    // Capture on the container element, not the clicked child.
    // This prevents capture from being lost if the child is removed/hidden.
    if (containerEl) {
      containerEl.setPointerCapture(e.pointerId);
    }

    window.addEventListener("pointermove", handlePanMove);
    window.addEventListener("pointerup", handlePanUp);
    window.addEventListener("pointercancel", handlePanCancel);
  }

  function handlePanMove(e: PointerEvent) {
    if (!isPanning) return;
    panX = panStartOffsetX + (e.clientX - panStartX);
    panY = panStartOffsetY + (e.clientY - panStartY);
  }

  function handlePanUp(e: PointerEvent) {
    releasePanCapture();
    endPan();
  }

  function handlePanCancel(_e: PointerEvent) {
    // Browser killed our pointer (touch gesture, focus loss, etc.)
    // Keep the current pan position, just stop the drag cleanly
    releasePanCapture();
    endPan();
  }

  function releasePanCapture() {
    if (containerEl && panPointerId !== null) {
      try {
        containerEl.releasePointerCapture(panPointerId);
      } catch {
        // Already released - ignore
      }
    }
    panPointerId = null;
  }

  function endPan() {
    isPanning = false;
    window.removeEventListener("pointermove", handlePanMove);
    window.removeEventListener("pointerup", handlePanUp);
    window.removeEventListener("pointercancel", handlePanCancel);
  }

  // Suppress context menu during pan (Chrome mobile emulation long-press)
  function handleContextMenu(e: MouseEvent) {
    if (spaceHeld || isPanning) {
      e.preventDefault();
    }
  }

  // ── Zoom via Alt + scroll wheel ──
  function handleWheel(e: WheelEvent) {
    if (!e.altKey) return;

    e.preventDefault();

    // Determine zoom direction: scroll up = zoom in, scroll down = zoom out
    const direction = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + direction * ZOOM_STEP));
    if (newZoom === zoom) return;

    // Zoom toward cursor: keep the point under the cursor fixed.
    // The viewport transform is: translate(panX, panY) then scale(zoom).
    // A world point P maps to screen as: screen = P * zoom + pan
    // To keep the cursor's world point fixed after zoom change:
    //   cursorScreen = worldPt * oldZoom + oldPan
    //   cursorScreen = worldPt * newZoom + newPan
    // => newPan = cursorScreen - worldPt * newZoom
    //           = cursorScreen - (cursorScreen - oldPan) / oldZoom * newZoom
    const rect = containerEl?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const worldX = (cursorX - panX) / zoom;
    const worldY = (cursorY - panY) / zoom;

    panX = cursorX - worldX * newZoom;
    panY = cursorY - worldY * newZoom;
    zoom = newZoom;

    // Flash zoom indicator
    showZoomIndicator = true;
    if (zoomIndicatorTimeout) clearTimeout(zoomIndicatorTimeout);
    zoomIndicatorTimeout = setTimeout(() => {
      showZoomIndicator = false;
    }, 800);
  }

  // ── Canvas pointer down ──
  // If space is held, start panning instead of deselecting
  function handleCanvasPointerDown(e: PointerEvent) {
    if (spaceHeld) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e);
    }
  }

  function handleCanvasClick() {
    // Don't deselect if we just finished panning
    if (spaceHeld || isPanning) return;
    onSelectCell(null);
  }

  // ── Cell interactions ──

  function handleCellPointerDown(cell: ConstraintCell, e: PointerEvent) {
    // If space is held, pan instead of moving the cell
    if (spaceHeld) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e);
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    // Snapshot for undo before any mutation
    onDragStart?.();

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Alt + drag = duplicate
    let duplicateId: string | undefined;
    let targetCellId = cell.id;

    if (e.altKey) {
      duplicateId = onDuplicateCell(cell.id, cell.computed.x, cell.computed.y);
      targetCellId = duplicateId;
    }

    // Ctrl/Cmd+click = add to selection (Shift is reserved for axis-constrain)
    const additive = e.ctrlKey || e.metaKey;
    onSelectCell(targetCellId, additive);

    dragState = {
      cellId: targetCellId,
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      startCellBounds: { ...cell.computed },
      activeSnapGuides: [],
      duplicateId,
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleResizePointerDown(
    cell: ConstraintCell,
    handle: DragState["handle"],
    e: PointerEvent
  ) {
    // If space is held, pan instead of resizing
    if (spaceHeld) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e);
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    // Snapshot for undo before any mutation
    onDragStart?.();

    onSelectCell(cell.id, e.ctrlKey || e.metaKey);

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

    // Convert screen-space delta to world-space by dividing by zoom
    const deltaX = (e.clientX - state.startX) / zoom;
    const deltaY = (e.clientY - state.startY) / zoom;

    // Generate snap guides
    const guides = generateSnapGuides(cells, containerBounds, state.cellId);

    if (state.mode === "move") {
      let newX = state.startCellBounds.x + deltaX;
      let newY = state.startCellBounds.y + deltaY;

      const shiftHeld = e.shiftKey;
      const ctrlHeld = e.ctrlKey || e.metaKey;

      // Shift + drag = constrain to horizontal or vertical
      if (shiftHeld) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newY = state.startCellBounds.y;
        } else {
          newX = state.startCellBounds.x;
        }
      }

      // Ctrl + drag = free movement (skip snapping)
      if (!ctrlHeld) {
        const snapX = findSnapPosition(newX, guides.x);
        const snapXRight = findSnapPosition(newX + cell.computed.width, guides.x);
        const snapXCenter = findSnapPosition(newX + cell.computed.width / 2, guides.x);

        const snapY = findSnapPosition(newY, guides.y);
        const snapYBottom = findSnapPosition(newY + cell.computed.height, guides.y);
        const snapYCenter = findSnapPosition(newY + cell.computed.height / 2, guides.y);

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
      } else {
        activeSnapGuidesX = [];
        activeSnapGuidesY = [];
      }

      onUpdateCellPosition(state.cellId, newX, newY);
    } else if (state.mode === "resize" && state.handle) {
      let { x, y, width, height } = state.startCellBounds;
      const handle = state.handle;
      const isCorner = handle.includes("-");
      const shiftHeld = e.shiftKey;

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
        const snappedSize = findSnapPosition(size, guides.x).snapped;

        if (handle === "top-left") {
          x = state.startCellBounds.x + state.startCellBounds.width - snappedSize;
          y = state.startCellBounds.y + state.startCellBounds.height - snappedSize;
        } else if (handle === "top-right") {
          y = state.startCellBounds.y + state.startCellBounds.height - snappedSize;
        } else if (handle === "bottom-left") {
          x = state.startCellBounds.x + state.startCellBounds.width - snappedSize;
        }

        width = snappedSize;
        height = snappedSize;
      }

      onUpdateCellSize(state.cellId, width, height, x, y);
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (e.target instanceof HTMLElement) {
      e.target.releasePointerCapture(e.pointerId);
    }

    dragState = null;
    activeSnapGuidesX = [];
    activeSnapGuidesY = [];

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }
</script>

<div
  class="composition-canvas"
  class:pan-mode={spaceHeld}
  class:panning={isPanning}
  bind:this={containerEl}
  onpointerdown={handleCanvasPointerDown}
  onclick={handleCanvasClick}
  oncontextmenu={handleContextMenu}
  onwheel={handleWheel}
  style:background-position="{panX}px {panY}px"
  style:background-size="{50 * zoom}px {50 * zoom}px"
  role="presentation"
>
  <!-- Zoom indicator -->
  {#if showZoomIndicator}
    <div class="zoom-indicator">{zoomPercent}%</div>
  {/if}

  <!-- Pannable + zoomable viewport layer -->
  <div
    class="viewport"
    style:transform="translate({panX}px, {panY}px) scale({zoom})"
    style:transform-origin="0 0"
  >
    <!-- Cells -->
    {#each sortedCells as cell (cell.id)}
      {@const isSelected = selectedCellIds.has(cell.id)}
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
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCell(cell.id, e.ctrlKey || e.metaKey); } }}
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
          {:else if cell.mediaType === "viewer-3d"}
            <i class="fas fa-cube cell-icon" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-square cell-icon" aria-hidden="true"></i>
          {/if}
          <span class="cell-label">{cell.label}</span>
        </div>

        <!-- svelte-ignore a11y_no_static_element_interactions -->
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
</div>

<style>
  .composition-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;

    /* Grid pattern background moves with pan via background-position */
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
    background-size: 50px 50px;
  }

  /* Pan mode: grab cursor + suppress browser gestures */
  .composition-canvas.pan-mode {
    cursor: grab;
    touch-action: none;
  }

  .composition-canvas.panning {
    cursor: grabbing;
    touch-action: none;
    user-select: none;
  }

  /* Override cell cursors when in pan mode */
  .composition-canvas.pan-mode .cell,
  .composition-canvas.panning .cell {
    cursor: inherit;
  }

  .composition-canvas.pan-mode .resize-handle,
  .composition-canvas.panning .resize-handle {
    cursor: inherit;
  }

  .viewport {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    will-change: transform;
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
    touch-action: none;
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

  /* Resize handles - touch target for WCAG AAA compliance */
  .resize-handle {
    position: absolute;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    z-index: 10;
    touch-action: none;
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

  /* Zoom indicator */
  .zoom-indicator {
    position: absolute;
    bottom: 16px;
    right: 16px;
    z-index: 200;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border-radius: var(--border-radius-md, 8px);
    pointer-events: none;
    animation: zoom-fade 0.8s ease-out forwards;
  }

  @keyframes zoom-fade {
    0% { opacity: 1; }
    70% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .cell,
    .resize-handle {
      transition: none;
    }

    .zoom-indicator {
      animation: none;
      opacity: 1;
    }
  }
</style>
