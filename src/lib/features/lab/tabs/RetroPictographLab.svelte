<!--
  RetroPictographLab.svelte — Lab tab for iterating on Win95 pixel pictograph rendering.

  Similar to AsciiPictographLab but for the Win95 PixelRenderer.
  Side-by-side preview at multiple sizes, layer controls, and
  manual override panel.

  Domain: Retro Win95 Shell
-->
<script lang="ts">
  import { PixelRenderer } from "$lib/features/retro/win95/services/implementations/PixelRenderer";
  import { createAsciiLabState } from "./ascii-pictograph-lab-state.svelte";
  import AsciiLetterPicker from "./AsciiLetterPicker.svelte";
  import AsciiOverridePanel from "./AsciiOverridePanel.svelte";
  import { GridMode } from "$lib/features/retro/shared/domain/pictograph-types";

  /* Reuse the ASCII lab's state factory — same domain types, just different renderer */
  const labState = createAsciiLabState();
  const renderer = new PixelRenderer();

  /* ------------------------------------------------------------------ */
  /* Preview sizes to render                                             */
  /* ------------------------------------------------------------------ */

  const PREVIEW_SIZES = [32, 48, 64, 96, 128, 192];

  let canvasRefs = $state<Record<number, HTMLCanvasElement | undefined>>({});

  /* ------------------------------------------------------------------ */
  /* Re-render all canvases when data changes                            */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    const data = labState.pictographData;
    for (const size of PREVIEW_SIZES) {
      const canvas = canvasRefs[size];
      if (!canvas) continue;

      if (data.letter) {
        renderer.render(canvas, data, 64);
      } else {
        renderer.renderPlaceholder(canvas, 64);
      }
    }
  });
</script>

<div class="retro-picto-lab">
  <div class="lab-controls">
    <h2 class="lab-title">Retro Pictograph Lab</h2>
    <p class="lab-subtitle">Win95 PixelRenderer — 16-color dithered, 64×64 internal</p>

    <div class="grid-mode-toggle">
      <button
        class="mode-btn"
        class:active={labState.gridMode === GridMode.DIAMOND}
        onclick={() => labState.setGridMode(GridMode.DIAMOND)}
      >Diamond</button>
      <button
        class="mode-btn"
        class:active={labState.gridMode === GridMode.BOX}
        onclick={() => labState.setGridMode(GridMode.BOX)}
      >Box</button>
    </div>

    <AsciiLetterPicker onLetterLoad={labState.loadFromMcp} />

    <AsciiOverridePanel
      blueHand={labState.blueHand}
      redHand={labState.redHand}
      onUpdateBlue={labState.updateBlueHand}
      onUpdateRed={labState.updateRedHand}
      onReset={labState.resetToLoaded}
      hasLoadedData={labState.loadedData !== null}
    />

    <p class="lab-info">
      {#if labState.letterName}
        Showing: <strong>{labState.letterName}</strong>
      {:else}
        Default layout (blue N, red S, static)
      {/if}
    </p>
  </div>

  <div class="lab-preview">
    <h3 class="preview-heading">Display Size Comparison</h3>
    <p class="preview-note">All render from the same 64×64 source. CSS upscales with nearest-neighbor.</p>

    <div class="size-grid">
      {#each PREVIEW_SIZES as size (size)}
        <div class="size-card">
          <div class="canvas-frame" style="width: {size}px; height: {size}px;">
            <canvas
              bind:this={canvasRefs[size]}
              width="64"
              height="64"
              class="pixel-canvas"
              style="width: {size}px; height: {size}px;"
              aria-label="Pictograph at {size}px"
            ></canvas>
          </div>
          <span class="size-label">{size}×{size}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .retro-picto-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    gap: 1rem;
    color: var(--theme-text, #fff);
    overflow-y: auto;
  }

  .lab-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0;
  }

  .lab-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .lab-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* ------------------------------------------------------------------ */
  /* Grid mode toggle                                                    */
  /* ------------------------------------------------------------------ */
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
    background: rgba(0, 0, 255, 0.15);
    border-color: #6666ff;
    color: #9999ff;
  }

  .mode-btn:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, #fff);
  }

  /* ------------------------------------------------------------------ */
  /* Info                                                                */
  /* ------------------------------------------------------------------ */
  .lab-info {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  /* ------------------------------------------------------------------ */
  /* Preview area                                                        */
  /* ------------------------------------------------------------------ */
  .lab-preview {
    flex: 1;
    min-height: 0;
  }

  .preview-heading {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    margin: 0 0 4px;
  }

  .preview-note {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0 0 12px;
  }

  .size-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
  }

  .size-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .canvas-frame {
    background: #c0c0c0;
    border: 2px inset #c0c0c0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pixel-canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    display: block;
  }

  .size-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-family: monospace;
  }
</style>
