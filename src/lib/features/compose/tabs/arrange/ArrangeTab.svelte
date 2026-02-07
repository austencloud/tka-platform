<script lang="ts">
  /**
   * ArrangeTab - Grid-based composition builder
   *
   * Architecture:
   * - Freeform 6x6 grid where each cell can be toggled on/off
   * - Supports non-rectangular layouts (L-shapes, T-shapes, scattered, etc.)
   * - Each enabled cell is a "tunnel" that can hold up to 4 performers/layers
   * - Global sync playback with optional per-cell beat offsets
   *
   * Flow:
   * 1. Toggle cells on/off using the grid picker (or use presets)
   * 2. Click an enabled cell to select it
   * 3. Add sequences to the selected cell
   * 4. Play to see all cells animate together
   *
   * Desktop-first. Mobile gets attention in Phase B.
   */

  import { arrangeGridState } from "./state/arrange-grid-state.svelte";
  import GridLayoutControls from "./components/grid/GridLayoutControls.svelte";
  import CompositionGrid from "./components/grid/CompositionGrid.svelte";
  import CellEditor from "./components/grid/CellEditor.svelte";
  import PlaybackBar from "./components/shared/PlaybackBar.svelte";
  import StaggerControls from "./components/shared/StaggerControls.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import SaveCompositionModal from "./components/grid/SaveCompositionModal.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CellMediaType } from "../../compose/domain/types";
  import type { TransformType } from "../../compose/domain/types";

  // Use singleton grid state
  const gridState = arrangeGridState;

  // Mobile detection
  let isMobile = $state(false);
  $effect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      isMobile = window.innerWidth < 768;
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  });

  // Local UI state for stagger controls
  let showStaggerControls = $state(false);
  let editingLayerIndex = $state<number | null>(null);
  let showSaveModal = $state(false);

  // Zoom mode: "auto" zooms to fit enabled cells, "full" shows entire 6x6
  let zoomMode = $state<"auto" | "full">("auto");

  // Derived: selected cell data
  const selectedCell = $derived(gridState.selectedCell);
  const selectedCellId = $derived(gridState.selectedCellId);

  // Grid layout handlers
  function handleToggleCell(row: number, col: number) {
    gridState.toggleCell(row, col);
  }

  function handlePresetLayout(
    preset:
      | "single"
      | "vertical"
      | "horizontal"
      | "line"
      | "square"
      | "all"
      | "hero-thumbs"
      | "main-banner"
      | "pip"
  ) {
    gridState.setPresetLayout(preset);
  }

  function handleSetSpan(colSpan: number, rowSpan: number) {
    if (selectedCellId !== null) {
      gridState.setCellSpan(selectedCellId, colSpan, rowSpan);
    }
  }

  function handleSetCellSpan(cellId: string, colSpan: number, rowSpan: number, newCol?: number, newRow?: number) {
    gridState.setCellSpan(cellId, colSpan, rowSpan, newCol, newRow);
  }

  // Cell selection
  function handleSelectCell(cellId: string) {
    gridState.selectCell(cellId);
  }

  // Sequence picker
  function handleAddSequence() {
    gridState.openSequencePicker();
  }

  function handleSequenceSelected(sequence: SequenceData) {
    if (selectedCellId !== null) {
      const result = gridState.addLayerToCell(selectedCellId, sequence);
      if (!result.success && result.error) {
        showToast({
          message: result.error,
          type: "error",
          duration: 5000,
        });
        return; // Keep picker open so user can select a different sequence
      }
    }
    gridState.closeSequencePicker();
  }

  function handleCloseSequencePicker() {
    gridState.closeSequencePicker();
  }

  // Layer operations
  function handleRemoveLayer(layerIndex: number) {
    if (selectedCellId !== null) {
      gridState.removeLayerFromCell(selectedCellId, layerIndex);
    }
  }

  function handleEditLayerOffset(layerIndex: number) {
    editingLayerIndex = layerIndex;
    showStaggerControls = true;
  }

  function handleSaveLayerOffset(offset: number) {
    if (selectedCellId !== null && editingLayerIndex !== null) {
      gridState.updateLayerBeatOffset(selectedCellId, editingLayerIndex, offset);
    }
  }

  function handleCloseStaggerControls() {
    showStaggerControls = false;
    editingLayerIndex = null;
  }

  function handleClearCell() {
    if (selectedCellId !== null) {
      gridState.clearCell(selectedCellId);
    }
  }

  function handleRemoveCell() {
    if (selectedCell) {
      gridState.toggleCell(selectedCell.row, selectedCell.col);
    }
  }

  function handleMediaTypeChange(mediaType: CellMediaType) {
    if (selectedCellId !== null) {
      gridState.setCellMediaType(selectedCellId, mediaType);
    }
  }

  // Copy / Paste / Transform
  function handleCopyLayer(layerIndex: number) {
    if (selectedCellId !== null) {
      gridState.copyLayerSequence(selectedCellId, layerIndex);
      showToast({ message: "Sequence copied", type: "info", duration: 2000 });
    }
  }

  function handlePasteLayer() {
    if (selectedCellId !== null) {
      const result = gridState.pasteSequenceToCell(selectedCellId);
      if (result.success) {
        showToast({
          message: "Sequence pasted",
          type: "success",
          duration: 2000,
        });
      } else if (result.error) {
        showToast({ message: result.error, type: "error", duration: 4000 });
      }
    }
  }

  async function handleTransformLayer(
    layerIndex: number,
    transformType: TransformType
  ) {
    if (selectedCellId !== null) {
      const result = await gridState.transformLayer(
        selectedCellId,
        layerIndex,
        transformType
      );
      if (result.success) {
        showToast({
          message: `Applied ${transformType}`,
          type: "success",
          duration: 2000,
        });
      } else if (result.error) {
        showToast({ message: result.error, type: "error", duration: 4000 });
      }
    }
  }

  // Playback
  function handlePlayPause() {
    gridState.togglePlayPause();
  }

  function handleStop() {
    gridState.stop();
  }

  function handleStepHalfBack() {
    gridState.stepHalfBack();
  }

  function handleStepHalfFwd() {
    gridState.stepHalfForward();
  }

  function handleStepFullBack() {
    gridState.stepFullBack();
  }

  function handleStepFullFwd() {
    gridState.stepFullForward();
  }

  function handleBpmChange(bpm: number) {
    gridState.setBpm(bpm);
  }

  function handleToggleLoop() {
    gridState.toggleSkipStartPosition();
  }

  // Stagger controls helpers
  function getEditingLayerName(): string {
    if (selectedCell && editingLayerIndex !== null) {
      const layer = selectedCell.layers[editingLayerIndex];
      return layer?.sequence.word || layer?.sequence.name || "Sequence";
    }
    return "Sequence";
  }

  function getEditingLayerOffset(): number {
    if (selectedCell && editingLayerIndex !== null) {
      return selectedCell.layers[editingLayerIndex]?.beatOffset ?? 0;
    }
    return 0;
  }


  // Utility actions
  async function handleCopyState() {
    const state = gridState.serializeState();
    try {
      await navigator.clipboard.writeText(state);
      showToast({ message: "Grid state copied", type: "info", duration: 2000 });
    } catch {
      showToast({ message: "Failed to copy", type: "error", duration: 3000 });
    }
  }

  function handleSaveComposition() {
    showSaveModal = true;
  }

  function handleSaveModalConfirm(name: string) {
    gridState.saveComposition(name);
    showSaveModal = false;
    showToast({
      message: `Saved "${name}"`,
      type: "success",
      duration: 3000,
    });
  }

  function handleSaveModalClose() {
    showSaveModal = false;
  }

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    // Don't intercept if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // Don't intercept if modals are open
    if (gridState.showSequencePicker || showStaggerControls || showSaveModal) {
      return;
    }

    switch (e.key) {
      case "Delete":
      case "Backspace":
        // Two-step delete: clear layers first, then remove empty cell
        if (selectedCellId !== null && selectedCell) {
          e.preventDefault();
          if (selectedCell.layers.length > 0) {
            handleClearCell();
          } else {
            handleRemoveCell();
          }
        }
        break;

      case "Escape":
        // Deselect cell
        if (selectedCellId !== null) {
          e.preventDefault();
          gridState.deselectCell();
        }
        break;

      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        e.preventDefault();
        navigateToAdjacentCell(e.key);
        break;

      case " ":
        // Space for play/pause (only when not focused on a button)
        if (target.tagName !== "BUTTON" && gridState.hasAnyLayers) {
          e.preventDefault();
          handlePlayPause();
        }
        break;

      case "c":
        // Ctrl+C to copy first layer of selected cell
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (selectedCellId !== null && selectedCell?.layers.length) {
            handleCopyLayer(0);
          }
        }
        break;

      case "v":
        // Ctrl+V to paste into selected cell
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (selectedCellId !== null && gridState.clipboard) {
            handlePasteLayer();
          }
        }
        break;

      case "z":
      case "Z":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else {
          // Bare Z toggles zoom mode
          e.preventDefault();
          zoomMode = zoomMode === "auto" ? "full" : "auto";
        }
        break;

      case "y":
      case "Y":
        // Ctrl+Y = redo (Windows convention)
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleRedo();
        }
        break;
    }
  }

  function handleUndo() {
    const desc = gridState.undo();
    if (desc) {
      showToast({ message: `Undo: ${desc}`, type: "info", duration: 2000 });
    }
  }

  function handleRedo() {
    const desc = gridState.redo();
    if (desc) {
      showToast({ message: `Redo: ${desc}`, type: "info", duration: 2000 });
    }
  }

  function navigateToAdjacentCell(direction: string) {
    const enabledCells = gridState.enabledCells;
    if (enabledCells.length === 0) return;

    // If no cell selected, select the first one
    if (!selectedCell) {
      const sorted = [...enabledCells].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      if (sorted[0]) {
        gridState.selectCell(sorted[0].id);
      }
      return;
    }

    // Calculate target position
    let targetRow = selectedCell.row;
    let targetCol = selectedCell.col;

    switch (direction) {
      case "ArrowUp":
        targetRow--;
        break;
      case "ArrowDown":
        targetRow++;
        break;
      case "ArrowLeft":
        targetCol--;
        break;
      case "ArrowRight":
        targetCol++;
        break;
    }

    // Find cell at target position (or closest in that direction)
    const cellAtTarget = enabledCells.find(
      (c) => c.row === targetRow && c.col === targetCol
    );

    if (cellAtTarget) {
      gridState.selectCell(cellAtTarget.id);
    } else {
      // Try to find any cell in that direction
      const candidates = enabledCells.filter((c) => {
        switch (direction) {
          case "ArrowUp":
            return c.row < selectedCell.row;
          case "ArrowDown":
            return c.row > selectedCell.row;
          case "ArrowLeft":
            return c.col < selectedCell.col;
          case "ArrowRight":
            return c.col > selectedCell.col;
          default:
            return false;
        }
      });

      if (candidates.length > 0) {
        // Pick the closest one
        candidates.sort((a, b) => {
          const distA =
            Math.abs(a.row - selectedCell.row) +
            Math.abs(a.col - selectedCell.col);
          const distB =
            Math.abs(b.row - selectedCell.row) +
            Math.abs(b.col - selectedCell.col);
          return distA - distB;
        });
        if (candidates[0]) {
          gridState.selectCell(candidates[0].id);
        }
      }
    }
  }

  // Register keyboard listener
  $effect(() => {
    if (typeof window === "undefined" || isMobile) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div class="arrange-tab">
  {#if isMobile}
    <!-- Mobile: Show placeholder until Phase B -->
    <div class="mobile-placeholder">
      <div class="placeholder-content">
        <i class="fas fa-desktop" aria-hidden="true"></i>
        <p class="title">Composition grid is optimized for desktop</p>
        <p class="hint">Try rotating your device or using a larger screen.</p>
      </div>
    </div>
  {:else}
    <!-- Desktop: Split-view layout -->
    <div class="desktop-content">
      <!-- Left: Grid Canvas Area -->
      <div class="canvas-area">
        <!-- Utility buttons (top-left) -->
        <div class="canvas-utils">
          <button
            class="util-btn"
            onclick={handleCopyState}
            title="Copy grid state to clipboard"
            aria-label="Copy grid state to clipboard"
          >
            <i class="fas fa-clipboard" aria-hidden="true"></i>
          </button>
          <button
            class="util-btn"
            onclick={handleSaveComposition}
            title="Save composition"
            aria-label="Save composition"
          >
            <i class="fas fa-bookmark" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Zoom toggle -->
        <div class="zoom-controls">
          <button
            class="zoom-btn"
            class:active={zoomMode === "auto"}
            onclick={() => (zoomMode = "auto")}
            title="Fit to content"
          >
            <i class="fas fa-compress-alt" aria-hidden="true"></i>
          </button>
          <button
            class="zoom-btn"
            class:active={zoomMode === "full"}
            onclick={() => (zoomMode = "full")}
            title="Show full grid"
          >
            <i class="fas fa-th" aria-hidden="true"></i>
          </button>
        </div>

        <CompositionGrid
          cells={gridState.cells}
          currentBeat={gridState.currentBeat}
          isPlaying={gridState.isPlaying}
          skipStartPosition={gridState.skipStartPosition}
          selectedCellId={gridState.selectedCellId}
          occupiedPositions={gridState.occupiedPositions}
          stateGridBounds={gridState.gridBounds}
          {zoomMode}
          onSelectCell={handleSelectCell}
          onSetCellSpan={handleSetCellSpan}
          onToggleCell={handleToggleCell}
        />
      </div>

      <!-- Right: Control Panel -->
      <div class="control-panel">
        <!-- Grid Layout Controls -->
        <div class="panel-section grid-section">
          <GridLayoutControls
            cells={gridState.cells}
            enabledCount={gridState.enabledCount}
            occupiedPositions={gridState.occupiedPositions}
            hasContent={gridState.hasAnyLayers}
            onToggleCell={handleToggleCell}
            onPresetLayout={handlePresetLayout}
          />
        </div>

        <!-- Cell Editor (when a cell is selected) -->
        {#if selectedCell && selectedCellId !== null}
          <div class="panel-section">
            <CellEditor
              cell={selectedCell}
              cellIndex={selectedCell ? gridState.getCellDisplayIndex(selectedCell.id) : 0}
              clipboardHasData={gridState.clipboard !== null}
              transformingLayer={gridState.transformingLayer}
              onAddSequence={handleAddSequence}
              onRemoveLayer={handleRemoveLayer}
              onEditLayerOffset={handleEditLayerOffset}
              onClearCell={handleClearCell}
              onRemoveCell={handleRemoveCell}
              onMediaTypeChange={handleMediaTypeChange}
              onCopyLayer={handleCopyLayer}
              onPasteLayer={handlePasteLayer}
              onTransformLayer={handleTransformLayer}
            />
          </div>
        {:else}
          <div class="panel-section">
            <div class="no-selection">
              <i class="fas fa-hand-pointer" aria-hidden="true"></i>
              <p>Select a cell to edit its contents</p>
            </div>
          </div>
        {/if}

        <!-- Playback Controls -->
        {#if gridState.hasAnyLayers}
          <div class="panel-section playback-section">
            <PlaybackBar
              isPlaying={gridState.isPlaying}
              currentBeat={gridState.currentBeat}
              totalBeats={gridState.totalBeats}
              bpm={gridState.bpm}
              skipStartPosition={gridState.skipStartPosition}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onStepHalfBack={handleStepHalfBack}
              onStepHalfFwd={handleStepHalfFwd}
              onStepFullBack={handleStepFullBack}
              onStepFullFwd={handleStepFullFwd}
              onBpmChange={handleBpmChange}
              onToggleLoop={handleToggleLoop}
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Sequence picker modal -->
  <SequencePickerModal
    open={gridState.showSequencePicker}
    requiredBeatCount={gridState.getRequiredBeatCount()}
    onSelect={handleSequenceSelected}
    onClose={handleCloseSequencePicker}
  />

  <!-- Stagger controls modal -->
  <StaggerControls
    open={showStaggerControls}
    layerName={getEditingLayerName()}
    currentOffset={getEditingLayerOffset()}
    maxOffset={gridState.totalBeats > 0 ? gridState.totalBeats - 1 : 10}
    onClose={handleCloseStaggerControls}
    onSave={handleSaveLayerOffset}
  />

  <!-- Save composition modal -->
  <SaveCompositionModal
    bind:open={showSaveModal}
    suggestedName={gridState.suggestCompositionName()}
    onSave={handleSaveModalConfirm}
    onClose={handleSaveModalClose}
  />
</div>

<style>
  .arrange-tab {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
  }

  /* ====== MOBILE PLACEHOLDER ====== */
  .mobile-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--spacing-xl);
  }

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .placeholder-content i {
    font-size: 3rem;
    opacity: 0.4;
  }

  .placeholder-content .title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
  }

  .placeholder-content .hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* ====== DESKTOP SPLIT-VIEW ====== */
  .desktop-content {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--spacing-lg);
    height: 100%;
    padding: var(--spacing-lg);
  }

  /* Canvas area - left side */
  .canvas-area {
    position: relative;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    min-height: 0;
  }

  /* Canvas utility buttons (top-left) */
  .canvas-utils {
    position: absolute;
    top: var(--spacing-sm, 8px);
    left: var(--spacing-sm, 8px);
    display: flex;
    gap: 2px;
    z-index: 20;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    padding: 2px;
  }

  .util-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    border-radius: var(--border-radius-sm, 4px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .util-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  .util-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Zoom controls */
  .zoom-controls {
    position: absolute;
    top: var(--spacing-sm, 8px);
    right: var(--spacing-sm, 8px);
    display: flex;
    gap: 2px;
    z-index: 20;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    padding: 2px;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    border-radius: var(--border-radius-sm, 4px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .zoom-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  .zoom-btn.active {
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  /* Control panel - right side */
  .control-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    min-height: 0;
    overflow-y: auto;
  }

  .panel-section {
    padding: var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg);
  }

  /* Grid section doesn't need extra padding - component handles it */
  .panel-section.grid-section {
    padding: 0;
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    text-align: center;
  }

  .no-selection i {
    font-size: 2rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .no-selection p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .playback-section {
    margin-top: auto;
  }

  /* Larger screens: wider control panel */
  @media (min-width: 1200px) {
    .desktop-content {
      grid-template-columns: 1fr 380px;
    }
  }

  /* Medium screens: narrower control panel */
  @media (max-width: 1024px) and (min-width: 768px) {
    .desktop-content {
      grid-template-columns: 1fr 280px;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
    }
  }

  /* Hide mobile placeholder on desktop, hide desktop content on mobile */
  @media (min-width: 768px) {
    .mobile-placeholder {
      display: none;
    }
  }

  @media (max-width: 767px) {
    .desktop-content {
      display: none;
    }
  }
</style>
