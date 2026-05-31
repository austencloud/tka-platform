<!--
MultiSelectPositionPicker.svelte - Grid for toggling positions on/off

Displays all 16 positions with toggle behavior:
- Enabled (bright): Position will be used for generation
- Disabled (dimmed): Position is blocked from use

Uses blocklist approach: positions in blockedPositions are excluded.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import {
    GridMode,
    GridPosition,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { getLetterBorderColorSafe } from "$lib/shared/pictograph/shared/utils/letter-border-utils";
  import { createStartPositionVariations } from "./start-position-utils";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";

  let {
    blockedPositions = [],
    onBlockedChange,
    gridMode: gridModeProp = GridMode.DIAMOND,
  } = $props<{
    blockedPositions: GridPosition[];
    onBlockedChange: (blocked: GridPosition[]) => void;
    gridMode?: GridMode;
  }>();

  // State
  let variations = $state<PictographData[]>([]);
  let hapticService: HapticFeedback | null = $state(null);
  let isLoading = $state(true);

  // Convert blockedPositions to Set for O(1) lookup
  const blockedSet = $derived(new Set(blockedPositions));

  // Load variations based on grid mode (reactive to prop changes)
  function loadVariations(mode: GridMode) {
    variations = startPositionManager.getAllStartPositionVariations(mode);
  }

  // React to gridMode prop changes
  $effect(() => {
    if (!isLoading) {
      loadVariations(gridModeProp);
    }
  });

  onMount(async () => {
    try {
      hapticService = getHapticFeedback() ?? null;
      loadVariations(gridModeProp);
    } catch (error) {
      console.warn(
        "MultiSelectPositionPicker: Failed to load variations, using fallback:",
        error
      );
      variations = createStartPositionVariations(gridModeProp);
    } finally {
      isLoading = false;
    }
  });

  /**
   * Toggle a position's blocked state
   */
  function togglePosition(position: GridPosition) {
    hapticService?.trigger("selection");

    const newBlocked = blockedSet.has(position)
      ? blockedPositions.filter((p: GridPosition) => p !== position) // Remove from blocked
      : [...blockedPositions, position]; // Add to blocked

    onBlockedChange(newBlocked);
  }

  /**
   * Check if a position is enabled (not blocked)
   */
  function isEnabled(position: GridPosition): boolean {
    return !blockedSet.has(position);
  }

  function handleKeydown(e: KeyboardEvent, position: GridPosition) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePosition(position);
    }
  }

  // Count enabled positions
  const enabledCount = $derived(variations.length - blockedPositions.length);
</script>

<div class="multi-select-grid">
  {#if isLoading}
    <div class="loading-placeholder">
      <span>Loading positions...</span>
    </div>
  {:else}
    <!-- Status indicator -->
    <div class="status-row">
      <span class="status-text">
        {#if enabledCount === variations.length}
          All {variations.length} positions enabled
        {:else if enabledCount === 0}
          No positions enabled
        {:else}
          {enabledCount} of {variations.length} positions enabled
        {/if}
      </span>
      <span class="hint-text">Tap to toggle</span>
    </div>

    <!-- Position grid -->
    <div class="variations-grid">
      {#each variations as position (position.id)}
        {@const gridPos = position.startPosition as GridPosition}
        {@const enabled = isEnabled(gridPos)}
        <button
          class="position-cell"
          class:enabled
          class:disabled={!enabled}
          onclick={() => togglePosition(gridPos)}
          onkeydown={(e) => handleKeydown(e, gridPos)}
          type="button"
          style:--letter-border-color={getLetterBorderColorSafe(
            position.letter
          )}
          aria-label="{enabled ? 'Disable' : 'Enable'} position {position.startPosition}"
          aria-pressed={enabled}
        >
          <div class="pictograph-wrapper">
            <PictographContainer pictographData={position} />
          </div>
          {#if !enabled}
            <div class="disabled-overlay">
              <svg class="x-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .multi-select-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 0;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .status-text {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, white);
    font-weight: 500;
  }

  .hint-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .loading-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .variations-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 4px;
  }

  .position-cell {
    position: relative;
    aspect-ratio: 1 / 1;
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    padding: 4px;
    transition: all var(--duration-normal) ease;
    overflow: hidden;
  }

  /* Enabled state - bright and ready */
  .position-cell.enabled {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--letter-border-color, rgba(100, 200, 255, 0.6));
    box-shadow: 0 0 8px rgba(100, 200, 255, 0.15);
  }

  .position-cell.enabled:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: var(--letter-border-color, rgba(100, 200, 255, 0.8));
    transform: scale(1.02);
  }

  /* Disabled state - dimmed with X overlay */
  .position-cell.disabled {
    background: rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.1);
    opacity: 0.5;
  }

  .position-cell.disabled:hover {
    opacity: 0.7;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .position-cell:active {
    transform: scale(0.96);
  }

  .pictograph-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pictograph-wrapper :global(.pictograph) {
    width: 100%;
    height: 100%;
  }

  .pictograph-wrapper :global(.pictograph svg) {
    width: 100%;
    height: 100%;
  }

  .disabled-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
  }

  .x-icon {
    width: 32px;
    height: 32px;
    color: rgba(255, 100, 100, 0.8);
  }

  /* Smaller gap on mobile */
  @media (max-width: 380px) {
    .variations-grid {
      gap: 6px;
    }

    .position-cell {
      padding: 2px;
    }

    .x-icon {
      width: 24px;
      height: 24px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .position-cell {
      transition: none;
    }
  }
</style>
