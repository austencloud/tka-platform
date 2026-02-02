<!--
  CompositionLab.svelte

  Composition Lab for designing layout presets.
  Presets created here will be offered to users in a simplified picker.
  Features:
  - Preset layouts
  - Drag-to-move and resize cells
  - Snap guides
  - Z-index layering
  - Cell inspector
  - Persistence (survives refresh)
  - Custom preset saving
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import CompositionCanvas from "./components/CompositionCanvas.svelte";
  import PresetPicker from "./components/PresetPicker.svelte";
  import CellInspector from "./components/CellInspector.svelte";
  import { LAYOUT_PRESETS, resetCellIdCounter, findPresetById } from "./services/LayoutPresets";
  import { solveConstraints, GRID_SIZE } from "./services/ConstraintSolver";
  import {
    saveLayoutState,
    loadLayoutState,
    loadCustomPresets,
    saveCustomPreset,
    deleteCustomPreset,
    customPresetToLayoutPreset,
    exportLayoutAsJSON,
    type CustomPreset,
  } from "./services/LayoutPersistence";
  import type { ConstraintCell, ContainerBounds, LayoutPreset, Constraint, SizeConstraint, CellMediaType } from "./domain/types";

  // Props
  interface Props {
    /** Optional preset ID to apply on mount */
    initialPresetId?: string;
  }

  let { initialPresetId }: Props = $props();

  // Container dimensions (observed via ResizeObserver)
  let containerEl: HTMLDivElement | null = $state(null);
  let containerBounds = $state<ContainerBounds>({ width: 800, height: 600 });

  // Layout state
  let cells = $state<ConstraintCell[]>([]);
  let selectedCellIds = $state<Set<string>>(new Set());

  // ── Undo/Redo history ──
  const MAX_HISTORY = 50;
  let undoStack: ConstraintCell[][] = [];
  let redoStack: ConstraintCell[][] = [];

  /** Snapshot current cells before a mutation. Call this before changing `cells`. */
  function pushUndo() {
    undoStack.push($state.snapshot(cells) as ConstraintCell[]);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // Any new action invalidates the redo stack
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push($state.snapshot(cells) as ConstraintCell[]);
    cells = undoStack.pop()!;
    selectedCellIds = new Set();
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push($state.snapshot(cells) as ConstraintCell[]);
    cells = redoStack.pop()!;
    selectedCellIds = new Set();
  }

  // Custom presets
  let customPresets = $state<CustomPreset[]>([]);

  // Track if we've initialized from persistence
  let initialized = $state(false);

  // Save preset dialog state
  let showSaveDialog = $state(false);
  let newPresetName = $state("");
  let newPresetDescription = $state("");
  let newPresetIcon = $state("bookmark");

  // Selected cells derived (for inspector - shows first selected, or null if multiple/none)
  const selectedCell = $derived(
    selectedCellIds.size === 1
      ? cells.find((c) => selectedCellIds.has(c.id)) ?? null
      : null
  );

  // For display purposes
  const selectedCount = $derived(selectedCellIds.size);

  // Combined presets (built-in + custom)
  const allPresets = $derived<LayoutPreset[]>([
    ...LAYOUT_PRESETS,
    ...customPresets.map(customPresetToLayoutPreset),
  ]);

  // Track if initial preset has been applied
  let initialPresetApplied = $state(false);

  // Load persisted state on mount
  $effect(() => {
    if (!browser || initialized) return;

    // Load custom presets
    customPresets = loadCustomPresets();

    // Check if we have an initial preset to apply
    if (initialPresetId && !initialPresetApplied && containerBounds.width > 0) {
      // Find the preset (check built-in first, then custom)
      let preset = findPresetById(initialPresetId);
      if (!preset) {
        const customPreset = customPresets.find((p) => p.id === initialPresetId);
        if (customPreset) {
          preset = customPresetToLayoutPreset(customPreset);
        }
      }

      if (preset) {
        resetCellIdCounter();
        cells = preset.createCells(containerBounds);
        updateComputedPositions();
        selectedCellIds = new Set();
        initialPresetApplied = true;
        initialized = true;
        return;
      }
    }

    // Load layout state
    const savedState = loadLayoutState();
    if (savedState && savedState.cells.length > 0) {
      cells = savedState.cells;
      // Convert single selectedCellId to Set for backwards compatibility
      selectedCellIds = savedState.selectedCellId
        ? new Set([savedState.selectedCellId])
        : new Set();
      initialized = true;
    } else if (containerBounds.width > 0) {
      // No saved state - start with empty canvas (user creates all presets from scratch)
      cells = [];
      initialized = true;
    }
  });

  // Save state whenever cells or selection changes
  $effect(() => {
    if (!browser || !initialized) return;
    // Save first selected cell for backwards compatibility with persistence format
    const firstSelected = selectedCellIds.size > 0 ? [...selectedCellIds][0] : null;
    saveLayoutState(cells, firstSelected ?? null);
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

  // ── Keyboard shortcuts (Delete, Undo, Redo) ──
  function handleGlobalKeyDown(e: KeyboardEvent) {
    // Skip if user is in an input field
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    // Delete / Backspace = delete selected cells
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedCellIds.size > 0) {
        e.preventDefault();
        pushUndo();
        handleDeleteCell();
      }
      return;
    }

    // Ctrl+Z / Cmd+Z = undo, Ctrl+Shift+Z / Cmd+Shift+Z = redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    // Ctrl+Y / Cmd+Y = redo (Windows convention)
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      redo();
      return;
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  function applyPreset(preset: LayoutPreset) {
    pushUndo();
    resetCellIdCounter();
    cells = preset.createCells(containerBounds);
    updateComputedPositions();
    selectedCellIds = new Set();
  }

  /** Called by canvas at the start of a drag (move or resize). Snapshots for undo. */
  function handleDragStart() {
    pushUndo();
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

  /**
   * Handle cell selection with multi-select support
   * - Normal click: select only this cell
   * - Ctrl/Cmd+click: toggle this cell in selection
   * - Shift+click: add to selection (range not needed for non-list)
   * - Click on empty: clear selection
   */
  function handleSelectCell(cellId: string | null, additive: boolean = false) {
    if (cellId === null) {
      // Clicked on empty space
      selectedCellIds = new Set();
    } else if (additive) {
      // Ctrl/Shift+click: toggle in selection
      const newSet = new Set(selectedCellIds);
      if (newSet.has(cellId)) {
        newSet.delete(cellId);
      } else {
        newSet.add(cellId);
      }
      selectedCellIds = newSet;
    } else {
      // Normal click: select only this cell
      selectedCellIds = new Set([cellId]);
    }
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
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, label } : cell
    );
  }

  function handleUpdateZIndex(zIndex: number) {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, zIndex } : cell
    );
  }

  function handleUpdateColor(color: string) {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, color } : cell
    );
  }

  function handleUpdateMediaType(mediaType: CellMediaType) {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, mediaType } : cell
    );
  }

  function handleDeleteCell() {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.filter((c) => !selectedCellIds.has(c.id));
    selectedCellIds = new Set();
  }

  /** Duplicate cell at specific position (used by Alt+drag) - returns new cell ID */
  function handleDuplicateCellAt(cellId: string, x: number, y: number): string {
    const sourceCell = cells.find((c) => c.id === cellId);
    if (!sourceCell) return cellId;

    const newId = `cell-dup-${Date.now()}`;

    const newCell: ConstraintCell = {
      ...sourceCell,
      id: newId,
      label: `${sourceCell.label} Copy`,
      zIndex: Math.max(...cells.map((c) => c.zIndex)) + 1,
      mediaType: sourceCell.mediaType,
      constraints: [
        {
          id: `${newId}-left-abs`,
          cellId: newId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: x,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-top-abs`,
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
          value: sourceCell.computed.width,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-height`,
          cellId: newId,
          dimension: "height",
          value: sourceCell.computed.height,
          priority: "required",
          relation: "equal",
        },
      ],
      computed: {
        x,
        y,
        width: sourceCell.computed.width,
        height: sourceCell.computed.height,
      },
    };

    cells = [...cells, newCell];
    return newId;
  }

  /** Duplicate selected cell with offset (used by button) */
  function handleDuplicateCell() {
    if (!selectedCell) return;
    pushUndo();

    const offset = GRID_SIZE;
    const newId = handleDuplicateCellAt(
      selectedCell.id,
      selectedCell.computed.x + offset,
      selectedCell.computed.y + offset
    );
    selectedCellIds = new Set([newId]);
  }

  function handleAddCell() {
    pushUndo();
    const newId = `cell-new-${Date.now()}`;
    const size = GRID_SIZE * 2; // 2 grid units
    const x = Math.round((containerBounds.width - size) / 2 / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((containerBounds.height - size) / 2 / GRID_SIZE) * GRID_SIZE;

    // Cycle through media types for new cells
    const MEDIA_CYCLE: Array<{ label: string; type: "video" | "animation" | "image" | "choreo-card" | "viewer-3d"; color: string }> = [
      { label: "Video", type: "video", color: "#ef4444" },
      { label: "Animation", type: "animation", color: "#8b5cf6" },
      { label: "Image", type: "image", color: "#10b981" },
      { label: "Choreo Card", type: "choreo-card", color: "#3b82f6" },
      { label: "3D Viewer", type: "viewer-3d", color: "#f59e0b" },
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
    selectedCellIds = new Set([newId]);
  }

  function handleSaveAsPreset() {
    if (!newPresetName.trim()) return;

    const preset = saveCustomPreset(
      newPresetName.trim(),
      newPresetDescription.trim() || `Custom layout with ${cells.length} cells`,
      newPresetIcon,
      cells,
      containerBounds
    );

    customPresets = [...customPresets, preset];

    // Reset dialog
    showSaveDialog = false;
    newPresetName = "";
    newPresetDescription = "";
    newPresetIcon = "bookmark";
  }

  function handleDeletePreset(presetId: string) {
    deleteCustomPreset(presetId);
    customPresets = customPresets.filter((p) => p.id !== presetId);
  }

  function handleCancelSaveDialog() {
    showSaveDialog = false;
    newPresetName = "";
    newPresetDescription = "";
    newPresetIcon = "bookmark";
  }

  let exportStatus = $state<"idle" | "copied" | "error">("idle");

  async function handleExportLayout() {
    if (cells.length === 0) return;

    const exported = exportLayoutAsJSON(
      cells,
      containerBounds,
      "Exported Layout",
      `${cells.length} cells`,
      "bookmark"
    );

    const json = JSON.stringify(exported, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      exportStatus = "copied";
      setTimeout(() => {
        exportStatus = "idle";
      }, 2000);
    } catch {
      exportStatus = "error";
      setTimeout(() => {
        exportStatus = "idle";
      }, 2000);
    }
  }

  const ICON_OPTIONS = [
    "bookmark",
    "star",
    "heart",
    "folder",
    "layer-group",
    "th-large",
    "border-all",
    "object-group",
  ];
</script>

<div class="composition-lab">
  <header class="lab-header">
    <h1>Composition Lab</h1>
    <p class="subtitle">
      Drag to move, handles to resize. Shift=constrain, Alt+drag=duplicate, Ctrl=free move, Space+drag=pan, Alt+scroll=zoom.
    </p>
  </header>

  <div class="lab-content">
    <!-- Canvas area -->
    <div class="canvas-wrapper" bind:this={containerEl}>
      <CompositionCanvas
        {cells}
        {containerBounds}
        {selectedCellIds}
        onSelectCell={handleSelectCell}
        onUpdateCellPosition={handleUpdateCellPosition}
        onUpdateCellSize={handleUpdateCellSize}
        onDuplicateCell={handleDuplicateCellAt}
        onDragStart={handleDragStart}
      />
    </div>

    <!-- Control panel -->
    <div class="control-panel themed-scrollbar">
      <!-- Add cell button -->
      <button class="add-cell-btn" onclick={handleAddCell}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add Cell
      </button>

      <!-- Export button -->
      <button
        class="export-btn"
        class:copied={exportStatus === "copied"}
        class:error={exportStatus === "error"}
        onclick={handleExportLayout}
        disabled={cells.length === 0}
      >
        {#if exportStatus === "copied"}
          <i class="fas fa-check" aria-hidden="true"></i>
          Copied!
        {:else if exportStatus === "error"}
          <i class="fas fa-times" aria-hidden="true"></i>
          Failed
        {:else}
          <i class="fas fa-copy" aria-hidden="true"></i>
          Export JSON
        {/if}
      </button>

      <!-- Save as preset button -->
      <button class="save-preset-btn" onclick={() => (showSaveDialog = true)} disabled={cells.length === 0}>
        <i class="fas fa-save" aria-hidden="true"></i>
        Save as Preset
      </button>

      <!-- Presets -->
      <PresetPicker
        presets={allPresets}
        onSelectPreset={applyPreset}
        onDeletePreset={handleDeletePreset}
      />

      <!-- Inspector (when cell selected) -->
      {#if selectedCell}
        <div class="divider"></div>
        <CellInspector
          cell={selectedCell}
          onUpdateLabel={handleUpdateLabel}
          onUpdateZIndex={handleUpdateZIndex}
          onUpdateColor={handleUpdateColor}
          onUpdateMediaType={handleUpdateMediaType}
          onDeleteCell={handleDeleteCell}
          onDuplicateCell={handleDuplicateCell}
        />
      {:else if selectedCount > 1}
        <div class="divider"></div>
        <div class="multi-selection">
          <p class="multi-label">{selectedCount} cells selected</p>
          <button class="action-btn danger" onclick={handleDeleteCell}>
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete Selected
          </button>
        </div>
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

  <!-- Save preset dialog -->
  {#if showSaveDialog}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dialog-backdrop" onclick={handleCancelSaveDialog}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="dialog" onclick={(e) => e.stopPropagation()}>
        <h2 class="dialog-title">Save as Preset</h2>

        <div class="form-field">
          <label for="preset-name">Name</label>
          <input
            id="preset-name"
            type="text"
            bind:value={newPresetName}
            placeholder="My Layout"
            maxlength="30"
          />
        </div>

        <div class="form-field">
          <label for="preset-description">Description (optional)</label>
          <input
            id="preset-description"
            type="text"
            bind:value={newPresetDescription}
            placeholder="A custom layout..."
            maxlength="100"
          />
        </div>

        <div class="form-field">
          <label>Icon</label>
          <div class="icon-picker">
            {#each ICON_OPTIONS as icon}
              <button
                class="icon-btn"
                class:selected={newPresetIcon === icon}
                onclick={() => (newPresetIcon = icon)}
                type="button"
                aria-label="Select {icon} icon"
              >
                <i class="fas fa-{icon}" aria-hidden="true"></i>
              </button>
            {/each}
          </div>
        </div>

        <div class="dialog-actions">
          <button class="cancel-btn" onclick={handleCancelSaveDialog} type="button">
            Cancel
          </button>
          <button
            class="save-btn"
            onclick={handleSaveAsPreset}
            type="button"
            disabled={!newPresetName.trim()}
          >
            Save Preset
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .composition-lab {
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

  .save-preset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: transparent;
    border: 1px dashed var(--theme-accent, #8b5cf6);
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .save-preset-btn:hover:not(:disabled) {
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .save-preset-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .export-btn.copied {
    background: var(--semantic-success, #10b981);
    border-color: var(--semantic-success, #10b981);
    color: white;
  }

  .export-btn.error {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
    color: white;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: var(--spacing-sm, 8px) 0;
  }

  .multi-selection {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-md, 12px) 0;
  }

  .multi-label {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .multi-selection .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: transparent;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .multi-selection .action-btn.danger {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .multi-selection .action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.15);
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

  /* Dialog styles */
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    padding: var(--spacing-xl, 24px);
    width: 100%;
    max-width: 400px;
    margin: var(--spacing-lg, 16px);
  }

  .dialog-title {
    margin: 0 0 var(--spacing-lg, 16px);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
    margin-bottom: var(--spacing-md, 12px);
  }

  .form-field label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .form-field input {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
  }

  .form-field input:focus {
    outline: none;
    border-color: var(--theme-accent, #8b5cf6);
  }

  .form-field input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs, 4px);
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .icon-btn.selected {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .dialog-actions {
    display: flex;
    gap: var(--spacing-sm, 8px);
    justify-content: flex-end;
    margin-top: var(--spacing-lg, 16px);
  }

  .cancel-btn {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .cancel-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .save-btn {
    padding: var(--spacing-sm, 8px) var(--spacing-lg, 16px);
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: var(--border-radius-md, 8px);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--theme-accent-hover, #7c3aed);
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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

  @media (prefers-reduced-motion: reduce) {
    .save-preset-btn,
    .icon-btn,
    .cancel-btn,
    .save-btn {
      transition: none;
    }
  }
</style>
