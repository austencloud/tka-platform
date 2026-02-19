<!--
  VisualBuilderLabModule.svelte - Visual Sequence Builder Lab

  Click grid points to build sequences beat-by-beat. Both hands are
  constructed independently per beat, with immediate visual feedback
  in the same coordinate space as the pictograph.

  Layout: Grid-centric design. The pictograph square dominates the view,
  sized to fill available space while maintaining 1:1 aspect ratio.
  Controls sit compactly above and below.
-->
<script lang="ts">
  import { createVisualBuilderState } from "./state/visual-builder-state.svelte";
  import InteractiveGrid from "./components/InteractiveGrid.svelte";
  import HandSelector from "./components/HandSelector.svelte";
  import BuildPhaseIndicator from "./components/BuildPhaseIndicator.svelte";

  const state = createVisualBuilderState();
</script>

<div class="visual-builder">
  <!-- Compact toolbar: hand selector + rotation + phase instruction -->
  <div class="toolbar">
    <HandSelector {state} />
    <BuildPhaseIndicator {state} />
  </div>

  <!-- Grid: the centerpiece, fills available space as a square -->
  <div class="grid-container">
    <InteractiveGrid {state} />
  </div>

  <!-- Completed beats strip -->
  {#if state.beatCount > 0}
    <div class="beats-strip">
      {#each state.completedBeats as beat, i}
        <div class="beat-chip">
          <span class="chip-number">Beat {i + 1}</span>
          <span class="chip-detail blue-detail">{beat.blue.start} &rarr; {beat.blue.end}</span>
          <span class="chip-detail red-detail">{beat.red.start} &rarr; {beat.red.end}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .visual-builder {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 12px;
    gap: 12px;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* Toolbar: compact row with all controls */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
    max-width: 700px;
  }

  /* Grid container: takes all remaining vertical space, constrains to square */
  .grid-container {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /*
   * The InteractiveGrid has aspect-ratio: 1. We need it to fit the
   * available rectangle (width x height from flex:1) as the largest
   * square that fits. CSS aspect-ratio on the child handles this
   * when we constrain both max-width and max-height.
   */
  .grid-container :global(.interactive-grid) {
    max-width: 100%;
    max-height: 100%;
  }

  /* Completed beats: horizontal scrollable strip */
  .beats-strip {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    overflow-x: auto;
    width: 100%;
    max-width: 700px;
    padding: 4px 0;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .beat-chip {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    flex-shrink: 0;
    min-width: 100px;
  }

  .chip-number {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-detail {
    font-size: var(--font-size-compact, 12px);
  }

  .blue-detail {
    color: var(--prop-blue, #2e8bf0);
  }

  .red-detail {
    color: var(--prop-red, #ed1c24);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .visual-builder {
      padding: 8px;
      gap: 8px;
    }

    .toolbar {
      gap: 8px;
    }
  }
</style>
