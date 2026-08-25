<script lang="ts">
  import CodexCell from "./CodexCell.svelte";
  import CodexTransitionGlyph from "./CodexTransitionGlyph.svelte";
  import type { CodexBoxDef } from "../_data/codex-groups";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { GuideCodexVisibility } from "../../level-1/_data/guide-codex-persistence";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let {
    box,
    side,
    reserveHead = false,
    theme = "print",
    propType,
    visibility,
    getData,
    onCellSelect,
  }: {
    box: CodexBoxDef;
    /** Forwarded to every CodexCell. "print" is the canonical ink-on-white
     *  rendering; "dark" flips the pictographs for a dark host. Frame and
     *  caption colours come from the --codex-* tokens, which the host sets. */
    theme?: "print" | "dark";
    /** Which sheet column this box sits in. The OG sheets pin each box's
     *  transition glyph to the OUTER corner - top-left for left-column boxes,
     *  top-right for right-column ones - with the OPEN/CLOSE mode word centered.
     *  Undefined (full-width boxes) centers the header. */
    side?: "left" | "right";
    /** Reserve the header row even with nothing to put in it. A sheet gets this
     *  for free because every column box passes a `side`; a flat flow has no
     *  sides, so without it an unlabeled box (P-Q-R, S-V) would start its cells
     *  higher than the labeled box beside it. */
    reserveHead?: boolean;
    /** Interactive-reader overrides - undefined for print/card callers, which
     *  keeps this component's default (canonical) rendering untouched. */
    propType?: PropType;
    visibility?: GuideCodexVisibility;
    getData?: (id: string) => PictographData | null | undefined;
    onCellSelect?: (id: string) => void;
  } = $props();
</script>

<div class="codex-box" class:full={box.full}>
  <!-- Column boxes ALWAYS render the header row, even when unlabeled (P/Q/R),
       so every box in a sheet row starts its cells at the same height - an
       unlabeled box must not sit higher than its labeled row-mate. Full-width
       boxes only render it when there's something to show. -->
  {#if side || reserveHead || box.header || box.mode}
    <div class="box-head" class:corner-left={side === "left"} class:corner-right={side === "right"}>
      {#if box.header}<span class="box-transition"><CodexTransitionGlyph text={box.header} /></span>{/if}
      {#if box.mode}<span class="box-mode">{box.mode}</span>{/if}
    </div>
  {/if}
  <div class="box-cells">
    {#each box.cells as cell (cell.id)}
      <CodexCell
        {cell}
        {theme}
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

  /* Header row: the mode word (OPEN/CLOSE) is always centered; the transition
     glyph is pinned to the box's OUTER corner when the box has a sheet side
     (absolute, so it never shoves the centered mode word) - matching the OG,
     where α→α hangs off the top-left of left boxes and β→α off the top-right
     of right boxes. min-height keeps the row from collapsing when the glyph is
     the only child (it's absolutely positioned). */
  .box-head {
    position: relative;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
    min-height: 15px;
  }

  .box-transition {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--codex-transition, #1a1a1a);
  }

  .box-head.corner-left .box-transition {
    position: absolute;
    left: 0;
    bottom: 0;
  }

  .box-head.corner-right .box-transition {
    position: absolute;
    right: 0;
    bottom: 0;
  }

  .box-mode {
    font-style: italic;
    font-size: var(--codex-mode-size, 0.62rem);
    letter-spacing: 0.1em;
    color: var(--codex-mode, #888);
  }

  /* No box frame of its own: the row's outline is formed by the cells'
     pictograph borders sitting flush (shared 1px walls, collapsed below) - the
     original guide's table look. Headers above and names below the cells stay
     outside the bordered area, exactly like the OG sheets. */
  .box-cells {
    display: flex;
    justify-content: center;
    background: var(--codex-box-bg, #fff);
  }

  /* Collapse the shared wall between adjacent pictograph borders. */
  .box-cells :global(.codex-cell + .codex-cell) {
    margin-left: -1px;
  }
</style>
