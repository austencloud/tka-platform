<!--
  AsciiPictographLab.svelte — Lab tab for iterating on ASCII pictograph rendering.

  Two-panel layout:
  1. Letter Picker — loads real pictograph data from static CSV files
  2. CRT Preview — ASCII render with DOS terminal styling

  Domain: Retro DOS Terminal
-->
<script lang="ts">
  import { AsciiRenderer } from "$lib/features/retro/dos/services/implementations/AsciiRenderer";
  import { createAsciiLabState } from "./ascii-pictograph-lab-state.svelte";
  import AsciiCrtPreview from "./AsciiCrtPreview.svelte";
  import AsciiLetterPicker from "./AsciiLetterPicker.svelte";

  const state = createAsciiLabState();
  const renderer = new AsciiRenderer();

  const htmlLines = $derived(renderer.renderPictograph(state.pictographData, { layers: state.layers }));
  const compact = $derived(renderer.renderCompact(state.pictographData));
</script>

<div class="ascii-lab">
  <div class="ascii-lab-controls">
    <h2 class="ascii-lab-title">ASCII Pictograph Lab</h2>

    <div class="layer-toggles">
      <label class="layer-toggle">
        <input type="checkbox" checked={state.layers.grid} onchange={() => state.toggleLayer("grid")} />
        Grid
      </label>
      <label class="layer-toggle">
        <input type="checkbox" checked={state.layers.hands} onchange={() => state.toggleLayer("hands")} />
        Hands
      </label>
      <label class="layer-toggle">
        <input type="checkbox" checked={state.layers.staves} onchange={() => state.toggleLayer("staves")} />
        Staves
      </label>
      <label class="layer-toggle">
        <input type="checkbox" checked={state.layers.arrows} onchange={() => state.toggleLayer("arrows")} />
        Arrows
      </label>
    </div>

    <AsciiLetterPicker onLetterLoad={state.loadFromMcp} />

    <p class="ascii-lab-info">
      {#if state.letterName}
        Showing: <strong>{state.letterName}</strong> ({state.gridMode})
      {:else}
        Pick a letter above to render
      {/if}
    </p>
  </div>

  <div class="ascii-lab-preview">
    <AsciiCrtPreview {htmlLines} {compact} />
  </div>
</div>

<style>
  .ascii-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    gap: 1rem;
    color: var(--theme-text, #fff);
    overflow-y: auto;
  }

  .ascii-lab-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0;
  }

  .ascii-lab-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .layer-toggles {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .layer-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    cursor: pointer;
  }

  .layer-toggle input[type="checkbox"] {
    accent-color: #33ff33;
  }

  .ascii-lab-info {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .ascii-lab-preview {
    flex: 1;
    min-height: 0;
  }
</style>
