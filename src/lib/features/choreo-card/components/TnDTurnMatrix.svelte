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
  <div class="matrix-grid-wrapper">
    <div class="matrix-grid" role="grid" aria-label="TnD turn combination matrix">
      <!-- Corner cell -->
      <div class="header-cell corner" role="presentation">
        <span class="corner-blue">B</span>
        <span class="corner-sep">/</span>
        <span class="corner-red">R</span>
      </div>

      <!-- Column headers (red) -->
      {#each TURN_VALUES as red (red)}
        <div class="header-cell col-header" role="columnheader" aria-label="Red {red} turns">
          <span class="header-val red-val">{formatTurn(red)}</span>
        </div>
      {/each}

      <!-- Rows -->
      {#each TURN_VALUES as blue (blue)}
        <div class="header-cell row-header" role="rowheader" aria-label="Blue {blue} turns">
          <span class="header-val blue-val">{formatTurn(blue)}</span>
        </div>

        {#each TURN_VALUES as red (red)}
          {@const catalog = cellCatalog(blue, red)}
          {@const isSymmetric = blue === red}
          {#if catalog}
            <button
              type="button"
              class="cell"
              class:symmetric={isSymmetric}
              role="gridcell"
              aria-label="{catalog.totalSequences} sequences, blue {formatTurn(blue)} red {formatTurn(red)}{isSymmetric ? ' (symmetric)' : ''}"
              onclick={() => onSelectCatalog(catalog)}
            >
              <span class="turn-pair">
                {#if isSymmetric}
                  <span class="turn-sym">{formatTurn(blue)}T</span>
                {:else}
                  <span class="turn-blue">{formatTurn(blue)}</span>
                  <span class="turn-sep">|</span>
                  <span class="turn-red">{formatTurn(red)}</span>
                {/if}
              </span>
              <span class="cell-count">{catalog.totalSequences} seq</span>
            </button>
          {:else}
            <div
              class="cell empty"
              role="gridcell"
              aria-label="No deck for blue {formatTurn(blue)}, red {formatTurn(red)}"
            ></div>
          {/if}
        {/each}
      {/each}
    </div>
  </div>
</div>

<style>
  .matrix-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 24px;
    box-sizing: border-box;
  }

  .matrix-grid-wrapper {
    width: clamp(340px, 65vmin, 680px);
  }

  .matrix-grid {
    display: grid;
    grid-template-columns: auto repeat(7, 1fr);
    grid-template-rows: auto repeat(7, 1fr);
    gap: clamp(2px, 0.3vmin, 4px);
    width: 100%;
  }

  /* ── Headers ── */
  .header-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(4px, 0.6vmin, 8px);
  }

  .corner {
    font-size: clamp(10px, 1.4vmin, 14px);
    font-weight: 700;
    gap: 1px;
    display: flex;
    align-items: baseline;
  }

  .corner-blue { color: #60a5fa; }
  .corner-sep { color: rgba(255, 255, 255, 0.2); font-weight: 400; }
  .corner-red { color: #f87171; }

  .header-val {
    font-size: clamp(11px, 1.5vmin, 15px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .red-val { color: #f87171; }
  .blue-val { color: #60a5fa; }

  .col-header {
    border-bottom: 1px solid rgba(248, 113, 113, 0.15);
  }

  .row-header {
    border-right: 1px solid rgba(96, 165, 250, 0.15);
  }

  /* ── Cells ── */
  .cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 0.3vmin, 4px);
    border-radius: clamp(4px, 0.6vmin, 8px);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    color: var(--theme-text, #fff);
    font: inherit;
    padding: 0;
    transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
    position: relative;
  }

  .cell:hover {
    background: rgba(183, 99, 205, 0.15);
    border-color: rgba(183, 99, 205, 0.3);
    transform: scale(1.06);
    z-index: 2;
    box-shadow: 0 4px 20px rgba(183, 99, 205, 0.25);
  }

  .cell:active {
    transform: scale(0.97);
  }

  .cell:focus-visible {
    outline: 2px solid rgba(183, 99, 205, 0.7);
    outline-offset: 1px;
    z-index: 3;
  }

  .cell.symmetric {
    background: rgba(183, 99, 205, 0.12);
    border-color: rgba(183, 99, 205, 0.25);
  }

  .cell.symmetric:hover {
    background: rgba(183, 99, 205, 0.22);
    border-color: rgba(183, 99, 205, 0.45);
    box-shadow: 0 4px 20px rgba(183, 99, 205, 0.35);
  }

  .cell.empty {
    background: rgba(255, 255, 255, 0.015);
    border-color: rgba(255, 255, 255, 0.03);
    cursor: default;
  }

  /* ── Cell content ── */
  .turn-pair {
    display: flex;
    align-items: baseline;
    gap: 0.08em;
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
    font-size: clamp(11px, 1.6vmin, 15px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .turn-blue { color: #60a5fa; }
  .turn-red { color: #f87171; }
  .turn-sep { color: rgba(255, 255, 255, 0.2); font-weight: 400; }

  .turn-sym {
    background: linear-gradient(135deg, #60a5fa, #f87171);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .cell-count {
    font-size: clamp(8px, 1vmin, 11px);
    font-weight: 400;
    color: rgba(255, 255, 255, 0.35);
    line-height: 1;
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .matrix-container { padding: 12px; }
    .matrix-grid-wrapper { width: clamp(280px, 90vw, 480px); }
    .cell-count { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell { transition: none; }
  }
</style>
