<!--
LOOPFilterChip.svelte - Dropdown chip for LOOP component filtering.
Color-coded icons per primitive. Rotated splits into halved/quartered.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import FilterChipBase from "./FilterChipBase.svelte";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { LOOP_COMPONENT_MAP } from "$lib/shared/browse/domain/constants/loop-constants";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    activeValue: string | null;
    loopTypeCounts: Readonly<Record<string, number>>;
    onSelect: (value: string | null) => void;
  }

  let { activeValue, loopTypeCounts, onSelect }: Props = $props();

  let isOpen = $state(false);
  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  interface LOOPFilterOption {
    value: string | null;
    label: string;
    icon: string;
    color: string;
    count?: number;
  }

  const rotatedInfo = LOOP_COMPONENT_MAP.get(LOOPComponent.ROTATED)!;

  const filterOptions: LOOPFilterOption[] = [
    { value: null, label: "All", icon: "", color: "" },
    {
      value: "component:rotated_halved",
      label: "Rotated (halved)",
      icon: "fas fa-rotate",
      color: rotatedInfo.color,
    },
    {
      value: "component:rotated_quartered",
      label: "Rotated (quartered)",
      icon: "fas fa-arrows-spin",
      color: rotatedInfo.color,
    },
    ...[
      LOOPComponent.MIRRORED,
      LOOPComponent.FLIPPED,
      LOOPComponent.SWAPPED,
      LOOPComponent.INVERTED,
      LOOPComponent.REWOUND,
    ].map((comp) => {
      const info = LOOP_COMPONENT_MAP.get(comp)!;
      return {
        value: `component:${comp}`,
        label: info.label,
        icon: `fas fa-${info.icon}`,
        color: info.color,
      };
    }),
  ];

  const selectedOption = $derived(
    filterOptions.find((o) => o.value === activeValue) ?? filterOptions[0]
  );

  const chipLabel = $derived(
    activeValue ? (selectedOption?.label ?? "LOOP") : "LOOP"
  );

  const chipColor = $derived(
    activeValue ? (selectedOption?.color ?? "#8b5cf6") : "#8b5cf6"
  );

  const isActive = $derived(activeValue !== null);

  const optionsWithCounts = $derived.by(() => {
    if (!isOpen) return filterOptions;
    return filterOptions.map((opt) => ({
      ...opt,
      count: opt.value ? (loopTypeCounts[opt.value] ?? 0) : undefined,
    }));
  });

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(value: string | null) {
    hapticService?.trigger("selection");
    onSelect(value);
    isOpen = false;
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".loop-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside, true);
  });
</script>

<div class="loop-chip-wrapper">
  <FilterChipBase
    label={chipLabel}
    icon="fas fa-sync-alt"
    active={isActive}
    chipColor={chipColor}
    mode="dropdown"
    expanded={isOpen}
    onclick={handleToggle}
    ghostKind="browse-filter"
  >
    {#snippet children()}
      {#each optionsWithCounts as option}
        <button
          class="popover-option"
          data-ghost="safe"
          data-ghost-kind="filter-option"
          class:selected={activeValue === option.value}
          style={option.value === activeValue && option.color
            ? `color: ${option.color};`
            : ""}
          type="button"
          role="option"
          aria-selected={activeValue === option.value}
          onclick={() => handleSelect(option.value)}
        >
          <span class="option-content">
            {#if option.icon}
              <i
                class={option.icon}
                style="color: {option.color};"
                aria-hidden="true"
              ></i>
            {/if}
            <span>
              {option.label}
              {#if option.count != null}
                <span class="option-count">({option.count})</span>
              {/if}
            </span>
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
  .loop-chip-wrapper {
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
    font-weight: 600;
  }

  .popover-option > i {
    font-size: 10px;
  }

  .option-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .option-content > i {
    width: 16px;
    text-align: center;
    font-size: 13px;
    flex-shrink: 0;
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
