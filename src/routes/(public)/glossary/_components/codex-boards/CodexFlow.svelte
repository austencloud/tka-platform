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
  import {
    CODEX_BOXES,
    typeName,
    typeColor,
    type TaggedBox,
  } from "./codex-letters";

  let {
    onSelect,
    /** Which boxes to flow. Defaults to the whole codex in sheet order; a
     *  type-banded board passes one type's boxes per band. */
    boxes = CODEX_BOXES,
  }: { onSelect: (id: string) => void; boxes?: TaggedBox[] } = $props();
</script>

<div class="flow">
  {#each boxes as tagged (tagged.key)}
    <div
      class="abox"
      style:--type-c={typeColor(tagged.type)}
      aria-label={typeName(tagged.type)}
    >
      <!-- Flat-board captions all occupy this same reserved header slot. The
           print sheet keeps its original per-cell placement. -->
      <CodexBox
        box={tagged.box}
        theme="dark"
        reserveHead
        showName={false}
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
    /* A dense reference grid needs a stable cell matrix. Keep the shared
       selected ring, but do not enlarge one pictograph beyond its neighbors. */
    --selection-selected-transform: none;
  }

  /* Every flat-board box reserves the same header height. Grouped transitions
     fill it once; the split Type 4-6 boxes each fill their own header. */
  .flow :global(.box-head) {
    height: 1.25rem;
    min-height: 0;
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
