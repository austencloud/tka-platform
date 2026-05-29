<!--
LevelFilterChip.svelte - Dropdown chip for difficulty level filtering.
Options: All, Level 1, Level 2, Level 3. Each shows contextual count.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import FilterChipBase from "./FilterChipBase.svelte";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    activeLevel: number | null;
    onSelect: (level: number | null) => void;
    getFilteredCount?: (candidateType: BrowseFilterType, candidateValue: BrowseFilterValue) => number;
  }

  let { activeLevel, onSelect, getFilteredCount }: Props = $props();

  let isOpen = $state(false);
  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  const label = $derived(activeLevel ? t('browse_filter_level', { level: String(activeLevel) }) : t('browse_chip_level'));
  const isActive = $derived(activeLevel !== null);

  // Compute counts lazily when dropdown is open
  const levelCounts = $derived.by(() => {
    if (!isOpen || !getFilteredCount) return null;
    return {
      1: getFilteredCount(BrowseFilterType.DIFFICULTY, 1),
      2: getFilteredCount(BrowseFilterType.DIFFICULTY, 2),
      3: getFilteredCount(BrowseFilterType.DIFFICULTY, 3),
    };
  });

  const levels: { value: number | null; label: string }[] = [
    { value: null, label: t('browse_all_levels') },
    { value: 1, label: t('browse_level_n', { n: '1' }) },
    { value: 2, label: t('browse_level_n', { n: '2' }) },
    { value: 3, label: t('browse_level_n', { n: '3' }) },
  ];

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(level: number | null) {
    hapticService?.trigger("selection");
    onSelect(level);
    isOpen = false;
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".level-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside, true);
  });
</script>

<div class="level-chip-wrapper">
  <FilterChipBase
    {label}
    icon="fas fa-layer-group"
    active={isActive}
    chipColor="var(--semantic-info)"
    mode="dropdown"
    expanded={isOpen}
    onclick={handleToggle}
  >
    {#snippet children()}
      {#each levels as level}
        <button
          class="popover-option"
          class:selected={activeLevel === level.value}
          type="button"
          role="option"
          aria-selected={activeLevel === level.value}
          onclick={() => handleSelect(level.value)}
        >
          <span>
            {level.label}
            {#if level.value !== null && levelCounts}
              <span class="option-count">({levelCounts[level.value as 1 | 2 | 3]})</span>
            {/if}
          </span>
          {#if activeLevel === level.value}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    {/snippet}
  </FilterChipBase>
</div>

<style>
  .level-chip-wrapper {
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
    color: var(--semantic-info);
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
