<!--
PatternFilterChip.svelte - Dropdown chip for LOOP type filtering.
Shows circular/non-circular/specific LOOP types with counts.
-->
<script lang="ts">
  import FilterChipBase from "../FilterChipBase.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
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
    hapticService = container.items.hapticFeedback ?? null;
  });

  const label = $derived(activeValue ? formatLabel(activeValue) : "Pattern");
  const isActive = $derived(activeValue !== null);

  function formatLabel(value: string): string {
    if (value === "circular") return "Circular";
    if (value === "non_circular") return "Non-circular";
    // Capitalize first letter
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  const options = $derived.by(() => {
    const items: { value: string | null; label: string; count?: number }[] = [
      { value: null, label: "All Patterns" },
    ];

    const circularCount = loopTypeCounts["_circular"] ?? 0;
    const nonCircularCount = loopTypeCounts["_non_circular"] ?? 0;

    if (circularCount > 0) {
      items.push({ value: "circular", label: "Circular", count: circularCount });
    }
    if (nonCircularCount > 0) {
      items.push({ value: "non_circular", label: "Non-circular", count: nonCircularCount });
    }

    // Add specific LOOP types (skip meta keys)
    for (const [key, count] of Object.entries(loopTypeCounts)) {
      if (key.startsWith("_")) continue;
      items.push({ value: key, label: formatLabel(key), count });
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

  @media (prefers-reduced-motion: reduce) {
    .popover-option {
      transition: none;
    }
  }
</style>
