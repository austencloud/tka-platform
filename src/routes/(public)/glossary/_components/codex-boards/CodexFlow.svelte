<!--
  Every codex box, in sheet order, wrapped to whatever width it is given.

  Boxes are atomic: a shared-transition group (ABC, S-V, the Y/Z pair) never
  splits across a wrap, so the grouping the codex actually means survives the
  reflow. Type identity - which the printed page carried through its geometry -
  is carried here by a coloured rule under each box.

  Sizing is the host's: set --codex-picto-size and the flow re-packs itself.
  Rendering is CodexBox's and CodexCell's. Nothing is re-implemented here.
-->
<script lang="ts">
  import CodexBox from "../../../guide/codex/_components/CodexBox.svelte";
  import { CODEX_BOXES, typeName, typeColor } from "./codex-letters";

  let { onSelect }: { onSelect: (id: string) => void } = $props();
</script>

<div class="flow">
  {#each CODEX_BOXES as tagged (tagged.key)}
    <div
      class="abox"
      style:--type-c={typeColor(tagged.type)}
      aria-label={typeName(tagged.type)}
    >
      <!-- A box captions itself one of two ways: one header for the whole box
           (Types 1-3) or one caption per cell (Types 4-6). Reserve the header
           row only for the first kind, so both land their pictographs at the
           same height instead of one sitting 20px high and the other 20px low. -->
      <CodexBox
        box={tagged.box}
        theme="dark"
        reserveHead={!tagged.box.cells.some((cell) => cell.top)}
        onCellSelect={onSelect}
      />
    </div>
  {/each}
</div>

<style>
  /* stretch, not flex-start: boxes in a wrapped row differ in height (a Greek
     name under Sigma, a per-cell caption over Phi), and with flex-start each
     box's type rule stops at its own bottom edge, so the rules stagger. Stretch
     makes every box in a row the same height, which lands the rules on one
     continuous line under the row. */
  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    justify-content: var(--codex-flow-justify, flex-start);
    gap: var(--codex-flow-row-gap, 0.4rem) var(--abox-gap, 0.4rem);
  }

  /* A box captions itself above its cells (one shared header) or inside them
     (one caption per cell). Those two elements are naturally 5px apart in
     height, which offsets the pictographs of neighbouring boxes by 5px. Pin
     both to one height and every pictograph in a row starts on the same line. */
  .flow :global(.box-head) {
    height: 1.25rem;
    min-height: 0;
  }
  /* Types 4-6 caption every cell with its own transition. At the sheet's 0.62rem
     those glyphs render 13px tall on screen and read as punctuation, so match
     them to the box-header glyph - the largest that still clears the reserve. */
  .flow :global(.cell-top) {
    display: block;
    height: 1.25rem;
    min-height: 0;
    overflow: hidden;
    font-size: 0.75rem;
  }

  /* The type rule runs under the whole box, so a box belongs to exactly one
     type even when two types share a wrapped row. */
  .abox {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-bottom: 0.15rem;
    border-bottom: 3px solid var(--type-c);
  }
</style>
