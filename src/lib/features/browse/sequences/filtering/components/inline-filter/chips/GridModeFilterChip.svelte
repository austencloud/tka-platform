<!--
GridModeFilterChip.svelte - Dropdown chip for grid mode filtering.
Options: All, Diamond, Box, Skewed. Each shows contextual count.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/filtering-types";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    activeGridMode: string | null;
    onSelect: (gridMode: string | null) => void;
    getFilteredCount?: (candidateType: BrowseFilterType, candidateValue: BrowseFilterValue) => number;
  }

  let { activeGridMode, onSelect, getFilteredCount }: Props = $props();

  let isOpen = $state(false);
  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  const label = $derived(
    activeGridMode
      ? activeGridMode.charAt(0).toUpperCase() + activeGridMode.slice(1)
      : t('browse_chip_grid_mode')
  );
  const isActive = $derived(activeGridMode !== null);

  const gridModeCounts = $derived.by(() => {
    if (!isOpen || !getFilteredCount) return null;
    return {
      diamond: getFilteredCount(BrowseFilterType.GRID_MODE, "diamond"),
      box: getFilteredCount(BrowseFilterType.GRID_MODE, "box"),
      skewed: getFilteredCount(BrowseFilterType.GRID_MODE, "skewed"),
    };
  });

  const modes: { value: string | null; label: string }[] = [
    { value: null, label: t('browse_all_grid_modes') },
    { value: "diamond", label: t('browse_grid_diamond') },
    { value: "box", label: t('browse_grid_box') },
    { value: "skewed", label: t('browse_grid_skewed') },
  ];

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(gridMode: string | null) {
    hapticService?.trigger("selection");
    onSelect(gridMode);
    isOpen = false;
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".grid-mode-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside, true);
  });
</script>

<div class="grid-mode-chip-wrapper">
  <FilterChipBase
    {label}
    icon="fas fa-th"
    active={isActive}
    chipColor="#14b8a6"
    mode="dropdown"
    expanded={isOpen}
    onclick={handleToggle}
  >
    {#snippet children()}
      {#each modes as mode}
        <button
          class="popover-option"
          class:selected={activeGridMode === mode.value}
          type="button"
          role="option"
          aria-selected={activeGridMode === mode.value}
          onclick={() => handleSelect(mode.value)}
        >
          <span>
            {mode.label}
            {#if mode.value !== null && gridModeCounts}
              <span class="option-count">({gridModeCounts[mode.value as "diamond" | "box" | "skewed"]})</span>
            {/if}
          </span>
          {#if activeGridMode === mode.value}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    {/snippet}
  </FilterChipBase>
</div>

<style>
  .grid-mode-chip-wrapper {
    position: relative;
  }

  .popover-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .popover-option:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .popover-option.selected {
    color: #14b8a6;
    font-weight: 600;
  }

  .popover-option i {
    font-size: 10px;
  }

  .option-count {
    opacity: 0.6;
    font-weight: 400;
    margin-left: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .popover-option {
      transition: none;
    }
  }
</style>
