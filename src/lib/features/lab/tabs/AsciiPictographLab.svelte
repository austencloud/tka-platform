<!--
  AsciiPictographLab.svelte — Lab tab for iterating on ASCII pictograph rendering.

  Three-panel layout:
  1. Letter Picker — load real pictograph data via MCP
  2. Manual Overrides — tweak hand locations, orientations, motion types
  3. CRT Preview — see the ASCII render with DOS terminal styling

  Domain: Retro DOS Terminal
-->
<script lang="ts">
  import { AsciiRenderer } from "$lib/features/retro/dos/services/implementations/AsciiRenderer";
  import { createAsciiLabState } from "./ascii-pictograph-lab-state.svelte";
  import AsciiCrtPreview from "./AsciiCrtPreview.svelte";
  import AsciiLetterPicker from "./AsciiLetterPicker.svelte";
  import AsciiOverridePanel from "./AsciiOverridePanel.svelte";
  import { GridMode } from "$lib/features/retro/shared/domain/pictograph-types";

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

    <div class="grid-mode-toggle">
      <button
        class="mode-btn"
        class:active={state.gridMode === GridMode.DIAMOND}
        onclick={() => state.setGridMode(GridMode.DIAMOND)}
      >Diamond</button>
      <button
        class="mode-btn"
        class:active={state.gridMode === GridMode.BOX}
        onclick={() => state.setGridMode(GridMode.BOX)}
      >Box</button>
    </div>

    <AsciiLetterPicker onLetterLoad={state.loadFromMcp} />

    <AsciiOverridePanel
      blueHand={state.blueHand}
      redHand={state.redHand}
      onUpdateBlue={state.updateBlueHand}
      onUpdateRed={state.updateRedHand}
      onReset={state.resetToLoaded}
      hasLoadedData={state.loadedData !== null}
    />

    <p class="ascii-lab-info">
      {#if state.letterName}
        Showing: <strong>{state.letterName}</strong>
      {:else}
        Default layout (blue N, red S, static)
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

  .grid-mode-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .mode-btn {
    padding: 4px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .mode-btn.active {
    background: rgba(51, 255, 51, 0.15);
    border-color: #33ff33;
    color: #33ff33;
  }

  .mode-btn:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, #fff);
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
