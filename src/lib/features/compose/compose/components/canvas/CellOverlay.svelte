<script lang="ts">
  /**
   * CellOverlay - Hover controls for composition cells
   *
   * Appears on hover/tap over configured cells.
   * Provides quick actions: configure, clear, duplicate settings.
   */

  import type { CellConfig } from "$lib/shared/animation-engine/domain/compose-types";
  import { isCellConfigured } from "$lib/shared/animation-engine/domain/compose-types";
  import { getCompositionState } from "../../state/composition-state.svelte";

  interface Props {
    cell: CellConfig;
    isSelected: boolean;
  }

  let { cell, isSelected }: Props = $props();

  const state = getCompositionState();
  const isConfigured = $derived(isCellConfigured(cell));

  function handleConfigure(e: MouseEvent) {
    e.stopPropagation();
    state.openCellConfig(cell.id);
  }

  function handleClear(e: MouseEvent) {
    e.stopPropagation();
    state.clearCell(cell.id);
  }

  function handleToggleType(e: MouseEvent) {
    e.stopPropagation();
    const newType = cell.type === "single" ? "tunnel" : "single";
    state.setCellType(cell.id, newType);
  }
</script>

{#if isConfigured}
  <!-- Floating toolbar for configured cells - only on hover, positioned at bottom -->
  <div class="cell-toolbar">
    <button
      class="toolbar-btn configure"
      onclick={handleConfigure}
      title="Configure cell"
      aria-label="Configure cell"
    >
      <i class="fas fa-cog" aria-hidden="true"></i>
    </button>

    <button
      class="toolbar-btn type-toggle"
      onclick={handleToggleType}
      title="Toggle {cell.type === 'single' ? 'tunnel' : 'single'} mode"
      aria-label="Toggle cell type"
    >
      <i
        class="fas {cell.type === 'tunnel' ? 'fa-square' : 'fa-layer-group'}"
        aria-hidden="true"
      ></i>
    </button>

    <button
      class="toolbar-btn clear"
      onclick={handleClear}
      title="Clear cell"
      aria-label="Clear cell"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>
{:else}
  <!-- Full overlay prompt for empty cells -->
  <div class="cell-overlay" class:visible={isSelected}>
    <div class="overlay-prompt">
      <button
        class="overlay-btn add"
        onclick={handleConfigure}
        title="Add sequence"
        aria-label="Add sequence to cell"
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
        <span>Configure</span>
      </button>
    </div>
  </div>
{/if}

<style>
  /* Floating toolbar for configured cells - positioned at bottom */
  .cell-toolbar {
    position: absolute;
    bottom: clamp(4px, 3cqi, 12px);
    left: 50%;
    transform: translateX(-50%) translateY(clamp(6px, 3cqi, 12px));
    display: flex;
    gap: clamp(2px, 1cqi, 6px);
    padding: clamp(2px, 1cqi, 6px);
    background: rgba(20, 20, 35, 0.9);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: clamp(4px, 2cqi, 10px);
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
    z-index: 10;
  }

  /* Show toolbar on hover only */
  :global(.composition-cell:hover) .cell-toolbar {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0);
  }

  /* Toolbar buttons - fluid sizing */
  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(28px, 18cqi, 44px);
    height: clamp(28px, 18cqi, 44px);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid transparent;
    border-radius: clamp(4px, 1.5cqi, 8px);
    color: rgba(255, 255, 255, 0.8);
    font-size: clamp(0.7rem, 5cqi, 1rem);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .toolbar-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .toolbar-btn.configure:hover {
    background: rgba(59, 130, 246, 0.4);
    border-color: rgba(59, 130, 246, 0.6);
  }

  .toolbar-btn.type-toggle:hover {
    background: rgba(139, 92, 246, 0.4);
    border-color: rgba(139, 92, 246, 0.6);
  }

  .toolbar-btn.clear:hover {
    background: rgba(239, 68, 68, 0.4);
    border-color: rgba(239, 68, 68, 0.6);
  }

  /* Full overlay for empty cells only */
  .cell-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
    pointer-events: none;
    border-radius: 0;
  }

  /* Show overlay on hover or when selected (empty cells only) */
  :global(.composition-cell:hover) .cell-overlay,
  .cell-overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* Overlay prompt for empty cells */
  .overlay-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 2cqi, 8px);
  }

  /* Overlay buttons - fluid touch target */
  .overlay-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 2cqi, 8px);
    min-width: clamp(40px, 25cqi, 64px);
    min-height: clamp(40px, 25cqi, 64px);
    padding: clamp(8px, 4cqi, 16px) clamp(10px, 5cqi, 20px);
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: clamp(4px, 2cqi, 10px);
    color: var(--theme-text);
    font-size: clamp(0.7rem, 5cqi, 1rem);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .overlay-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .overlay-btn.add:hover {
    background: rgba(16, 185, 129, 0.4);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .overlay-btn.add span {
    font-weight: 500;
  }

  /* Hide text on very small cells */
  @container cell (max-width: 120px) {
    .overlay-btn span {
      display: none;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .cell-toolbar,
    .cell-overlay,
    .toolbar-btn,
    .overlay-btn {
      transition: none;
    }
  }
</style>
