<!--
  GridLayoutControls.svelte

  Grid dimension picker + spanning presets for the arrange grid.
  8x8 grid of cells using the old toggle-grid visual style.
  Active cells (within current dimensions) are filled accent with checkmarks.
  Click any cell to set grid dimensions to that position.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  type PresetType =
    | "single"
    | "vertical"
    | "horizontal"
    | "line"
    | "square"
    | "hero-thumbs"
    | "main-banner"
    | "pip";

  let {
    gridRows,
    gridCols,
    hasContent,
    onSetGridRows,
    onSetGridCols,
    onSetDimensions,
    onPresetLayout,
  }: {
    gridRows: number;
    gridCols: number;
    hasContent: boolean;
    onSetGridRows: (n: number) => void;
    onSetGridCols: (n: number) => void;
    onSetDimensions: (rows: number, cols: number) => void;
    onPresetLayout: (preset: PresetType) => void;
  } = $props();

  const haptic = getHapticFeedback();

  const MAX_GRID = 8;

  // --- Hover preview state ---
  let hoverRows = $state<number | null>(null);
  let hoverCols = $state<number | null>(null);

  const displayRows = $derived(hoverRows ?? gridRows);
  const displayCols = $derived(hoverCols ?? gridCols);
  const displayTotal = $derived(displayRows * displayCols);
  const isPreviewing = $derived(hoverRows !== null || hoverCols !== null);

  // --- Confirmation state ---
  let pendingPreset = $state<PresetType | null>(null);
  let pendingDimensions = $state<{ rows: number; cols: number } | null>(null);

  // --- Grid cells ---
  const gridPositions = Array.from({ length: MAX_GRID * MAX_GRID }, (_, i) => ({
    row: Math.floor(i / MAX_GRID),
    col: i % MAX_GRID,
  }));

  function getCellState(
    row: number,
    col: number,
  ): "active" | "preview" | "inactive" {
    if (row < gridRows && col < gridCols) return "active";
    if (row < displayRows && col < displayCols) return "preview";
    return "inactive";
  }

  function handleCellPointerEnter(row: number, col: number) {
    hoverRows = row + 1;
    hoverCols = col + 1;
  }

  function handleGridPointerLeave() {
    hoverRows = null;
    hoverCols = null;
  }

  function handleCellClick(row: number, col: number) {
    const newRows = row + 1;
    const newCols = col + 1;
    if (newRows === gridRows && newCols === gridCols) return;

    haptic.trigger("selection");

    if (hasContent) {
      pendingDimensions = { rows: newRows, cols: newCols };
      pendingPreset = null;
    } else {
      onSetDimensions(newRows, newCols);
    }
  }

  // --- Keyboard ---
  function handleKeydown(e: KeyboardEvent) {
    let newRows = gridRows;
    let newCols = gridCols;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        newRows = Math.max(1, gridRows - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        newRows = Math.min(MAX_GRID, gridRows + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        newCols = Math.max(1, gridCols - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        newCols = Math.min(MAX_GRID, gridCols + 1);
        break;
      default:
        return;
    }

    if (newRows === gridRows && newCols === gridCols) return;

    haptic.trigger("selection");

    if (hasContent) {
      pendingDimensions = { rows: newRows, cols: newCols };
      pendingPreset = null;
    } else {
      onSetDimensions(newRows, newCols);
    }
  }

  // --- Spanning presets ---
  function handleSpanningPreset(preset: PresetType) {
    haptic.trigger("selection");
    if (hasContent) {
      pendingPreset = preset;
      pendingDimensions = null;
    } else {
      onPresetLayout(preset);
    }
  }

  // --- Confirmation ---
  function confirmChange() {
    haptic.trigger("warning");
    if (pendingPreset) {
      onPresetLayout(pendingPreset);
      pendingPreset = null;
    } else if (pendingDimensions) {
      onSetDimensions(pendingDimensions.rows, pendingDimensions.cols);
      pendingDimensions = null;
    }
  }

  function cancelChange() {
    pendingPreset = null;
    pendingDimensions = null;
  }
</script>

<div class="grid-layout-controls">
  <!-- Interactive Grid -->
  <div class="grid-section">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="toggle-grid"
      role="toolbar"
      aria-label="Grid dimensions: {gridRows} rows by {gridCols} columns"
      tabindex="0"
      onkeydown={handleKeydown}
      onpointerleave={handleGridPointerLeave}
    >
      {#each gridPositions as pos (pos.row * MAX_GRID + pos.col)}
        {@const state = getCellState(pos.row, pos.col)}
        <button
          class="grid-cell"
          class:enabled={state === "active"}
          class:preview={state === "preview"}
          tabindex="-1"
          aria-label="Set grid to {pos.col + 1} columns by {pos.row + 1} rows"
          onpointerenter={() => handleCellPointerEnter(pos.row, pos.col)}
          onclick={() => handleCellClick(pos.row, pos.col)}
        >
          {#if state === "active"}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Dimension Label -->
    <div class="count-label" aria-live="polite">
      <span class="count-value" class:previewing={isPreviewing}>
        {displayCols} &times; {displayRows}
      </span>
      <span class="count-text">
        ({displayTotal} {displayTotal === 1 ? "cell" : "cells"})
      </span>
    </div>
  </div>

  <!-- Layout Presets -->
  <div class="presets-section">
    <span class="presets-label">Presets</span>

    {#if pendingPreset || pendingDimensions}
      <div
        class="confirm-bar"
        role="alertdialog"
        aria-label="Confirm layout change"
      >
        <p class="confirm-text">
          Sequences in affected cells will be cleared.
        </p>
        <div class="confirm-actions">
          <button class="confirm-cancel" onclick={cancelChange}>
            Cancel
          </button>
          <button class="confirm-apply" onclick={confirmChange}>
            Change Layout
          </button>
        </div>
        <p class="confirm-hint">Ctrl+Z to undo after applying</p>
      </div>
    {:else}
      <div class="spanning-presets">
        <button
          class="preset-btn"
          onclick={() => handleSpanningPreset("hero-thumbs")}
          aria-label="Hero with thumbnails layout"
          title="5x5 hero + thumbnails"
        >
          <div class="preset-icon hero-thumbs">
            <span class="span-5x5"></span>
            <span class="span-1x1"></span>
            <span class="span-1x1"></span>
            <span class="span-1x1"></span>
            <span class="span-1x1"></span>
            <span class="span-1x1"></span>
          </div>
        </button>
        <button
          class="preset-btn"
          onclick={() => handleSpanningPreset("main-banner")}
          aria-label="Main with banner layout"
          title="6x5 main + banner"
        >
          <div class="preset-icon main-banner">
            <span class="span-6x5"></span>
            <span class="span-6x1"></span>
          </div>
        </button>
        <button
          class="preset-btn"
          onclick={() => handleSpanningPreset("pip")}
          aria-label="Picture-in-picture layout"
          title="Large main + small overlay"
        >
          <div class="preset-icon pip">
            <span class="span-5x6"></span>
            <span class="span-1x1"></span>
          </div>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .grid-layout-controls {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 16px);
    padding: var(--spacing-md, 12px);
  }

  /* ====== GRID SECTION ====== */
  .grid-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 12px);
  }

  .toggle-grid {
    display: grid;
    grid-template-rows: repeat(8, 1fr);
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    outline: none;
  }

  .toggle-grid:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .grid-cell {
    aspect-ratio: 1;
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    color: transparent;
    padding: 0;
  }

  .grid-cell i {
    font-size: 12px;
    transition: transform 150ms ease;
  }

  .grid-cell.enabled {
    background: var(--theme-accent, #8b5cf6);
    border: 2px solid var(--theme-accent, #8b5cf6);
    color: white;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  }

  .grid-cell.preview {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 15%,
      var(--theme-panel-bg, rgba(18, 18, 28, 0.98))
    );
    border: 2px solid
      color-mix(
        in srgb,
        var(--theme-accent, #8b5cf6) 40%,
        transparent
      );
  }

  @media (hover: hover) {
    .grid-cell:not(.enabled):not(.preview):hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    }

    .grid-cell.enabled:hover {
      background: var(--theme-accent-hover, #7c3aed);
      transform: scale(1.05);
    }
  }

  .grid-cell:active {
    transform: scale(0.95);
  }

  .grid-cell:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* ====== COUNT LABEL ====== */
  .count-label {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-xs, 4px);
  }

  .count-value {
    font-size: var(--font-size-lg, 20px);
    font-weight: 700;
    color: var(--theme-text, white);
    font-variant-numeric: tabular-nums;
    transition: color 150ms ease;
  }

  .count-value.previewing {
    color: var(--theme-accent, #8b5cf6);
  }

  .count-text {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* ====== PRESETS SECTION ====== */
  .presets-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .presets-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .spanning-presets {
    display: flex;
    gap: var(--spacing-sm, 8px);
  }

  .preset-btn {
    flex: 1;
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .preset-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    }
  }

  .preset-btn:active {
    transform: scale(0.95);
  }

  .preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Preset icons */
  .preset-icon {
    display: grid;
    gap: 1px;
  }

  .preset-icon span {
    background: var(--theme-accent, #8b5cf6);
    border-radius: 2px;
    opacity: 0.7;
  }

  .preset-icon.hero-thumbs {
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(6, 1fr);
    width: 24px;
    height: 24px;
  }

  .preset-icon.hero-thumbs .span-5x5 {
    grid-column: span 5;
    grid-row: span 5;
  }

  .preset-icon.hero-thumbs .span-1x1 {
    grid-column: span 1;
    grid-row: span 1;
  }

  .preset-icon.main-banner {
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(6, 1fr);
    width: 24px;
    height: 24px;
  }

  .preset-icon.main-banner .span-6x5 {
    grid-column: span 6;
    grid-row: span 5;
  }

  .preset-icon.main-banner .span-6x1 {
    grid-column: span 6;
    grid-row: span 1;
  }

  .preset-icon.pip {
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(6, 1fr);
    width: 24px;
    height: 24px;
  }

  .preset-icon.pip .span-5x6 {
    grid-column: span 5;
    grid-row: span 6;
  }

  .preset-icon.pip .span-1x1 {
    grid-column: span 1;
    grid-row: span 1;
  }

  /* ====== CONFIRMATION BAR ====== */
  .confirm-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-md, 12px);
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--border-radius-md, 8px);
  }

  .confirm-text {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, white);
    text-align: center;
    line-height: 1.4;
  }

  .confirm-actions {
    display: flex;
    gap: var(--spacing-sm, 8px);
    width: 100%;
  }

  .confirm-cancel,
  .confirm-apply {
    flex: 1;
    min-height: 40px;
    padding: var(--spacing-xs, 4px) var(--spacing-md, 12px);
    border: none;
    border-radius: var(--border-radius-md, 8px);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .confirm-cancel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .confirm-apply {
    background: rgba(239, 68, 68, 0.7);
    color: white;
  }

  @media (hover: hover) {
    .confirm-cancel:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    }

    .confirm-apply:hover {
      background: rgba(239, 68, 68, 0.9);
    }
  }

  .confirm-cancel:focus-visible,
  .confirm-apply:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .confirm-hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  /* ====== REDUCED MOTION ====== */
  @media (prefers-reduced-motion: reduce) {
    .grid-cell,
    .grid-cell i,
    .preset-btn,
    .confirm-cancel,
    .confirm-apply {
      transition: none;
    }
  }
</style>
