<!--
  CatalogInteriorFilterPanel.svelte - Filter bar for the deck interior (Level 2).
  Family multi-select + start position filter.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";
  import FamilyFilterChip from "./FamilyFilterChip.svelte";
  import type { CatalogFamily } from "../../domain/models/Catalog";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import { onMount } from "svelte";

  interface Props {
    isOpen: boolean;
    families: readonly CatalogFamily[];
    selectedFamilyIds: string[];
    activePosition: string | null;
    onFamilyChange: (familyIds: string[]) => void;
    onPositionChange: (position: string | null) => void;
  }

  const {
    isOpen,
    families,
    selectedFamilyIds,
    activePosition,
    onFamilyChange,
    onPositionChange,
  }: Props = $props();

  let posOpen = $state(false);
  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  const positions = [
    { id: "alpha", label: "Alpha (α)" },
    { id: "beta", label: "Beta (β)" },
    { id: "gamma", label: "Gamma (γ)" },
  ];

  const posLabel = $derived(
    activePosition
      ? positions.find((p) => p.id === activePosition)?.label ?? "Position"
      : "Position",
  );

  function handlePosSelect(posId: string | null) {
    hapticService?.trigger("selection");
    onPositionChange(posId === activePosition ? null : posId);
    posOpen = false;
  }

  function handlePosPointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".pos-chip-wrapper")) {
      posOpen = false;
    }
  }

  $effect(() => {
    if (!posOpen) return;
    document.addEventListener("pointerdown", handlePosPointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePosPointerDownOutside, true);
  });
</script>

{#if isOpen}
  <div class="deck-interior-filters">
    <FilterChipRow>
      {#snippet children()}
        <FamilyFilterChip
          {families}
          {selectedFamilyIds}
          onFilterChange={onFamilyChange}
        />
        <div class="pos-chip-wrapper">
          <FilterChipBase
            label={posLabel}
            icon="fas fa-crosshairs"
            active={activePosition !== null}
            chipColor="#06b6d4"
            mode="dropdown"
            expanded={posOpen}
            onclick={() => {
              posOpen = !posOpen;
            }}
          >
            {#snippet children()}
              <div class="pos-popover" role="listbox" aria-label="Filter by start position">
                <button
                  class="popover-option"
                  class:selected={activePosition === null}
                  onclick={() => handlePosSelect(null)}
                  role="option"
                  aria-selected={activePosition === null}
                  aria-label="All Positions"
                  type="button"
                >
                  <span>All Positions</span>
                  {#if activePosition === null}
                    <i class="fas fa-check" aria-hidden="true"></i>
                  {/if}
                </button>
                <div class="popover-separator" role="separator"></div>
                {#each positions as pos (pos.id)}
                  <button
                    class="popover-option"
                    class:selected={activePosition === pos.id}
                    onclick={() => handlePosSelect(pos.id)}
                    role="option"
                    aria-selected={activePosition === pos.id}
                    aria-label="Filter by {pos.id}"
                    type="button"
                  >
                    <span>{pos.label}</span>
                    {#if activePosition === pos.id}
                      <i class="fas fa-check" aria-hidden="true"></i>
                    {/if}
                  </button>
                {/each}
              </div>
            {/snippet}
          </FilterChipBase>
        </div>
      {/snippet}
    </FilterChipRow>
  </div>
{/if}

<style>
  .deck-interior-filters {
    padding: 0 4px;
  }

  .pos-chip-wrapper {
    position: relative;
  }

  .pos-popover {
    display: flex;
    flex-direction: column;
    min-width: 180px;
  }

  .popover-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
    width: 100%;
  }

  .popover-option:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
  }

  .popover-option.selected {
    background: var(--filter-accent-bg, rgba(6, 182, 212, 0.15));
  }

  .popover-separator {
    height: 1px;
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    margin: 4px 0;
  }

  :global(.fa-check) {
    font-size: 12px;
    color: var(--filter-accent, #06b6d4);
  }
</style>
