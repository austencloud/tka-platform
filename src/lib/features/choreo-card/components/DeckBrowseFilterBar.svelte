<script lang="ts">
  import type { DeckBrowseState } from "../state/deck-browse-state.svelte";
  import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import { LOOP_TYPE_LABELS } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { VTG_FAMILY_LABELS } from "../state/deck-browse-types";

  interface Props {
    state: DeckBrowseState;
  }

  const { state: deckState }: Props = $props();

  let expanded = $state(true);

  function loopTypeLabel(type: string): string {
    return (LOOP_TYPE_LABELS as Record<string, string>)[type] ?? capitalize(type);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTurn(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    return m ? `${m[1]}T` : capitalize(turn.replace(/-/g, ' '));
  }

  const chipColor = $derived(deckState.collection === 'VTG' ? '#b763cd' : '#63b7cd');

  const hasActiveFilters = $derived(
    deckState.filters.loopTypes.length > 0 ||
    deckState.filters.vtgFamilies.length > 0 ||
    deckState.filters.sliceTypes.length > 0 ||
    deckState.filters.gridModes.length > 0 ||
    deckState.filters.stepCounts.length > 0 ||
    deckState.filters.turnPatterns.length > 0
  );
</script>

<div class="filter-bar">
  <div class="filter-header">
    <div class="collection-toggle">
      <button
        class="collection-pill"
        class:active={deckState.collection === 'LOOPs'}
        onclick={() => deckState.setCollection('LOOPs')}
        type="button"
        aria-label="Browse LOOPs collection"
      >LOOPs</button>
      <button
        class="collection-pill vtg"
        class:active={deckState.collection === 'VTG'}
        onclick={() => deckState.setCollection('VTG')}
        type="button"
        aria-label="Browse VTG collection"
      >VTG</button>
    </div>

    <span class="deck-count">{deckState.totalCount} decks</span>

    <button
      class="collapse-toggle mobile-only"
      onclick={() => { expanded = !expanded; }}
      type="button"
      aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
    >
      <i class="fas fa-chevron-{expanded ? 'up' : 'down'}" aria-hidden="true"></i>
    </button>
  </div>

  {#if expanded}
    <div class="filter-rows">
      <FilterChipRow>
        {#if deckState.collection === 'LOOPs'}
          {#each deckState.availableFilters.loopTypes as type (type)}
            <FilterChipBase
              label={loopTypeLabel(type)}
              active={deckState.filters.loopTypes.includes(type)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => deckState.toggleFilter('loopTypes', type)}
            />
          {/each}
        {:else}
          {#each deckState.availableFilters.vtgFamilies as family (family)}
            <FilterChipBase
              label={VTG_FAMILY_LABELS[family] ?? capitalize(family)}
              active={deckState.filters.vtgFamilies.includes(family)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => deckState.toggleFilter('vtgFamilies', family)}
            />
          {/each}
        {/if}
      </FilterChipRow>

      <FilterChipRow>
        {#each deckState.availableFilters.sliceTypes as slice (slice)}
          <FilterChipBase
            label={capitalize(slice)}
            active={deckState.filters.sliceTypes.includes(slice)}
            mode="toggle"
            chipColor={chipColor}
            onclick={() => deckState.toggleFilter('sliceTypes', slice)}
          />
        {/each}

        {#if deckState.availableFilters.gridModes.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each deckState.availableFilters.gridModes as grid (grid)}
            <FilterChipBase
              label={capitalize(grid)}
              active={deckState.filters.gridModes.includes(grid)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => deckState.toggleFilter('gridModes', grid)}
            />
          {/each}
        {/if}

        {#if deckState.availableFilters.stepCounts.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each deckState.availableFilters.stepCounts as count (count)}
            <FilterChipBase
              label={String(count)}
              active={deckState.filters.stepCounts.includes(count)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => deckState.toggleFilter('stepCounts', count)}
            />
          {/each}
        {/if}

        {#if deckState.availableFilters.turnPatterns.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each deckState.availableFilters.turnPatterns as turn (turn)}
            <FilterChipBase
              label={formatTurn(turn)}
              active={deckState.filters.turnPatterns.includes(turn)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => deckState.toggleFilter('turnPatterns', turn)}
            />
          {/each}
        {/if}
      </FilterChipRow>

      {#if hasActiveFilters}
        <button class="clear-btn" onclick={() => deckState.clearFilters()} type="button" aria-label="Clear all filters">
          <i class="fas fa-times" aria-hidden="true"></i> Clear filters
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .filter-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .collection-toggle {
    display: flex;
  }

  .collection-pill {
    padding: 8px 18px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .collection-pill:first-child { border-radius: 8px 0 0 8px; }
  .collection-pill:last-child { border-radius: 0 8px 8px 0; border-left: 0; }

  .collection-pill.active {
    background: var(--loop-accent-bg, rgba(99, 183, 205, 0.15));
    border-color: var(--loop-accent-border, rgba(99, 183, 205, 0.4));
    color: var(--theme-text, #fff);
  }

  .collection-pill.vtg.active {
    background: var(--vtg-accent-bg, rgba(183, 99, 205, 0.15));
    border-color: var(--vtg-accent-border, rgba(183, 99, 205, 0.4));
  }

  .deck-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }

  .filter-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chip-divider {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
    font-size: 16px;
    padding: 0 4px;
    user-select: none;
  }

  .clear-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .clear-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .collapse-toggle { display: none; }

  @media (max-width: 768px) {
    .filter-bar { padding: 12px 16px; }
    .collapse-toggle.mobile-only { display: block; background: none; border: none; color: var(--theme-text-muted); font-size: 14px; cursor: pointer; padding: 8px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .collection-pill, .clear-btn { transition: none; }
  }
</style>
