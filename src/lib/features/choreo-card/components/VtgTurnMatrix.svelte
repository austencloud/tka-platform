<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { parseTurnPattern, TURN_VALUES } from "../domain/turn-pattern-parser";

  interface Props {
    catalogs: Catalog[];
    onSelectCatalog: (catalog: Catalog) => void;
  }

  const { catalogs, onSelectCatalog }: Props = $props();

  type CellKey = `${number},${number}`;

  const catalogMap = $derived.by(() => {
    const map = new Map<CellKey, Catalog>();
    for (const catalog of catalogs) {
      const coord = parseTurnPattern(catalog.turnPattern);
      if (!coord) continue;
      const key: CellKey = `${coord.blue},${coord.red}`;
      map.set(key, catalog);
    }
    return map;
  });

  function cellCatalog(blue: number, red: number): Catalog | undefined {
    return catalogMap.get(`${blue},${red}`);
  }

  function formatTurn(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
</script>

<div class="matrix-container">
  <div class="matrix-label red-label">Red Hand Turns</div>

  <div class="matrix-grid" role="grid" aria-label="VTG turn combination matrix">
    <div class="matrix-corner" role="presentation"></div>

    {#each TURN_VALUES as red (red)}
      <div class="matrix-col-header" role="columnheader" aria-label="Red {red} turns">
        {formatTurn(red)}
      </div>
    {/each}

    {#each TURN_VALUES as blue (blue)}
      <div class="matrix-row-header" role="rowheader" aria-label="Blue {blue} turns">
        {formatTurn(blue)}
      </div>

      {#each TURN_VALUES as red (red)}
        {@const catalog = cellCatalog(blue, red)}
        {@const isSymmetric = blue === red}
        {#if catalog}
          <button
            type="button"
            class="matrix-cell"
            class:symmetric={isSymmetric}
            role="gridcell"
            aria-label="{catalog.totalSequences} sequences, blue {blue} turns, red {red} turns{isSymmetric ? ' (symmetric)' : ''}"
            onclick={() => onSelectCatalog(catalog)}
          >
            <span class="cell-count">{catalog.totalSequences}</span>
            {#if isSymmetric}
              <span class="cell-marker" aria-hidden="true">&#9670;</span>
            {/if}
          </button>
        {:else}
          <div
            class="matrix-cell empty"
            role="gridcell"
            aria-label="No deck for blue {blue}, red {red}"
          ></div>
        {/if}
      {/each}
    {/each}
  </div>

  <div class="matrix-label blue-label">Blue Hand Turns</div>
</div>

<style>
  .matrix-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
  }

  .matrix-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .red-label { color: #ED1C24; }
  .blue-label { color: #3575E2; }

  .matrix-grid {
    display: grid;
    grid-template-columns: 48px repeat(7, 1fr);
    grid-template-rows: 36px repeat(7, 1fr);
    gap: 2px;
    max-width: 640px;
    width: 100%;
    aspect-ratio: 8 / 8;
  }

  .matrix-corner {
    background: transparent;
  }

  .matrix-col-header,
  .matrix-row-header {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
  }

  .matrix-col-header { color: #ED1C24; }
  .matrix-row-header { color: #3575E2; }

  .matrix-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgba(183, 99, 205, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    font: inherit;
    transition: background 0.15s ease, transform 0.15s ease;
    min-height: 0;
    padding: 0;
  }

  .matrix-cell:hover {
    background: rgba(183, 99, 205, 0.15);
    transform: scale(1.02);
  }

  .matrix-cell:focus-visible {
    outline: 2px solid rgba(183, 99, 205, 0.6);
    outline-offset: 1px;
  }

  .matrix-cell.symmetric {
    background: rgba(183, 99, 205, 0.2);
    border-color: rgba(183, 99, 205, 0.35);
  }

  .matrix-cell.symmetric:hover {
    background: rgba(183, 99, 205, 0.3);
  }

  .matrix-cell.empty {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.04);
    cursor: default;
  }

  .cell-count {
    font-size: 13px;
    font-weight: 600;
  }

  .cell-marker {
    font-size: 8px;
    color: rgba(183, 99, 205, 0.7);
    line-height: 1;
  }

  @media (max-width: 768px) {
    .matrix-container { padding: 16px; }
    .matrix-grid {
      grid-template-columns: 36px repeat(7, 1fr);
      grid-template-rows: 28px repeat(7, 1fr);
      max-width: 100%;
    }
    .matrix-col-header, .matrix-row-header { font-size: 11px; }
    .cell-count { font-size: 11px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .matrix-cell { transition: none; }
  }
</style>
