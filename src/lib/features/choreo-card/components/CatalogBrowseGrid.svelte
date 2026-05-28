<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import type { TnDViewMode } from "../state/catalog-browse-types";
  import CatalogCard from "./CatalogCard.svelte";
  import TnDTurnMatrix from "./TnDTurnMatrix.svelte";
  import TnDFamilyBrowser from "./TnDFamilyBrowser.svelte";
  import { LOOP_TYPE_LABELS } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { TND_FAMILY_LABELS } from "../state/catalog-browse-types";

  interface Props {
    groupedCatalogs: Map<string, Catalog[]>;
    collection: 'LOOPs' | 'TnD';
    tndViewMode?: TnDViewMode;
    allTnDCatalogs?: Catalog[];
    onSelectCatalog: (catalog: Catalog) => void;
  }

  const {
    groupedCatalogs,
    collection,
    tndViewMode = 'turns',
    allTnDCatalogs = [],
    onSelectCatalog,
  }: Props = $props();

  function groupLabel(key: string): string {
    if (collection === 'LOOPs') {
      return (LOOP_TYPE_LABELS as Record<string, string>)[key] ?? capitalize(key);
    }
    return TND_FAMILY_LABELS[key] ?? capitalize(key);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTurn(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    return m ? `${m[1]}T` : capitalize(turn.replace(/-/g, ' '));
  }

  function computeVaryingAxes(catalogs: Catalog[]) {
    if (catalogs.length <= 1) return { stepCount: false, turn: false, reversal: false, slice: false, grid: false };
    return {
      stepCount: new Set(catalogs.map(d => d.stepCount)).size > 1,
      turn: new Set(catalogs.map(d => d.turnPattern)).size > 1,
      reversal: new Set(catalogs.map(d => d.reversalPattern)).size > 1,
      slice: new Set(catalogs.map(d => d.sliceType)).size > 1,
      grid: new Set(catalogs.map(d => d.gridMode)).size > 1,
    };
  }

  function contextTags(catalog: Catalog, axes: ReturnType<typeof computeVaryingAxes>): string {
    const parts: string[] = [];
    if (axes.stepCount) parts.push(`${catalog.stepCount}-step`);
    if (axes.slice) parts.push(capitalize(catalog.sliceType));
    if (axes.turn) parts.push(formatTurn(catalog.turnPattern));
    if (axes.grid) parts.push(capitalize(catalog.gridMode));
    if (parts.length === 0 && !axes.reversal) {
      parts.push(formatTurn(catalog.turnPattern));
    }
    return parts.join(' · ');
  }
</script>

{#if collection === 'TnD' && tndViewMode === 'turns'}
  <TnDTurnMatrix catalogs={allTnDCatalogs} {onSelectCatalog} />
{:else if collection === 'TnD' && tndViewMode === 'family'}
  <TnDFamilyBrowser catalogs={allTnDCatalogs} {onSelectCatalog} />
{:else}
<div class="browse-grid-container">
  {#each [...groupedCatalogs.entries()] as [key, items] (key)}
    {@const axes = computeVaryingAxes(items)}
    <section class="catalog-group">
      <div class="group-header">
        <span class="group-name">{groupLabel(key)}</span>
        <span class="group-rule" aria-hidden="true"></span>
        <span class="group-count">{items.length} {items.length === 1 ? 'catalog' : 'catalogs'}</span>
      </div>
      <div class="catalog-grid">
        {#each items as catalog (catalog.id)}
          <CatalogCard
            {catalog}
            tags={contextTags(catalog, axes)}
            onSelect={() => onSelectCatalog(catalog)}
          />
        {/each}
      </div>
    </section>
  {/each}

  {#if groupedCatalogs.size === 0}
    <div class="empty-state">
      <i class="fas fa-search empty-icon" aria-hidden="true"></i>
      <p class="empty-text">No catalogs match these filters</p>
    </div>
  {/if}
</div>
{/if}

<style>
  .browse-grid-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .catalog-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .group-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    white-space: nowrap;
  }

  .group-rule {
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .group-count {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    white-space: nowrap;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 2.5rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  @media (max-width: 768px) {
    .browse-grid-container { padding: 16px; gap: 24px; }
    .catalog-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  }
</style>
