<!--
MaxTurnIntensityFilterChip.svelte - Dropdown chip for max-turn-intensity (≤N) filtering.
Shows available turn-intensity ceilings with contextual counts.
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
    activeIntensity: number | null;
    availableIntensities: number[];
    onSelect: (intensity: number | null) => void;
    getFilteredCount?: (candidateType: BrowseFilterType, candidateValue: BrowseFilterValue) => number;
    disabled?: boolean;
  }

  let { activeIntensity, availableIntensities, onSelect, getFilteredCount, disabled = false }: Props = $props();

  let isOpen = $state(false);
  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  // Turn ceilings can be halves (1.5), so render "≤N" verbatim — never coerce to an integer.
  const fmt = (n: number) => `≤${n}`;

  const label = $derived(activeIntensity !== null ? fmt(activeIntensity) : t('browse_chip_max_turns'));
  const isActive = $derived(activeIntensity !== null);

  // Compute counts lazily when dropdown is open
  const intensityCounts = $derived.by(() => {
    if (!isOpen || !getFilteredCount) return null;
    const counts: Record<number, number> = {};
    for (const intensity of availableIntensities) {
      counts[intensity] = getFilteredCount(BrowseFilterType.MAX_TURN_INTENSITY, intensity);
    }
    return counts;
  });

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(intensity: number | null) {
    hapticService?.trigger("selection");
    onSelect(intensity);
    isOpen = false;
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".max-turn-intensity-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside, true);
  });
</script>

{#if availableIntensities.length > 0}
  <div class="max-turn-intensity-chip-wrapper">
    <FilterChipBase
      {label}
      icon="fas fa-arrows-spin"
      active={isActive}
      chipColor="var(--max-turn-intensity-chip-color)"
      mode="dropdown"
      expanded={isOpen}
      {disabled}
      onclick={handleToggle}
    >
      {#snippet children()}
        <button
          class="popover-option"
          class:selected={activeIntensity === null}
          type="button"
          role="option"
          aria-selected={activeIntensity === null}
          onclick={() => handleSelect(null)}
        >
          <span>{t('browse_all_turn_intensities')}</span>
          {#if activeIntensity === null}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
        {#each availableIntensities as intensity}
          {#if !intensityCounts || (intensityCounts[intensity] ?? 0) > 0}
            <button
              class="popover-option"
              class:selected={activeIntensity === intensity}
              type="button"
              role="option"
              aria-selected={activeIntensity === intensity}
              onclick={() => handleSelect(intensity)}
            >
              <span>
                {fmt(intensity)}
                {#if intensityCounts}
                  <span class="option-count">({intensityCounts[intensity]})</span>
                {/if}
              </span>
              {#if activeIntensity === intensity}
                <i class="fas fa-check" aria-hidden="true"></i>
              {/if}
            </button>
          {/if}
        {/each}
      {/snippet}
    </FilterChipBase>
  </div>
{/if}

<style>
  .max-turn-intensity-chip-wrapper {
    /* Single source for this chip's accent — consumed both by FilterChipBase
       (via the chipColor prop) and by the selected-option color below.
       Distinct from Level (--semantic-info, blue) and Length (#f59e0b, amber —
       the same hex as --semantic-warning, so that token would collide). */
    --max-turn-intensity-chip-color: var(--semantic-success);
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
    color: var(--max-turn-intensity-chip-color);
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
