<script lang="ts">
  import ShapeMatrixGrid from "$lib/shared/shape-matrix/components/ShapeMatrixGrid.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  const state = getShapeMatrixAppContext();
</script>

<section class="matrix-pane" aria-label="Shape matrix">
  <div class="matrix-stage">
    {#if state.loadError}
      <div class="status error" role="alert">
        <p>The matrix could not be built.</p>
        <button type="button" onclick={state.load}>Try again</button>
      </div>
    {:else if !state.data}
      <p class="status" aria-live="polite">Building the matrix…</p>
    {:else}
      <ShapeMatrixGrid
        data={state.data}
        rowAxis={state.rowAxis}
        colAxis={state.colAxis}
        maxCellPx={320}
        selectedPair={state.selectedPair}
        onselect={state.selectPair}
      />
    {/if}
  </div>
</section>

<style>
  .matrix-pane {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: var(--theme-panel-bg, rgb(16 23 33 / 0.82));
  }

  .status button {
    min-height: var(--min-touch-target, 44px);
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #f59e0b) 45%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 10%,
      transparent
    );
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    cursor: pointer;
  }

  .matrix-stage {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-panel-bg, #0a0f14);
  }

  .status {
    display: grid;
    place-content: center;
    gap: 0.8rem;
    width: 100%;
    height: 100%;
    padding: 1rem;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    text-align: center;
  }

  .status.error {
    color: var(--semantic-error, #fb8a8a);
  }
  .status button {
    padding: 0.4rem 1rem;
  }

  button:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .matrix-pane {
      border: 0;
      border-radius: 0;
    }
  }
</style>
