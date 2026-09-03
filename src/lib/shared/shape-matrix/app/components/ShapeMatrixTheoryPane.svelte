<script lang="ts">
  import ShapeMatrixGrid from "$lib/shared/shape-matrix/components/ShapeMatrixGrid.svelte";
  import { MANDALA_STANDARD_TIP_DX } from "$lib/shared/mandala/domain/mandala-constants";
  import {
    theoryFlowerKey,
    theoryFlowerLabel,
    type TheoryFlower,
  } from "$lib/shared/shape-matrix/domain/theory-flower";
  import {
    theoryCellArtworkSrc,
    theoryHeaderArtworkSrc,
  } from "$lib/shared/shape-matrix/services/theory-matrix-artwork";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /** The shell owns navigation, the same way it does for the Matrix. */
    onselect?: (pair: { left: TheoryFlower; right: TheoryFlower }) => void;
  }
  let { onselect }: Props = $props();

  const state = getShapeMatrixAppContext();

  // Theory geometry comes from the QfT model, not from a realized sequence, so
  // the grid renders before the pictograph data finishes loading. Prop reach is
  // the one thing it borrows, and the standard staff covers the wait.
  const tipDx = $derived(state.data?.clubTipDx ?? MANDALA_STANDARD_TIP_DX);
</script>

<section class="theory-pane" aria-label="Theory matrix">
  <div class="theory-stage">
    <ShapeMatrixGrid
      rowAxis={state.theoryRowAxis}
      colAxis={state.theoryColAxis}
      maxCellPx={320}
      selectedPair={state.theoryPair}
      claimSelected={state.compact && state.activeView === "matrix"}
      keyOf={theoryFlowerKey}
      labelOf={theoryFlowerLabel}
      paintHeader={(flower, hand, sizePx) =>
        theoryHeaderArtworkSrc(flower, hand, tipDx, sizePx)}
      paintCell={(left, right, sizePx) =>
        theoryCellArtworkSrc(left, right, tipDx, sizePx)}
      onselect={onselect ?? state.selectTheoryPair}
    />
  </div>
</section>

<style>
  .theory-pane {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: var(--theme-panel-bg, rgb(16 23 33 / 0.82));
  }

  .theory-stage {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-panel-bg, #0a0f14);
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .theory-pane {
      border: 0;
      border-radius: 0;
    }
  }
</style>
