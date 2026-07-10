<script lang="ts">
  import CodexCell from "./CodexCell.svelte";
  import type { CodexBoxDef } from "../_data/codex-groups";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { GuideCodexVisibility } from "../../level-1/_data/guide-codex-persistence";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let {
    box,
    propType,
    visibility,
    getData,
    onCellSelect,
  }: {
    box: CodexBoxDef;
    /** Interactive-reader overrides — undefined for print/card callers, which
     *  keeps this component's default (canonical) rendering untouched. */
    propType?: PropType;
    visibility?: GuideCodexVisibility;
    getData?: (id: string) => PictographData | null | undefined;
    onCellSelect?: (id: string) => void;
  } = $props();
</script>

<div class="codex-box" class:full={box.full}>
  {#if box.header || box.mode}
    <div class="box-head">
      {#if box.header}<span class="box-transition">{box.header}</span>{/if}
      {#if box.mode}<span class="box-mode">{box.mode}</span>{/if}
    </div>
  {/if}
  <div class="box-cells" style:--cols={box.cells.length}>
    {#each box.cells as cell (cell.id)}
      <CodexCell
        {cell}
        {propType}
        showGlyph={visibility?.showGlyph}
        showGrid={visibility?.showGrid}
        showTKA={visibility?.showTKA}
        showPositions={visibility?.showPositions}
        showReversals={visibility?.showReversals}
        showNonRadialPoints={visibility?.showNonRadialPoints}
        dataOverride={getData?.(cell.id)}
        onSelect={onCellSelect}
      />
    {/each}
  </div>
</div>

<style>
  .codex-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .codex-box.full {
    grid-column: 1 / -1;
    justify-self: center;
  }

  .box-head {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
  }

  .box-transition {
    font-size: 0.8rem;
    font-weight: 700;
    color: #1a1a1a;
  }

  .box-mode {
    font-style: italic;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: #888;
  }

  .box-cells {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 2px;
    padding: 4px 5px 3px;
    border: 1.25px solid #2b2b2b;
    border-radius: 3px;
    background: #fff;
  }
</style>
