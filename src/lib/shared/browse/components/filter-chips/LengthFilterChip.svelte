<!--
LengthFilterChip.svelte - Dropdown chip for sequence length filtering.
Shows available lengths with contextual counts.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import FilterChipBase from "./FilterChipBase.svelte";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/filtering-types";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    activeLength: number | null;
    availableLengths: number[];
    onSelect: (length: number | null) => void;
    getFilteredCount?: (candidateType: BrowseFilterType, candidateValue: BrowseFilterValue) => number;
    disabled?: boolean;
  }

  let { activeLength, availableLengths, onSelect, getFilteredCount, disabled = false }: Props = $props();

  let isOpen = $state(false);
  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  const label = $derived(activeLength ? t('browse_n_steps', { count: String(activeLength) }) : t('browse_chip_length'));
  const isActive = $derived(activeLength !== null);

  // Compute counts lazily when dropdown is open
  const lengthCounts = $derived.by(() => {
    if (!isOpen || !getFilteredCount) return null;
    const counts: Record<number, number> = {};
    for (const len of availableLengths) {
      counts[len] = getFilteredCount(BrowseFilterType.LENGTH, len);
    }
    return counts;
  });

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(length: number | null) {
    hapticService?.trigger("selection");
    onSelect(length);
    isOpen = false;
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".length-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside, true);
  });
</script>

<div class="length-chip-wrapper">
  <FilterChipBase
    {label}
    icon="fas fa-ruler-horizontal"
    active={isActive}
    chipColor="#f59e0b"
    mode="dropdown"
    expanded={isOpen}
    {disabled}
    onclick={handleToggle}
  >
    {#snippet children()}
      <button
        class="popover-option"
        class:selected={activeLength === null}
        type="button"
        role="option"
        aria-selected={activeLength === null}
        onclick={() => handleSelect(null)}
      >
        <span>{t('browse_all_lengths')}</span>
        {#if activeLength === null}
          <i class="fas fa-check" aria-hidden="true"></i>
        {/if}
      </button>
      {#each availableLengths as length}
        {#if !lengthCounts || (lengthCounts[length] ?? 0) > 0}
          <button
            class="popover-option"
            class:selected={activeLength === length}
            type="button"
            role="option"
            aria-selected={activeLength === length}
            onclick={() => handleSelect(length)}
          >
            <span>
              {t('browse_n_steps', { count: String(length) })}
              {#if lengthCounts}
                <span class="option-count">({lengthCounts[length]})</span>
              {/if}
            </span>
            {#if activeLength === length}
              <i class="fas fa-check" aria-hidden="true"></i>
            {/if}
          </button>
        {/if}
      {/each}
    {/snippet}
  </FilterChipBase>
</div>

<style>
  .length-chip-wrapper {
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
    color: #f59e0b;
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
