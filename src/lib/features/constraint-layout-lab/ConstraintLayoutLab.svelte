<!--
  ConstraintLayoutLab.svelte

  Interactive lab for testing constraint-based layout engine.
  Features:
  - Preset layouts
  - Drag-to-move and resize cells
  - Snap guides
  - Z-index layering
  - Cell inspector
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import ConstraintCanvas from "./components/ConstraintCanvas.svelte";
  import PresetPicker from "./components/PresetPicker.svelte";
  import CellInspector from "./components/CellInspector.svelte";
  import { LAYOUT_PRESETS, resetCellIdCounter } from "./services/LayoutPresets";
  import { solveConstraints, GRID_SIZE } from "./services/ConstraintSolver";
  import type { ConstraintCell, ContainerBounds, LayoutPreset, Constraint, SizeConstraint } from "./domain/types";

  // Container dimensions (observed via ResizeObserver)
  let containerEl: HTMLDivElement | null = $state(null);
  let containerBounds = $state<ContainerBounds>({ width: 800, height: 600 });

  // Layout state
  let cells = $state<ConstraintCell[]>([]);
  let selectedCellId = $state<string | null>(null);

  // Selected cell derived
  const selectedCell = $derived(
    selectedCellId ? cells.find((c) => c.id === selectedCellId) ?? null : null
  );

  // Initialize with first preset
  $effect(() => {
    if (cells.length === 0 && containerBounds.width > 0) {
      const firstPreset = LAYOUT_PRESETS[0];
      if (firstPreset) {
        applyPreset(firstPreset);
      }
    }
  });

  // Observe container size
  $effect(() => {
    if (!containerEl || !browser) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      containerBounds = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      // Re-solve constraints when container resizes
      updateComputedPositions();
    });

    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  function applyPreset(preset: LayoutPreset) {
    resetCellIdCounter();
    cells = preset.createCells(containerBounds);
    updateComputedPositions();
    selectedCellId = null;
  }

  function updateComputedPositions() {
    const solved = solveConstraints(cells, containerBounds);
    cells = cells.map((cell) => {
      const computed = solved.get(cell.id);
      if (computed) {
        return { ...cell, computed };
      }
      return cell;
    });
  }

  function handleSelectCell(cellId: string | null) {
    selectedCellId = cellId;
  }

  function handleUpdateCellPosition(cellId: string, x: number, y: number) {
    // Update cell position by modifying constraints to absolute positioning
    cells = cells.map((cell) => {
      if (cell.id !== cellId) return cell;

      // Convert to absolute position constraints
      const newConstraints: Constraint[] = [
        {
          id: `${cellId}-left-abs`,
          cellId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: x,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${cellId}-top-abs`,
          cellId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: y,
          priority: "required",
          relation: "equal",
        },
      ];

      // Preserve size constraints or create from current size
      const sizeConstraints: SizeConstraint[] = cell.sizeConstraints.length > 0
        ? cell.sizeConstraints
        : [
            {
              id: `${cellId}-width`,
              cellId,
              dimension: "width",
              value: cell.computed.width,
              priority: "required",
              relation: "equal",
            },
            {
              id: `${cellId}-height`,
              cellId,
              dimension: "height",
              value: cell.computed.height,
              priority: "required",
              relation: "equal",
            },
          ];

      return {
        ...cell,
        constraints: newConstraints,
        sizeConstraints,
        computed: { ...cell.computed, x, y },
      };
    });
  }

  function handleUpdateCellSize(cellId: string, width: number, height: number, x?: number, y?: number) {
    cells = cells.map((cell) => {
      if (cell.id !== cellId) return cell;

      const newX = x ?? cell.computed.x;
      const newY = y ?? cell.computed.y;

      // Update constraints for absolute positioning
      const newConstraints: Constraint[] = [
        {
          id: `${cellId}-left-abs`,
          cellId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: newX,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${cellId}-top-abs`,
          cellId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: newY,
          priority: "required",
          relation: "equal",
        },
      ];

      const newSizeConstraints: SizeConstraint[] = [
        {
          id: `${cellId}-width`,
          cellId,
          dimension: "width",
          value: width,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${cellId}-height`,
          cellId,
          dimension: "height",
          value: height,
          priority: "required",
          relation: "equal",
        },
      ];

      return {
        ...cell,
        constraints: newConstraints,
        sizeConstraints: newSizeConstraints,
        computed: { x: newX, y: newY, width, height },
      };
    });
  }

  function handleUpdateLabel(label: string) {
    if (!selectedCellId) return;
    cells = cells.map((cell) =>
      cell.id === selectedCellId ? { ...cell, label } : cell
    );
  }

  function handleUpdateZIndex(zIndex: number) {
    if (!selectedCellId) return;
    cells = cells.map((cell) =>
      cell.id === selectedCellId ? { ...cell, zIndex } : cell
    );
  }

  function handleUpdateColor(color: string) {
    if (!selectedCellId) return;
    cells = cells.map((cell) =>
      cell.id === selectedCellId ? { ...cell, color } : cell
    );
  }

  function handleDeleteCell() {
    if (!selectedCellId) return;
    cells = cells.filter((c) => c.id !== selectedCellId);
    selectedCellId = null;
  }

  function handleDuplicateCell() {
    if (!selectedCell) return;

    const newId = `cell-dup-${Date.now()}`;
    const offset = GRID_SIZE; // Snap to grid

    const newCell: ConstraintCell = {
      ...selectedCell,
      id: newId,
      label: `${selectedCell.label} Copy`,
      zIndex: selectedCell.zIndex + 1,
      mediaType: selectedCell.mediaType,
      constraints: [
        {
          id: `${newId}-left-abs`,
          cellId: newId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: selectedCell.computed.x + offset,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-top-abs`,
          cellId: newId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: selectedCell.computed.y + offset,
          priority: "required",
          relation: "equal",
        },
      ],
      sizeConstraints: [
        {
          id: `${newId}-width`,
          cellId: newId,
          dimension: "width",
          value: selectedCell.computed.width,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-height`,
          cellId: newId,
          dimension: "height",
          value: selectedCell.computed.height,
          priority: "required",
          relation: "equal",
        },
      ],
      computed: {
        x: selectedCell.computed.x + offset,
        y: selectedCell.computed.y + offset,
        width: selectedCell.computed.width,
        height: selectedCell.computed.height,
      },
    };

    cells = [...cells, newCell];
    selectedCellId = newId;
  }

  function handleAddCell() {
    const newId = `cell-new-${Date.now()}`;
    const size = GRID_SIZE * 2; // 2 grid units
    const x = Math.round((containerBounds.width - size) / 2 / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((containerBounds.height - size) / 2 / GRID_SIZE) * GRID_SIZE;

    // Cycle through media types for new cells
    const MEDIA_CYCLE: Array<{ label: string; type: "video" | "animation" | "image" | "choreo-card"; color: string }> = [
      { label: "Video", type: "video", color: "#ef4444" },
      { label: "Animation", type: "animation", color: "#8b5cf6" },
      { label: "Image", type: "image", color: "#10b981" },
      { label: "Choreo Card", type: "choreo-card", color: "#3b82f6" },
    ];
    const media = MEDIA_CYCLE[cells.length % MEDIA_CYCLE.length]!;

    const newCell: ConstraintCell = {
      id: newId,
      label: media.label,
      zIndex: cells.length + 1,
      color: media.color,
      mediaType: media.type,
      constraints: [
        {
          id: `${newId}-left`,
          cellId: newId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: x,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-top`,
          cellId: newId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: y,
          priority: "required",
          relation: "equal",
        },
      ],
      sizeConstraints: [
        {
          id: `${newId}-width`,
          cellId: newId,
          dimension: "width",
          value: size,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-height`,
          cellId: newId,
          dimension: "height",
          value: size,
          priority: "required",
          relation: "equal",
        },
      ],
      computed: { x, y, width: size, height: size },
    };

    cells = [...cells, newCell];
    selectedCellId = newId;
  }
</script>

<div class="constraint-layout-lab">
  <header class="lab-header">
    <h1>Constraint Layout Lab</h1>
    <p class="subtitle">
      Experiment with constraint-based positioning. Drag cells to move, grab handles to resize.
    </p>
  </header>

  <div class="lab-content">
    <!-- Canvas area -->
    <div class="canvas-wrapper" bind:this={containerEl}>
      <ConstraintCanvas
        {cells}
        {containerBounds}
        {selectedCellId}
        onSelectCell={handleSelectCell}
        onUpdateCellPosition={handleUpdateCellPosition}
        onUpdateCellSize={handleUpdateCellSize}
      />
    </div>

    <!-- Control panel -->
    <div class="control-panel themed-scrollbar">
      <!-- Add cell button -->
      <button class="add-cell-btn" onclick={handleAddCell}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add Cell
      </button>

      <!-- Presets -->
      <PresetPicker onSelectPreset={applyPreset} />

      <!-- Inspector (when cell selected) -->
      {#if selectedCell}
        <div class="divider"></div>
        <CellInspector
          cell={selectedCell}
          onUpdateLabel={handleUpdateLabel}
          onUpdateZIndex={handleUpdateZIndex}
          onUpdateColor={handleUpdateColor}
          onDeleteCell={handleDeleteCell}
          onDuplicateCell={handleDuplicateCell}
        />
      {:else}
        <div class="no-selection">
          <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
          <p>Click a cell to select it</p>
        </div>
      {/if}

      <!-- Cell count -->
      <div class="cell-count">
        {cells.length} cell{cells.length !== 1 ? "s" : ""}
      </div>
    </div>
  </div>
</div>

<style>
  .constraint-layout-lab {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, white);
  }

  .lab-header {
    padding: var(--spacing-lg, 16px) var(--spacing-xl, 24px);
    flex-shrink: 0;
  }

  .lab-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .subtitle {
    margin: var(--spacing-xs, 4px) 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .lab-content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: var(--spacing-lg, 16px);
    padding: 0 var(--spacing-xl, 24px) var(--spacing-xl, 24px);
    min-height: 0;
  }

  .canvas-wrapper {
    min-height: 400px;
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }

  .control-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow-y: auto;
  }

  .add-cell-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-md, 12px);
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: var(--border-radius-md, 8px);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .add-cell-btn:hover {
    background: var(--theme-accent-hover, #7c3aed);
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: var(--spacing-sm, 8px) 0;
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-xl, 24px);
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .no-selection i {
    font-size: 1.5rem;
  }

  .no-selection p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  .cell-count {
    margin-top: auto;
    padding-top: var(--spacing-md, 12px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  @media (max-width: 768px) {
    .lab-content {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }

    .control-panel {
      max-height: 300px;
    }
  }
</style>
