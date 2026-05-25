<script lang="ts">
  import type { CatalogFamily } from "../../domain/models/Catalog";

  interface Props {
    families: readonly CatalogFamily[];
    selectedFamilyIds: string[];
    activePosition: string | null;
    totalFiltered: number;
    totalSequences: number;
    isLargeCatalog: boolean;
    onFamilyChange: (familyIds: string[]) => void;
    onPositionChange: (position: string | null) => void;
  }

  let {
    families,
    selectedFamilyIds,
    activePosition,
    totalFiltered,
    totalSequences,
    isLargeCatalog,
    onFamilyChange,
    onPositionChange,
  }: Props = $props();

  const positions = ['alpha', 'beta', 'gamma'] as const;

  function toggleFamily(id: string) {
    const current = new Set(selectedFamilyIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    onFamilyChange([...current]);
  }

  function togglePosition(pos: string) {
    onPositionChange(activePosition === pos ? null : pos);
  }
</script>

<div class="filter-bar">
  <div class="filter-section">
    <span class="filter-label">Family</span>
    <div class="chip-row">
      {#each families as family}
        <button
          class="chip"
          class:active={selectedFamilyIds.includes(family.id)}
          onclick={() => toggleFamily(family.id)}
          aria-label="Toggle {family.label} family filter"
          aria-pressed={selectedFamilyIds.includes(family.id)}
        >
          {family.label}
          <span class="chip-count">{family.sequenceIds.length}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="filter-section">
    <span class="filter-label">Start</span>
    <div class="chip-row">
      {#each positions as pos}
        <button
          class="chip"
          class:active={activePosition === pos}
          onclick={() => togglePosition(pos)}
          aria-label="Toggle {pos} position filter"
          aria-pressed={activePosition === pos}
        >
          {pos}
        </button>
      {/each}
    </div>
  </div>

  <div class="count-badge">
    {totalFiltered} of {totalSequences.toLocaleString()} cards
  </div>

  {#if isLargeCatalog && selectedFamilyIds.length === 0}
    <div class="large-catalog-hint">
      Select a family to view cards ({totalSequences.toLocaleString()} total)
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }

  .filter-section {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    padding: 4px 10px;
    border-radius: 14px;
    font-size: var(--font-size-compact, 12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .chip.active {
    background: var(--theme-accent, #4a9eff);
    color: var(--theme-text, #fff);
    border-color: var(--theme-accent, #4a9eff);
  }

  .chip:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .chip-count {
    opacity: 0.7;
    margin-left: 4px;
  }

  .count-badge {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .large-catalog-hint {
    width: 100%;
    text-align: center;
    padding: 12px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }
</style>
