<!--
PatternFilterChip.svelte - Dropdown chip for LOOP type filtering.
Shows circular/non-circular/specific LOOP types with counts.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import FilterChipBase from "../FilterChipBase.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount } from "svelte";

  interface Props {
    activeValue: string | null;
    loopTypeCounts: Record<string, number>;
    onSelect: (value: string | null) => void;
  }

  let { activeValue, loopTypeCounts, onSelect }: Props = $props();

  let isOpen = $state(false);
  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  const label = $derived(activeValue ? formatLabel(activeValue) : t('browse_chip_pattern'));
  const isActive = $derived(activeValue !== null);

  function formatLabel(value: string): string {
    if (value === "circular") return t('browse_pattern_circular');
    if (value === "non_circular") return "Freeform";
    // Strip legacy "strict_" prefix, then title-case: "rotated" → "Rotated"
    return value
      .replace(/^strict_/, "")
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  interface FilterOption {
    value: string | null;
    label: string;
    count?: number;
    separator?: boolean;
  }

  const options = $derived.by(() => {
    const items: FilterOption[] = [
      { value: null, label: t('browse_all_patterns') },
    ];

    const nonCircularCount = loopTypeCounts["_non_circular"] ?? 0;
    if (nonCircularCount > 0) {
      items.push({ value: "non_circular", label: t('browse_pattern_non_circular'), count: nonCircularCount });
    }

    // Collect specific LOOP types (skip meta keys starting with "_")
    const loopTypes: FilterOption[] = [];
    for (const [key, count] of Object.entries(loopTypeCounts)) {
      if (key.startsWith("_")) continue;
      loopTypes.push({ value: key, label: formatLabel(key), count });
    }

    // Add separator + LOOP types if any exist
    if (loopTypes.length > 0) {
      items.push({ value: "__sep__", label: "", separator: true });
      items.push(...loopTypes);
    }

    return items;
  });

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(value: string | null) {
    hapticService?.trigger("selection");
    onSelect(value);
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".pattern-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  });
</script>

<div class="pattern-chip-wrapper">
  <FilterChipBase
    {label}
    icon="fas fa-sync-alt"
    active={isActive}
    chipColor="#8b5cf6"
    mode="dropdown"
    expanded={isOpen}
    onclick={handleToggle}
  >
    {#snippet children()}
      {#each options as option}
        {#if option.separator}
          <div class="popover-separator" role="separator"></div>
        {:else}
          <button
            class="popover-option"
            class:selected={activeValue === option.value}
            type="button"
            role="option"
            aria-selected={activeValue === option.value}
            onclick={() => handleSelect(option.value)}
          >
            <span>
              {option.label}
              {#if option.count != null}
                <span class="option-count">({option.count})</span>
              {/if}
            </span>
            {#if activeValue === option.value}
              <i class="fas fa-check" aria-hidden="true"></i>
            {/if}
          </button>
        {/if}
      {/each}
    {/snippet}
  </FilterChipBase>
</div>

<style>
  .pattern-chip-wrapper {
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
    color: #8b5cf6;
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

  .popover-separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  @media (prefers-reduced-motion: reduce) {
    .popover-option {
      transition: none;
    }
  }
</style>
