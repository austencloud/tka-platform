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
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { getLetterBorderColorSafe } from "$lib/shared/pictograph/shared/utils/letter-border-utils";
  import { createStartPositionVariations } from "./start-position-utils";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import {
    blockAllExcept,
    hasSameBlockedPositions,
    toggleBlockedPosition,
  } from "./position-selection";

  interface PositionSelectionPreset {
    id: string;
    label: string;
    blockedPositions: GridPosition[];
  }

  let {
    blockedPositions = [],
    onBlockedChange,
    gridMode: gridModeProp = GridMode.DIAMOND,
    leftStartOrientation = Orientation.IN,
    rightStartOrientation = Orientation.IN,
    presets = [],
  } = $props<{
    blockedPositions: GridPosition[];
    onBlockedChange: (blocked: GridPosition[]) => void;
    gridMode?: GridMode;
    leftStartOrientation?: Orientation;
    rightStartOrientation?: Orientation;
    /** Named shortcuts shown beside All and Choose one. */
    presets?: PositionSelectionPreset[];
  }>();

  // State
  let variations = $state<PictographData[]>([]);
  let hapticService: HapticFeedback | null = $state(null);
  let isLoading = $state(true);
  let selectionMode = $state<"custom" | "one" | null>(null);
  let customNeedsFirstPosition = $state(false);

  // Convert blockedPositions to Set for O(1) lookup
  const blockedSet = $derived(new Set(blockedPositions));
  const allPositions = $derived(
    variations.map((variation) => variation.startPosition as GridPosition)
  );

  // Load variations based on grid mode (reactive to prop changes)
  function loadVariations(mode: GridMode) {
    selectionMode = null;
    customNeedsFirstPosition = false;
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
    if (selectionMode === "one") {
      hapticService?.trigger("success");
      selectionMode = null;
      onBlockedChange(blockAllExcept(allPositions, position));
      return;
    }

    if (selectionMode === "custom" && customNeedsFirstPosition) {
      hapticService?.trigger("success");
      customNeedsFirstPosition = false;
      onBlockedChange(blockAllExcept(allPositions, position));
      return;
    }

    const newBlocked = toggleBlockedPosition(
      allPositions,
      blockedPositions,
      position
    );
    if (newBlocked === blockedPositions) {
      hapticService?.trigger("warning");
      return;
    }

    hapticService?.trigger("selection");
    onBlockedChange(newBlocked);
  }

  function selectAll() {
    hapticService?.trigger("selection");
    selectionMode = null;
    customNeedsFirstPosition = false;
    onBlockedChange([]);
  }

  function selectPreset(preset: PositionSelectionPreset) {
    hapticService?.trigger("selection");
    selectionMode = null;
    customNeedsFirstPosition = false;
    onBlockedChange([...preset.blockedPositions]);
  }

  function toggleChooseOne() {
    hapticService?.trigger("selection");
    selectionMode = selectionMode === "one" ? null : "one";
    customNeedsFirstPosition = false;
  }

  function selectCustom() {
    hapticService?.trigger("selection");
    selectionMode = "custom";
    customNeedsFirstPosition = true;
  }

  /**
   * Check if a position is enabled (not blocked)
   */
  function isEnabled(position: GridPosition): boolean {
    return !blockedSet.has(position);
  }

  function handleKeydown(e: KeyboardEvent, position: GridPosition) {
    if (e.key === "Escape" && selectionMode !== null) {
      e.preventDefault();
      selectionMode = null;
      customNeedsFirstPosition = false;
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePosition(position);
    }
  }

  // Count enabled positions
  const enabledCount = $derived(
    allPositions.filter((position) => !blockedSet.has(position)).length
  );
  const matchingPreset = $derived(
    presets.find((preset) =>
      hasSameBlockedPositions(blockedPositions, preset.blockedPositions)
    )
  );
  const inferredSelection = $derived(
    enabledCount === variations.length
      ? "all"
      : matchingPreset
        ? `preset:${matchingPreset.id}`
        : enabledCount === 1
          ? "one"
          : "custom"
  );
  const activeSelection = $derived(selectionMode ?? inferredSelection);

  // Re-orient each variation's props to the chosen start orientation. Start
  // positions are static holds, so start == end orientation (mirrors how the
  // engine seeds beat 0). Empty until variations load. New object identity per
  // orientation change → PictographContainer re-renders.
  const displayVariations = $derived(
    variations.map((p) => ({
      ...p,
      motions: {
        ...p.motions,
        left: p.motions?.left
          ? {
              ...p.motions.left,
              startOrientation: leftStartOrientation,
              endOrientation: leftStartOrientation,
            }
          : p.motions?.left,
        right: p.motions?.right
          ? {
              ...p.motions.right,
              startOrientation: rightStartOrientation,
              endOrientation: rightStartOrientation,
            }
          : p.motions?.right,
      },
    }))
  );
</script>

<div class="multi-select-grid">
  {#if isLoading}
    <div class="loading-placeholder">
      <span>Loading positions...</span>
    </div>
  {:else}
    <div
      class="quick-actions"
      role="toolbar"
      aria-label="Quick position choices"
    >
      <FilterChipBase
        label="All"
        icon="fas fa-check-double"
        mode="toggle"
        size="sm"
        active={activeSelection === "all"}
        ariaLabel="Enable all positions"
        onclick={selectAll}
      />
      {#each presets as preset (preset.id)}
        <FilterChipBase
          label={preset.label}
          icon="fas fa-shapes"
          mode="toggle"
          size="sm"
          active={activeSelection === `preset:${preset.id}`}
          ariaLabel={`Use ${preset.label} positions`}
          onclick={() => selectPreset(preset)}
        />
      {/each}
      <FilterChipBase
        label="Custom"
        icon="fas fa-sliders"
        mode="toggle"
        size="sm"
        active={activeSelection === "custom"}
        ariaLabel="Select a custom mix of positions"
        onclick={selectCustom}
      />
      <FilterChipBase
        label="Choose one"
        icon="fas fa-bullseye"
        mode="toggle"
        size="sm"
        active={activeSelection === "one"}
        ariaLabel={selectionMode === "one"
          ? "Cancel choosing one position"
          : "Choose exactly one position"}
        onclick={toggleChooseOne}
      />
    </div>

    <!-- Status indicator -->
    <div class="status-row" aria-live="polite" aria-atomic="true">
      <span class="status-text">
        {#if selectionMode === "one"}
          Choose the one position to keep
        {:else if selectionMode === "custom" && customNeedsFirstPosition}
          Choose the first position in your mix
        {:else if selectionMode === "custom"}
          {enabledCount} of {variations.length} positions selected
        {:else if enabledCount === variations.length}
          All {variations.length} positions enabled
        {:else if enabledCount === 0}
          No positions enabled
        {:else}
          {enabledCount} of {variations.length} positions enabled
        {/if}
      </span>
      <span class="hint-text"
        >{selectionMode === "one" || customNeedsFirstPosition
          ? "Tap a position"
          : selectionMode === "custom"
            ? "Tap to add or remove"
            : "Tap to toggle"}</span
      >
    </div>

    <!-- Position grid -->
    <div class="variations-grid">
      {#each displayVariations as position (position.id)}
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
          aria-label={selectionMode === "one"
            ? `Use only position ${position.startPosition}`
            : customNeedsFirstPosition
              ? `Start custom selection with position ${position.startPosition}`
              : enabled && enabledCount === 1
                ? `Position ${position.startPosition} is the only enabled position`
                : `${enabled ? "Disable" : "Enable"} position ${position.startPosition}`}
          aria-pressed={enabled}
        >
          <div class="pictograph-wrapper">
            <PictographContainer pictographData={position} />
          </div>
          {#if !enabled}
            <div class="disabled-overlay">
              <svg
                class="x-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
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

  .quick-actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    min-height: var(--min-touch-target, 48px);
    overflow-x: auto;
    padding-inline: 4px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .quick-actions::-webkit-scrollbar {
    display: none;
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.12));
    border-color: var(--letter-border-color, rgba(100, 200, 255, 0.6));
    box-shadow: 0 0 8px rgba(100, 200, 255, 0.15);
  }

  .position-cell.enabled:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.18));
    border-color: var(--letter-border-color, rgba(100, 200, 255, 0.8));
    transform: scale(1.02);
  }

  /* Disabled state - dimmed with X overlay */
  .position-cell.disabled {
    background: rgba(0, 0, 0, 0.2);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    opacity: 0.5;
  }

  .position-cell.disabled:hover {
    opacity: 0.7;
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
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
