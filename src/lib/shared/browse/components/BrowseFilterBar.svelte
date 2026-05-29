<!--
BrowseFilterBar.svelte - Unified filter chip row + active filter chips.
Replaces InlineFilterPanel + ActiveFilterBar + picker's FilterChipRow.
Reads from / writes to a headless BrowseEngine instance.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import LevelFilterChip from "$lib/shared/browse/components/filter-chips/LevelFilterChip.svelte";
  import FavoritesFilterChip from "$lib/shared/browse/components/filter-chips/FavoritesFilterChip.svelte";
  import LengthFilterChip from "$lib/shared/browse/components/filter-chips/LengthFilterChip.svelte";
  import LOOPFilterChip from "$lib/shared/browse/components/filter-chips/LOOPFilterChip.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { BrowseEngine } from "../engine/types";

  const LOOP_FILTER_COLORS: Record<string, string> = {
    "component:rotated_halved": "#36c3ff",
    "component:rotated_quartered": "#36c3ff",
    "component:mirrored": "#6F2DA8",
    "component:flipped": "#e91e63",
    "component:swapped": "#26e600",
    "component:inverted": "#eb7d00",
    "component:rewound": "#00bcd4",
  };

  interface Props {
    engine: BrowseEngine;
  }

  let { engine }: Props = $props();

  const isHandsMode = $derived(engine.viewMode.subject === "hands");

  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  // ---------------------------------------------------------------------------
  // Derived state from engine
  // ---------------------------------------------------------------------------

  const activeLevel = $derived.by(() => {
    const f = engine.activeFilters.get("difficulty");
    return f ? (f.value as number) : null;
  });

  const isFavoritesActive = $derived(engine.activeFilters.has("favorites"));

  const activeLength = $derived.by(() => {
    const f = engine.activeFilters.get("length");
    return f && !f.locked ? (f.value as number) : null;
  });

  const hasLengthConstraint = $derived.by(() => {
    const f = engine.activeFilters.get("length");
    return f?.locked ?? false;
  });

  const activeLoopComponent = $derived.by(() => {
    const f = engine.activeFilters.get("cap_type");
    return f ? (f.value as string) : null;
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleLevelSelect(level: number | null) {
    hapticService?.trigger("selection");
    if (level == null) engine.removeFilter("difficulty");
    else engine.addFilter(BrowseFilterType.DIFFICULTY, level, `Level ${level}`, "var(--semantic-info)");
  }

  function handleFavoritesToggle(active: boolean) {
    hapticService?.trigger("selection");
    if (active) engine.addFilter(BrowseFilterType.FAVORITES, true, "Favorites", "#ec4899");
    else engine.removeFilter("favorites");
  }

  function handleLengthSelect(length: number | null) {
    hapticService?.trigger("selection");
    if (length == null) engine.removeFilter("length");
    else engine.addFilter(BrowseFilterType.LENGTH, length, `${length} beats`, "#f59e0b");
  }

  function handleLoopSelect(value: string | null) {
    hapticService?.trigger("selection");
    if (value == null) engine.removeFilter("cap_type");
    else {
      const label = value.startsWith("component:")
        ? value.slice("component:".length).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : value;
      const info = LOOP_FILTER_COLORS[value];
      engine.addFilter(BrowseFilterType.LOOP_TYPE, value, label, info ?? "#8b5cf6");
    }
  }

  function handleDismissChip(typeKey: string) {
    hapticService?.trigger("selection");
    engine.removeFilter(typeKey);
  }

  function handleClearAll() {
    hapticService?.trigger("selection");
    engine.clearUserFilters();
  }
</script>

<div class="browse-filter-bar">
  <!-- Chip row: level, favorites, length selectors -->
  <div class="filter-chip-row" role="toolbar" aria-label={t('browse_filter_options')}>
    {#if !isHandsMode}
      <LevelFilterChip
        activeLevel={activeLevel}
        onSelect={handleLevelSelect}
        getFilteredCount={engine.getFilteredCount.bind(engine)}
      />
    {/if}

    <FavoritesFilterChip
      active={isFavoritesActive}
      onToggle={handleFavoritesToggle}
    />

    {#if !hasLengthConstraint}
      <LengthFilterChip
        activeLength={activeLength}
        availableLengths={engine.availableLengths as number[]}
        onSelect={handleLengthSelect}
        getFilteredCount={engine.getFilteredCount.bind(engine)}
      />
    {/if}

    <LOOPFilterChip
      activeValue={activeLoopComponent}
      loopTypeCounts={engine.loopTypeCounts}
      onSelect={handleLoopSelect}
    />
  </div>

  <!-- Active filter chips row -->
  {#if engine.allFilterChips.length > 0}
    <div
      class="active-filter-bar"
      role="status"
      aria-live="polite"
      aria-label={t('browse_active_filters')}
    >
      <div class="active-chips-scroll">
        {#each engine.allFilterChips as chip (chip.type)}
          <span
            class="active-chip"
            style="--chip-color: {chip.chipColor};"
          >
            {#if chip.locked}
              <i class="fas fa-lock chip-lock" aria-hidden="true"></i>
            {/if}
            <span class="chip-label">{chip.label}</span>
            {#if !chip.locked}
              <button
                class="chip-dismiss"
                type="button"
                aria-label={t('browse_remove_filter', { label: chip.label })}
                onmousedown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDismissChip(String(chip.type));
                }}
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            {/if}
          </span>
        {/each}

        {#if engine.hasActiveFilters}
          <button
            class="clear-all-btn"
            type="button"
            onmousedown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleClearAll();
            }}
          >
            {t('browse_clear_all')}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .browse-filter-bar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
  }

  /* --- Chip row --- */

  .filter-chip-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    overflow-x: auto;
    padding: 0 var(--spacing-xs, 4px);
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .filter-chip-row::-webkit-scrollbar {
    display: none;
  }

  /* --- Active filter chips bar --- */

  .active-filter-bar {
    padding: var(--spacing-xs, 4px) 0;
    animation: barSlideIn var(--duration-fast, 150ms) ease;
  }

  @keyframes barSlideIn {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 48px;
    }
  }

  .active-chips-scroll {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 6px);
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .active-chips-scroll::-webkit-scrollbar {
    display: none;
  }

  .active-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: 4px 8px 4px 12px;
    min-height: 28px;
    background: color-mix(in srgb, var(--chip-color) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--chip-color) 30%, transparent);
    border-radius: 100px;
    color: var(--theme-text);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    animation: chipIn var(--duration-fast, 150ms) ease;
  }

  @keyframes chipIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .chip-lock {
    font-size: 9px;
    opacity: 0.5;
    flex-shrink: 0;
  }

  .chip-label {
    line-height: 1;
  }

  .chip-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: color-mix(in srgb, var(--theme-text, white) 15%, transparent);
    border: none;
    border-radius: 50%;
    color: var(--theme-text);
    font-size: 9px;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    transition:
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  /* Expanded touch target */
  .chip-dismiss::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 32px;
    min-height: 32px;
  }

  .chip-dismiss:hover {
    background: color-mix(in srgb, var(--theme-text, white) 25%, transparent);
    transform: scale(1.1);
  }

  .chip-dismiss:active {
    transform: scale(0.9);
  }

  .clear-all-btn {
    padding: 4px var(--spacing-md, 12px);
    min-height: 28px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 100px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  .clear-all-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  @container gallery (min-width: 900px) {
    .browse-filter-bar {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .active-filter-bar,
    .active-chip,
    .chip-dismiss,
    .clear-all-btn {
      animation: none;
      transition: none;
    }
  }
</style>
