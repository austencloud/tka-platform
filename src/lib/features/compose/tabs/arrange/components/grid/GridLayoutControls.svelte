<!--
  GridLayoutControls.svelte

  Modern grid dimension picker with smart preset cards and compact hover grid.
  Preset cards are the primary interaction — most users pick a known layout.
  The compact 8×8 hover grid serves power users who want exact dimensions.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";

  type PresetType =
    | "single"
    | "vertical"
    | "horizontal"
    | "line"
    | "square"
    | "filmstrip"
    | "tower"
    | "hero-thumbs"
    | "main-banner"
    | "pip"
    | "split-half"
    | "quad"
    | "gallery";

  interface PresetCard {
    id: PresetType;
    label: string;
    /** CSS grid-template-columns for the thumbnail */
    thumbCols: string;
    /** CSS grid-template-rows for the thumbnail */
    thumbRows: string;
    /** Spans for each visual block: [colSpan, rowSpan][] */
    blocks: [number, number][];
  }

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

  // --- Preset cards ---
  const presets: PresetCard[] = [
    {
      id: "single",
      label: "Solo",
      thumbCols: "1fr",
      thumbRows: "1fr",
      blocks: [[1, 1]],
    },
    {
      id: "horizontal",
      label: "Duo",
      thumbCols: "1fr 1fr",
      thumbRows: "1fr",
      blocks: [[1, 1], [1, 1]],
    },
    {
      id: "vertical",
      label: "Stack",
      thumbCols: "1fr",
      thumbRows: "1fr 1fr",
      blocks: [[1, 1], [1, 1]],
    },
    {
      id: "square",
      label: "Quad",
      thumbCols: "1fr 1fr",
      thumbRows: "1fr 1fr",
      blocks: [[1, 1], [1, 1], [1, 1], [1, 1]],
    },
    {
      id: "gallery",
      label: "Gallery",
      thumbCols: "1fr 1fr 1fr",
      thumbRows: "1fr 1fr 1fr",
      blocks: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    },
    {
      id: "filmstrip",
      label: "Filmstrip",
      thumbCols: "1fr 1fr 1fr 1fr",
      thumbRows: "1fr",
      blocks: [[1, 1], [1, 1], [1, 1], [1, 1]],
    },
    {
      id: "tower",
      label: "Tower",
      thumbCols: "1fr",
      thumbRows: "1fr 1fr 1fr 1fr",
      blocks: [[1, 1], [1, 1], [1, 1], [1, 1]],
    },
    {
      id: "hero-thumbs",
      label: "Hero + Thumbs",
      thumbCols: "repeat(5, 1fr)",
      thumbRows: "repeat(5, 1fr) 1fr",
      blocks: [[5, 5], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    },
    {
      id: "main-banner",
      label: "Banner + Main",
      thumbCols: "1fr",
      thumbRows: "5fr 1fr",
      blocks: [[1, 1], [1, 1]],
    },
    {
      id: "pip",
      label: "Picture-in-Picture",
      thumbCols: "repeat(6, 1fr)",
      thumbRows: "repeat(6, 1fr)",
      blocks: [[5, 6], [1, 1]],
    },
    {
      id: "split-half",
      label: "Split View",
      thumbCols: "1fr 1fr",
      thumbRows: "1fr",
      blocks: [[1, 1], [1, 1]],
    },
  ];

  /** Map preset IDs to their effective grid dimensions for active-state matching */
  const presetDimensions: Record<string, { rows: number; cols: number } | null> = {
    single: { rows: 1, cols: 1 },
    horizontal: { rows: 1, cols: 2 },
    vertical: { rows: 2, cols: 1 },
    square: { rows: 2, cols: 2 },
    gallery: { rows: 3, cols: 3 },
    filmstrip: { rows: 1, cols: 4 },
    tower: { rows: 4, cols: 1 },
    // Spanning presets use fixed grids but with spanning cells
    "hero-thumbs": { rows: 6, cols: 5 },
    "main-banner": { rows: 6, cols: 6 },
    pip: { rows: 6, cols: 6 },
    "split-half": { rows: 4, cols: 2 },
    quad: { rows: 6, cols: 6 },
  };

  function isPresetActive(preset: PresetCard): boolean {
    const dims = presetDimensions[preset.id];
    if (!dims) return false;
    return gridRows === dims.rows && gridCols === dims.cols;
  }

  // --- Compact hover grid state ---
  let hoverRows = $state<number | null>(null);
  let hoverCols = $state<number | null>(null);

  const displayRows = $derived(hoverRows ?? gridRows);
  const displayCols = $derived(hoverCols ?? gridCols);
  const isPreviewing = $derived(hoverRows !== null || hoverCols !== null);

  // --- Confirmation state ---
  let pendingPreset = $state<PresetType | null>(null);
  let pendingDimensions = $state<{ rows: number; cols: number } | null>(null);

  const hasPending = $derived(pendingPreset !== null || pendingDimensions !== null);

  // --- Compact grid cells ---
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

  // --- Preset handler ---
  function handlePresetClick(preset: PresetCard) {
    haptic.trigger("selection");
    if (hasContent) {
      pendingPreset = preset.id;
      pendingDimensions = null;
    } else {
      onPresetLayout(preset.id);
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
  <!-- ====== PRESET CARDS ====== -->
  <section class="presets-section">
    <span class="section-header">Layouts</span>
    <div class="preset-grid">
      {#each presets as preset (preset.id)}
        {@const active = isPresetActive(preset)}
        <button
          class="preset-card"
          class:active
          onclick={() => handlePresetClick(preset)}
          aria-label="{preset.label} layout"
          aria-pressed={active}
        >
          <div
            class="preset-thumb"
            style:grid-template-columns={preset.thumbCols}
            style:grid-template-rows={preset.thumbRows}
          >
            {#each preset.blocks as [colSpan, rowSpan]}
              <span
                class="thumb-block"
                class:active
                style:grid-column={colSpan > 1 ? `span ${colSpan}` : undefined}
                style:grid-row={rowSpan > 1 ? `span ${rowSpan}` : undefined}
              ></span>
            {/each}
          </div>
          <span class="preset-label">{preset.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- ====== CONFIRMATION BAR ====== -->
  {#if hasPending}
    <div
      class="confirm-bar"
      role="alertdialog"
      aria-label="Confirm layout change"
    >
      <span class="confirm-icon">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      </span>
      <span class="confirm-text">Will clear affected cells</span>
      <button class="confirm-btn cancel" onclick={cancelChange}>Cancel</button>
      <button class="confirm-btn apply" onclick={confirmChange}>Apply</button>
    </div>
  {/if}

  <!-- ====== COMPACT HOVER GRID ====== -->
  <section class="custom-section">
    <span class="section-header">Custom Size</span>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="compact-grid"
      role="toolbar"
      aria-label="Grid dimensions: {gridRows} rows by {gridCols} columns"
      tabindex="0"
      onkeydown={handleKeydown}
      onpointerleave={handleGridPointerLeave}
    >
      {#each gridPositions as pos (pos.row * MAX_GRID + pos.col)}
        {@const state = getCellState(pos.row, pos.col)}
        <button
          class="mini-cell"
          class:active={state === "active"}
          class:preview={state === "preview"}
          tabindex="-1"
          aria-label="Set grid to {pos.col + 1} columns by {pos.row + 1} rows"
          onpointerenter={() => handleCellPointerEnter(pos.row, pos.col)}
          onclick={() => handleCellClick(pos.row, pos.col)}
        ></button>
      {/each}
    </div>
    <div class="dimension-label" aria-live="polite">
      <span class="dim-value" class:previewing={isPreviewing}>
        {displayCols} &times; {displayRows}
      </span>
    </div>
  </section>
</div>

<style>
  .grid-layout-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
  }

  /* ====== SECTION HEADERS ====== */
  .section-header {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 8px;
  }

  /* ====== PRESET CARDS ====== */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .preset-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 4px 6px;
    min-height: 44px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .preset-card.active {
    background: color-mix(in srgb, #8b5cf6 14%, transparent);
    border-color: color-mix(in srgb, #8b5cf6 50%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, #8b5cf6 20%, transparent);
  }

  @media (hover: hover) {
    .preset-card:not(.active):hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
    }
  }

  .preset-card:active {
    transform: scale(0.96);
  }

  .preset-card:focus-visible {
    outline: 2px solid #8b5cf6;
    outline-offset: 2px;
  }

  /* ====== PRESET THUMBNAILS ====== */
  .preset-thumb {
    display: grid;
    gap: 2px;
    width: 36px;
    height: 36px;
  }

  .thumb-block {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    min-width: 0;
    min-height: 0;
  }

  .thumb-block.active {
    background: #8b5cf6;
    opacity: 0.85;
  }

  .preset-label {
    font-size: 10px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .preset-card.active .preset-label {
    color: rgba(255, 255, 255, 0.9);
  }

  /* ====== CONFIRMATION BAR ====== */
  .confirm-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
  }

  .confirm-icon {
    color: rgba(239, 68, 68, 0.8);
    font-size: 12px;
    flex-shrink: 0;
  }

  .confirm-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    flex: 1;
    min-width: 0;
  }

  .confirm-btn {
    flex-shrink: 0;
    padding: 4px 10px;
    border: none;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .confirm-btn.cancel {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .confirm-btn.apply {
    background: rgba(239, 68, 68, 0.65);
    color: white;
  }

  @media (hover: hover) {
    .confirm-btn.cancel:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .confirm-btn.apply:hover {
      background: rgba(239, 68, 68, 0.85);
    }
  }

  .confirm-btn:focus-visible {
    outline: 2px solid #8b5cf6;
    outline-offset: 2px;
  }

  /* ====== COMPACT HOVER GRID ====== */
  .custom-section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .custom-section .section-header {
    align-self: flex-start;
  }

  .compact-grid {
    display: grid;
    grid-template-rows: repeat(8, 1fr);
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    outline: none;
    width: fit-content;
  }

  .compact-grid:focus-visible {
    outline: 2px solid #8b5cf6;
    outline-offset: 2px;
  }

  .mini-cell {
    width: 14px;
    height: 14px;
    padding: 0;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    cursor: pointer;
    transition: all 100ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mini-cell.active {
    background: #8b5cf6;
    border-color: #8b5cf6;
  }

  .mini-cell.preview {
    background: color-mix(in srgb, #8b5cf6 25%, transparent);
    border-color: color-mix(in srgb, #8b5cf6 40%, transparent);
  }

  @media (hover: hover) {
    .mini-cell:not(.active):not(.preview):hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  .mini-cell:focus-visible {
    outline: 2px solid #8b5cf6;
    outline-offset: 1px;
  }

  /* ====== DIMENSION LABEL ====== */
  .dimension-label {
    margin-top: 6px;
    text-align: center;
  }

  .dim-value {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
    font-variant-numeric: tabular-nums;
    transition: color 150ms ease;
  }

  .dim-value.previewing {
    color: #8b5cf6;
  }

  /* ====== REDUCED MOTION ====== */
  @media (prefers-reduced-motion: reduce) {
    .preset-card,
    .mini-cell,
    .confirm-btn,
    .dim-value {
      transition: none;
    }
  }
</style>
