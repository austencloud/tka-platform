<!--
  GridLayoutControls.svelte

  Freeform grid layout picker - click cells to enable/disable them.
  Allows any arrangement: L-shapes, T-shapes, scattered cells, etc.

  Design principles:
  - 48px minimum touch targets (WCAG AAA)
  - Visual click-to-toggle grid
  - Theme-consistent styling
  - Smooth animations
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { GRID_SIZE } from "../../state/arrange-grid-state.svelte";

  let {
    cells,
    enabledCount,
    onToggleCell,
    onPresetLayout,
  }: {
    cells: Array<{ row: number; col: number; enabled: boolean }>;
    enabledCount: number;
    onToggleCell: (row: number, col: number) => void;
    onPresetLayout: (preset: "single" | "line" | "square" | "all") => void;
  } = $props();

  const haptic = container.items.hapticFeedback as IHapticFeedback;

  // Generate grid positions (3x3)
  const gridPositions = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
    row: Math.floor(i / GRID_SIZE),
    col: i % GRID_SIZE,
  }));

  // Check if a position is enabled
  function isEnabled(row: number, col: number): boolean {
    const cell = cells.find((c) => c.row === row && c.col === col);
    return cell?.enabled ?? false;
  }

  function handleCellClick(row: number, col: number) {
    haptic.trigger("selection");
    onToggleCell(row, col);
  }

  function handleCellKeyDown(e: KeyboardEvent, row: number, col: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCellClick(row, col);
    }
  }

  function handlePreset(preset: "single" | "line" | "square" | "all") {
    haptic.trigger("selection");
    onPresetLayout(preset);
  }
</script>

<div class="grid-layout-controls">
  <!-- Interactive Grid -->
  <div class="grid-section">
    <div
      class="toggle-grid"
      role="grid"
      aria-label="Grid layout selector - click cells to enable or disable"
    >
      {#each gridPositions as pos (pos.row * GRID_SIZE + pos.col)}
        {@const enabled = isEnabled(pos.row, pos.col)}
        <button
          class="grid-cell"
          class:enabled
          role="gridcell"
          aria-selected={enabled}
          aria-label="Cell row {pos.row + 1}, column {pos.col + 1}, {enabled ? 'enabled' : 'disabled'}"
          onclick={() => handleCellClick(pos.row, pos.col)}
          onkeydown={(e) => handleCellKeyDown(e, pos.row, pos.col)}
        >
          {#if enabled}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Cell count -->
    <div class="count-label">
      <span class="count-value">{enabledCount}</span>
      <span class="count-text">{enabledCount === 1 ? "cell" : "cells"}</span>
    </div>
  </div>

  <!-- Quick Presets -->
  <div class="presets-section">
    <span class="presets-label">Quick layouts</span>
    <div class="presets-row">
      <button
        class="preset-btn"
        onclick={() => handlePreset("single")}
        aria-label="Single cell layout"
        title="1 cell"
      >
        <div class="preset-icon single">
          <span></span>
        </div>
      </button>
      <button
        class="preset-btn"
        onclick={() => handlePreset("line")}
        aria-label="Horizontal line layout"
        title="1×3 row"
      >
        <div class="preset-icon line">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      <button
        class="preset-btn"
        onclick={() => handlePreset("square")}
        aria-label="2×2 square layout"
        title="2×2 square"
      >
        <div class="preset-icon square">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      <button
        class="preset-btn"
        onclick={() => handlePreset("all")}
        aria-label="Full 3×3 grid layout"
        title="3×3 grid"
      >
        <div class="preset-icon all">
          {#each Array(9) as _}
            <span></span>
          {/each}
        </div>
      </button>
    </div>
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
    grid-template-rows: repeat(3, 1fr);
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
  }

  .grid-cell {
    width: 48px;
    height: 48px;
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
  }

  .grid-cell i {
    font-size: 14px;
    transition: transform 150ms ease;
  }

  .grid-cell.enabled {
    background: var(--theme-accent, #8b5cf6);
    border: 2px solid var(--theme-accent, #8b5cf6);
    color: white;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  }

  @media (hover: hover) {
    .grid-cell:hover:not(.enabled) {
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

  .presets-row {
    display: flex;
    gap: var(--spacing-sm, 8px);
  }

  .preset-btn {
    flex: 1;
    min-height: 48px;
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
    gap: 2px;
  }

  .preset-icon span {
    background: var(--theme-accent, #8b5cf6);
    border-radius: 2px;
    opacity: 0.7;
  }

  .preset-icon.single {
    grid-template-columns: 1fr;
  }

  .preset-icon.single span {
    width: 16px;
    height: 16px;
  }

  .preset-icon.line {
    grid-template-columns: repeat(3, 1fr);
  }

  .preset-icon.line span {
    width: 8px;
    height: 8px;
  }

  .preset-icon.square {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
  }

  .preset-icon.square span {
    width: 8px;
    height: 8px;
  }

  .preset-icon.all {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }

  .preset-icon.all span {
    width: 6px;
    height: 6px;
  }

  /* ====== REDUCED MOTION ====== */
  @media (prefers-reduced-motion: reduce) {
    .grid-cell,
    .grid-cell i,
    .preset-btn {
      transition: none;
    }
  }
</style>
