<script lang="ts">
  /**
   * Reusable Level 2 turn-codex page: a portrait-reflowed grid of turn-annotated
   * pictographs under a "turns" header. The original artboards are landscape 8×4
   * codex sheets; we keep the 8-column × 4-row structure (preserving the VTG
   * row-grouping) and scale it to fit the portrait GuidePage width — the elegant
   * reflow, no awkward 4×8 needed. Cells render via PictographContainer with the
   * TKA glyph suppressed; the letter + turn digit is a dark print label below each
   * cell. Turn arrows and end orientation come baked into `cell.data` (see
   * `codex-turns.ts`).
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  export type CodexCell = { data: PictographData | null; letter: string; slot: "high" | "low" };

  let {
    turnLabel,
    subParts,
    rows,
    names,
  }: {
    turnLabel: string;
    subParts: { t: string; c?: string }[];
    rows: CodexCell[][];
    names?: string[];
  } = $props();

  const S = 816 / 612;

  // 8-column grid scaled to the portrait content width (26..586 = 560pt).
  const COLS = 8;
  const MARGIN = 26;
  const CONTENT = 560;
  const COL_PITCH = CONTENT / COLS; // 70
  const SIZE = 66;
  const colLeft = (i: number) => MARGIN + i * COL_PITCH + (COL_PITCH - SIZE) / 2;

  const GRID_TOP = 128;
  const ROW_PITCH = 162;
  const rowTop = (r: number) => GRID_TOP + r * ROW_PITCH;
  const LABEL_DY = SIZE + 6;

  const PICTO_FLAGS = {
    showGrid: true,
    showTKA: false,
    showPositions: false,
    showReversals: false,
    showTnD: false,
    showElemental: false,
    showNonRadialPoints: false,
    showHandPoints: true,
    darkMode: false,
    printMode: true,
    disableTransitions: true,
  } as const;
</script>

<div class="codex-page">
  <!-- Header: big turn tuple + colored type subheader. -->
  <div class="turn-label" style="top:{22 * S}px; font-size:{42 * S}px">{turnLabel}</div>
  <div class="sub" style="top:{84 * S}px; font-size:{24 * S}px">
    {#each subParts as p, i (i)}<span style={p.c ? `color:${p.c}` : ""}>{p.t}</span>{/each}
  </div>

  <!-- Row separators. -->
  {#each rows as _row, r (r)}
    {#if r > 0}
      <div class="rule" style="left:{MARGIN * S}px; top:{(rowTop(r) - 20) * S}px; width:{CONTENT * S}px"></div>
    {/if}
  {/each}

  {#each rows as row, r (r)}
    {#each row as cell, ci (ci)}
      {#if r === 0 && names?.[ci]}
        <div class="name" style="left:{colLeft(ci) * S}px; top:{(rowTop(0) - 16) * S}px; width:{SIZE * S}px">{names[ci]}</div>
      {/if}
      <div class="mini" style="left:{colLeft(ci) * S}px; top:{rowTop(r) * S}px; width:{SIZE * S}px; height:{SIZE * S}px">
        {#if cell.data}
          <PictographContainer
            pictographData={cell.data}
            gridMode={GridMode.DIAMOND}
            bluePropTypeOverride={PropType.STAFF}
            redPropTypeOverride={PropType.STAFF}
            {...PICTO_FLAGS}
          />
        {/if}
      </div>
      <div class="cell-label" style="left:{colLeft(ci) * S}px; top:{(rowTop(r) + LABEL_DY) * S}px; width:{SIZE * S}px">
        <span class="tka">{cell.letter}</span>{#if cell.slot === "high"}<sup>1</sup>{:else}<sub>1</sub>{/if}
      </div>
    {/each}
  {/each}
</div>

<style>
  .codex-page {
    position: absolute;
    inset: 0;
    color: #141414;
  }
  .mini {
    position: absolute;
    box-sizing: border-box;
  }
  .turn-label {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    font-family: "Cambria", Georgia, serif;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.06em;
  }
  .sub {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    font-family: "Cambria", Georgia, serif;
    font-style: italic;
    font-weight: 700;
    color: #141414;
  }
  .rule {
    position: absolute;
    height: 1px;
    background: #c4c4cc;
  }
  .name {
    position: absolute;
    text-align: center;
    font-family: "Cambria", Georgia, serif;
    font-style: italic;
    font-size: 11px;
    color: #3c3c46;
  }
  .cell-label {
    position: absolute;
    text-align: center;
    font-family: "Cambria", Georgia, serif;
    font-weight: 700;
    font-size: 17px;
    line-height: 1;
  }
  .cell-label sup,
  .cell-label sub {
    font-size: 0.62em;
    color: #dc2626;
  }
  .cell-label sub {
    color: #2e3192;
  }
</style>
