<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import type { TnDTurnPatternOption } from "../services/deck-composer";
  import { parseTurnPattern, TURN_VALUES } from "../domain/turn-pattern-parser";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";

  interface Props {
    // Navigate mode (catalog browser): click a cell to open that catalog.
    catalogs?: Catalog[];
    onSelectCatalog?: (catalog: Catalog) => void;
    // Select mode (deck-releaser picker): multi-select turn patterns.
    patternOptions?: TnDTurnPatternOption[];
    selected?: Set<string>;
    onToggle?: (turnPattern: string) => void;
    onSetPatterns?: (patterns: Set<string>) => void;
  }

  const {
    catalogs = [],
    onSelectCatalog,
    patternOptions,
    selected,
    onToggle,
    onSetPatterns,
  }: Props = $props();

  const selectable = $derived(patternOptions != null);

  type CellKey = `${number},${number}`;

  interface SelectCell {
    turnPattern: string;
    count: number;
  }

  const catalogMap = $derived.by(() => {
    const map = new Map<CellKey, Catalog>();
    for (const catalog of catalogs) {
      const coord = parseTurnPattern(catalog.turnPattern);
      if (!coord) continue;
      map.set(`${coord.blue},${coord.red}`, catalog);
    }
    return map;
  });

  const selectMap = $derived.by(() => {
    const map = new Map<CellKey, SelectCell>();
    for (const opt of patternOptions ?? []) {
      const coord = parseTurnPattern(opt.turnPattern);
      if (!coord) continue;
      map.set(`${coord.blue},${coord.red}`, { turnPattern: opt.turnPattern, count: opt.sequenceCount });
    }
    return map;
  });

  function formatTurn(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  // ── Presets (select mode) ──
  function allPatterns(): Set<string> {
    return new Set((patternOptions ?? []).map((o) => o.turnPattern));
  }

  function filteredPatterns(pred: (blue: number, red: number) => boolean): Set<string> {
    const out = new Set<string>();
    for (const opt of patternOptions ?? []) {
      const coord = parseTurnPattern(opt.turnPattern);
      if (coord && pred(coord.blue, coord.red)) out.add(opt.turnPattern);
    }
    return out;
  }

  const presets = [
    { id: "all", label: "Select All", icon: "fa-check-double", build: () => allPatterns() },
    {
      id: "whole",
      label: "Whole Turns",
      icon: "fa-circle",
      build: () => filteredPatterns((b, r) => Number.isInteger(b) && Number.isInteger(r)),
    },
    { id: "matched", label: "Matched", icon: "fa-equals", build: () => filteredPatterns((b, r) => b === r) },
    {
      id: "matched-whole",
      label: "Matched Whole",
      icon: "fa-circle-dot",
      // Diagonal whole-turn cells only: 0|0, 1|1, 2|2, 3|3.
      build: () => filteredPatterns((b, r) => b === r && Number.isInteger(b)),
    },
    { id: "clear", label: "Clear", icon: "fa-xmark", build: () => new Set<string>() },
  ] as const;
</script>

<div class="matrix-container">
  {#if selectable}
    <div class="preset-bar">
      {#each presets as preset (preset.id)}
        <FilterChipBase
          label={preset.label}
          icon={"fas " + preset.icon}
          mode="action"
          chipColor={preset.id === "clear" ? "#f87171" : "var(--theme-accent)"}
          onclick={() => onSetPatterns?.(preset.build())}
        />
      {/each}
    </div>
  {/if}

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
          {@const isSymmetric = blue === red}
          {#if selectable}
            {@const cell = selectMap.get(`${blue},${red}`)}
            {#if cell}
              {@const isSelected = selected?.has(cell.turnPattern) ?? false}
              <button
                type="button"
                class="cell"
                class:symmetric={isSymmetric}
                class:selected={isSelected}
                role="gridcell"
                aria-selected={isSelected}
                aria-label="Blue {formatTurn(blue)} red {formatTurn(red)}, {cell.count} sequences{isSymmetric ? ' (matched)' : ''}{isSelected ? ' — selected' : ''}"
                onclick={() => onToggle?.(cell.turnPattern)}
              >
                <span class="turn-pair">
                  <span class="turn-blue">{formatTurn(blue)}</span>
                  <span class="turn-sep">|</span>
                  <span class="turn-red">{formatTurn(red)}</span>
                </span>
                <span class="cell-count">{cell.count}</span>
              </button>
            {:else}
              <div
                class="cell empty"
                role="gridcell"
                aria-label="No deck for blue {formatTurn(blue)}, red {formatTurn(red)}"
              ></div>
            {/if}
          {:else}
            {@const catalog = catalogMap.get(`${blue},${red}`)}
            {#if catalog}
              <button
                type="button"
                class="cell"
                class:symmetric={isSymmetric}
                role="gridcell"
                aria-label="{catalog.totalSequences} sequences, blue {formatTurn(blue)} red {formatTurn(red)}{isSymmetric ? ' (symmetric)' : ''}"
                onclick={() => onSelectCatalog?.(catalog)}
              >
                <span class="turn-pair">
                  <span class="turn-blue">{formatTurn(blue)}</span>
                  <span class="turn-sep">|</span>
                  <span class="turn-red">{formatTurn(red)}</span>
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
          {/if}
        {/each}
      {/each}
    </div>
  </div>
</div>

<style>
  .matrix-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    width: 100%;
    padding: 4px 0;
    box-sizing: border-box;
  }

  .preset-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  /* Fill the parent column (centred by .matrix-container), capped so it never
     dwarfs a wide catalog-browser pane. Container-relative — NOT viewport — so a
     narrow deck-releaser column shrinks the grid instead of overflowing it. */
  .matrix-grid-wrapper {
    width: 100%;
    max-width: 600px;
    /* Self-containment: cell sizes/fonts below scale to THIS width via cqi,
       so the grid stays legible whether it's 600px or a cramped 360px column. */
    container-type: inline-size;
  }

  .matrix-grid {
    display: grid;
    grid-template-columns: auto repeat(7, 1fr);
    grid-template-rows: auto repeat(7, 1fr);
    gap: clamp(4px, 1cqi, 8px);
    width: 100%;
  }

  /* ── Headers ── */
  .header-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(4px, 1cqi, 8px);
  }

  .corner {
    font-size: clamp(10px, 2.3cqi, 14px);
    font-weight: 700;
    gap: 1px;
    display: flex;
    align-items: baseline;
  }

  .corner-blue { color: #60a5fa; }
  .corner-sep { color: rgba(255, 255, 255, 0.2); font-weight: 400; }
  .corner-red { color: #f87171; }

  .header-val {
    font-size: clamp(11px, 2.5cqi, 15px);
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
    gap: clamp(2px, 0.5cqi, 4px);
    border-radius: clamp(4px, 1cqi, 8px);
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

  /* Selected state (select mode) — theme accent */
  .cell.selected {
    background: color-mix(in srgb, var(--theme-accent, #b763cd) 22%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
    border-color: color-mix(in srgb, var(--theme-accent, #b763cd) 60%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent, #b763cd) 40%, transparent);
  }

  .cell.selected:hover {
    background: color-mix(in srgb, var(--theme-accent, #b763cd) 32%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
    border-color: color-mix(in srgb, var(--theme-accent, #b763cd) 75%, transparent);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--theme-accent, #b763cd) 30%, transparent);
  }

  .cell.selected .cell-count {
    color: color-mix(in srgb, var(--theme-accent, #b763cd) 80%, #fff);
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
    gap: 0.12em;
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
    font-size: clamp(12px, 2.8cqi, 17px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .turn-blue { color: #60a5fa; }
  .turn-red { color: #f87171; }
  .turn-sep { color: rgba(255, 255, 255, 0.2); font-weight: 400; }

  .cell-count {
    font-size: clamp(9px, 1.9cqi, 12px);
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
