<script lang="ts">
  import type { Snippet } from "svelte";
  import { TURN_VALUES } from "../domain/turn-pattern-parser";

  interface Props {
    /** Rendered per cell with that cell's blue/red turn values. */
    cell: Snippet<[number, number]>;
    /** Optional content above the grid (e.g. preset bar). */
    header?: Snippet;
    ariaLabel?: string;
  }
  const { cell, header, ariaLabel = "Turn combination matrix" }: Props = $props();

  function formatTurn(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
</script>

<div class="matrix-container">
  {#if header}{@render header()}{/if}

  <div class="matrix-grid-wrapper">
    <div class="matrix-grid" role="grid" aria-label={ariaLabel}>
      <div class="header-cell corner" role="presentation">
        <span class="corner-blue">B</span>
        <span class="corner-sep">/</span>
        <span class="corner-red">R</span>
      </div>

      {#each TURN_VALUES as red (red)}
        <div class="header-cell col-header" role="columnheader" aria-label="Red {red} turns">
          <span class="header-val red-val">{formatTurn(red)}</span>
        </div>
      {/each}

      {#each TURN_VALUES as blue (blue)}
        <div class="header-cell row-header" role="rowheader" aria-label="Blue {blue} turns">
          <span class="header-val blue-val">{formatTurn(blue)}</span>
        </div>
        {#each TURN_VALUES as red (red)}
          {@render cell(blue, red)}
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
  .matrix-grid-wrapper {
    width: 100%;
    max-width: 600px;
    container-type: inline-size;
  }
  .matrix-grid {
    display: grid;
    grid-template-columns: auto repeat(7, 1fr);
    grid-template-rows: auto repeat(7, 1fr);
    gap: clamp(4px, 1cqi, 8px);
    width: 100%;
  }
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
  .col-header { border-bottom: 1px solid rgba(248, 113, 113, 0.15); }
  .row-header { border-right: 1px solid rgba(96, 165, 250, 0.15); }
  @media (max-width: 640px) {
    .matrix-container { padding: 12px; }
    .matrix-grid-wrapper { width: clamp(280px, 90vw, 480px); }
  }
</style>
