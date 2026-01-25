<!--
Sequence Top Bar Controls - 2026 Modern Design (Compact)
- Source toggle chips (Community / My Library) on far left
- Sort chips centered
- Filter button opens drawer with scope toggle + drill-down filters
- Active filter shown as dismissible chip
-->
<script lang="ts">
  import { sequenceControlsManager } from "../state/sequence-controls-state.svelte";
  import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
  import { sequenceSourceManager, type SequenceSource } from "../state/sequence-source-state.svelte";
  import { gridZoomManager } from "../state/grid-zoom-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { BrowseSortMethod } from "../domain/enums/browse-enums";

  interface Props {
    onSourceChange?: (source: SequenceSource) => void;
  }

  let { onSourceChange }: Props = $props();

  // Get source state
  const currentSource = $derived(sequenceSourceManager.current);
  const canViewMyLibrary = $derived(sequenceSourceManager.canViewMyLibrary);

  // Get sequence controls from global reactive state
  const sequenceControls = $derived(sequenceControlsManager.current);

  // Check if filter panel is already open (hide button to avoid redundant UI)
  const isFilterPanelOpen = $derived(sequencePanelManager.isFiltersOpen);

  // Grid zoom state
  const currentColumns = $derived(gridZoomManager.columns);
  const canZoomIn = $derived(gridZoomManager.canZoomIn);
  const canZoomOut = $derived(gridZoomManager.canZoomOut);

  // Services
  let hapticService: IHapticFeedback | null = null;

  // Check if there's an active filter
  const hasActiveFilter = $derived(
    sequenceControls?.currentFilter?.type !== "all"
  );

  // Get active filter label for display
  const activeFilterLabel = $derived.by(() => {
    if (!sequenceControls?.currentFilter) return null;
    const filter = sequenceControls.currentFilter;
    if (filter.type === "all") return null;
    if (filter.type === "favorites") return "Favorites";
    if (filter.type === "difficulty") return `Level ${filter.value}`;
    if (filter.type === "startingLetter") return `Letter ${filter.value}`;
    if (filter.type === "length") return `${filter.value} steps`;
    if (filter.type === "startingPosition") return filter.value;
    return filter.type;
  });

  // Sort options
  const sortOptions = [
    { id: BrowseSortMethod.ALPHABETICAL, label: "A-Z", icon: "fa-font" },
    { id: BrowseSortMethod.DATE_ADDED, label: "New", icon: "fa-clock" },
    {
      id: BrowseSortMethod.DIFFICULTY_LEVEL,
      label: "Level",
      icon: "fa-signal",
    },
    {
      id: BrowseSortMethod.SEQUENCE_LENGTH,
      label: "Length",
      icon: "fa-ruler",
    },
  ];

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleSortChange(method: BrowseSortMethod) {
    hapticService?.trigger("selection");
    if (sequenceControls) {
      sequenceControls.onSortMethodChange(method);
    }
  }

  function handleOpenFilters() {
    hapticService?.trigger("selection");
    sequencePanelManager.openFilters();
  }

  function handleClearFilter() {
    hapticService?.trigger("selection");
    if (sequenceControls) {
      sequenceControls.onFilterChange({ type: "all", value: null });
    }
  }

  function handleSourceChange(source: SequenceSource) {
    hapticService?.trigger("selection");
    sequenceSourceManager.setSource(source);
    onSourceChange?.(source);
  }

  function handleZoomIn() {
    hapticService?.trigger("selection");
    gridZoomManager.zoomIn();
  }

  function handleZoomOut() {
    hapticService?.trigger("selection");
    gridZoomManager.zoomOut();
  }
</script>

{#if sequenceControls}
  <div class="sequence-topbar-controls">
    <div class="controls-row">
      <!-- Left: Source toggle -->
      <div class="nav-section">
        <div class="source-toggle">
          <button
            class="source-chip"
            class:active={currentSource === "community"}
            onclick={() => handleSourceChange("community")}
          >
            <i class="fas fa-globe" aria-hidden="true"></i>
            <span class="chip-label">Community</span>
          </button>
          {#if canViewMyLibrary}
            <button
              class="source-chip"
              class:active={currentSource === "my-library"}
              onclick={() => handleSourceChange("my-library")}
            >
              <i class="fas fa-bookmark" aria-hidden="true"></i>
              <span class="chip-label">My Library</span>
            </button>
          {/if}
        </div>
      </div>

      <!-- Center: Sort Chips (truly centered) -->
      <div class="center-section">
        <div class="sort-chips">
          {#each sortOptions as opt}
            <button
              class="sort-chip"
              class:active={sequenceControls.currentSortMethod === opt.id}
              onclick={() => handleSortChange(opt.id)}
            >
              <i class="fas {opt.icon}" aria-hidden="true"></i>
              <span class="chip-label">{opt.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Right: Zoom controls + Filter controls -->
      <div class="filter-section">
        <!-- Grid Zoom Controls -->
        <div class="zoom-controls">
          <button
            class="zoom-button"
            onclick={handleZoomOut}
            disabled={!canZoomOut}
            type="button"
            aria-label="Zoom out (larger cards)"
            title="Larger cards"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="zoom-indicator">{currentColumns}</span>
          <button
            class="zoom-button"
            onclick={handleZoomIn}
            disabled={!canZoomIn}
            type="button"
            aria-label="Zoom in (smaller cards)"
            title="Smaller cards"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Active Filter (if any) -->
        {#if hasActiveFilter && activeFilterLabel}
          <button class="active-filter-chip" onclick={handleClearFilter}>
            <span>{activeFilterLabel}</span>
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        {/if}

        <!-- Filter Button - Hidden when filter panel is already open -->
        {#if !isFilterPanelOpen}
          <button
            class="filter-button"
            class:has-active={hasActiveFilter}
            onclick={handleOpenFilters}
            type="button"
            aria-label="Open filters"
          >
            <i class="fas fa-sliders-h" aria-hidden="true"></i>
            {#if hasActiveFilter}
              <span class="filter-badge">1</span>
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sequence-topbar-controls {
    --control-height: var(--min-touch-target);
    --padding-vertical: 10px;

    display: flex;
    align-items: center;
    padding: var(--padding-vertical) 16px;
    background: var(--theme-panel-bg);
    width: 100%;
    /* Prevent collapse when filter panel is open and sections are empty */
    min-height: calc(var(--control-height) + var(--padding-vertical) * 2);
  }

  /* Three-section layout: left (nav) - center (chips) - right (filter) */
  .controls-row {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
  }

  /* Left section - source toggle */
  .nav-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    min-width: 104px;
  }

  /* Source Toggle */
  .source-toggle {
    display: flex;
    gap: 4px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 100px;
    padding: 3px;
  }

  .source-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 12px;
    min-height: calc(var(--control-height) - 8px);
    background: transparent;
    border: none;
    border-radius: 100px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .source-chip:hover {
    color: var(--theme-text);
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
  }

  .source-chip.active {
    background: var(--theme-accent);
    color: var(--theme-text);
    font-weight: 600;
  }

  .source-chip i {
    font-size: var(--font-size-compact);
  }

  /* Center section - absolutely centered chips */
  .center-section {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
  }

  /* Right section - filter controls */
  .filter-section {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }

  /* Sort Chips */
  .sort-chips {
    display: flex;
    gap: 6px;
  }

  .sort-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 14px;
    min-height: var(--control-height);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 100px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .sort-chip:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .sort-chip.active {
    background: var(--semantic-info, var(--semantic-info));
    border-color: var(--semantic-info, var(--semantic-info));
    color: var(--theme-text);
  }

  .sort-chip i {
    font-size: var(--font-size-compact);
  }

  /* Active Filter Chip */
  .active-filter-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px 0 16px;
    min-height: var(--control-height);
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 15%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 30%,
        transparent
      );
    border-radius: 100px;
    color: var(--semantic-info, var(--semantic-info));
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .active-filter-chip:hover {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 25%,
      transparent
    );
  }

  .active-filter-chip i {
    font-size: var(--font-size-compact);
    opacity: 0.8;
  }

  /* Zoom Controls */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 2px;
  }

  .zoom-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .zoom-button:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .zoom-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-indicator {
    min-width: 20px;
    text-align: center;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }

  /* Filter Button */
  .filter-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .filter-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .filter-button.has-active {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 30%,
      transparent
    );
    color: var(--semantic-info, var(--semantic-info));
  }

  .filter-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--semantic-info, var(--semantic-info));
    border-radius: 50%;
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    font-weight: 700;
  }

  /* Mobile responsive - hide labels on small screens */
  @media (max-width: 640px) {
    .sequence-topbar-controls {
      padding: 8px 12px;
    }

    .source-toggle {
      padding: 2px;
    }

    .source-chip {
      padding: 0 10px;
      min-height: 32px;
    }

    .sort-chip {
      padding: 0 10px;
    }

    .chip-label {
      display: none;
    }

    .sort-chip i,
    .source-chip i {
      font-size: var(--font-size-base);
    }
  }

  /* Very small screens - even more compact */
  @media (max-width: 400px) {
    .source-toggle {
      gap: 2px;
    }

    .source-chip {
      padding: 0 8px;
    }
  }
</style>
