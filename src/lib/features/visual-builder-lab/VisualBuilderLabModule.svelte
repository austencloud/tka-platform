<!--
  VisualBuilderLabModule.svelte - Visual Sequence Builder Lab

  Click grid points to build sequences beat-by-beat. Each hand's path
  is built independently: blue first, then red. Prop animates along
  arc/line paths on each click.

  Layout: Grid-centric. The pictograph square dominates the view,
  sized to fill available space while maintaining 1:1 aspect ratio.
  Controls sit compactly above, pictograph strip below.
-->
<script lang="ts">
  import { createVisualBuilderState } from "./state/visual-builder-state.svelte";
  import InteractiveGrid from "./components/InteractiveGrid.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import BeatStrip from "./components/BeatStrip.svelte";

  const builderState = createVisualBuilderState();
</script>

<div class="visual-builder">
  <!-- Unified controls: phase indicator, orientation, rotation, Done, Undo -->
  <BuilderControls {builderState} />

  <!-- Grid: the centerpiece, fills available space as a square -->
  <div class="grid-container">
    <InteractiveGrid {builderState} />
  </div>

  <!-- Pictograph strip: rendered mini pictographs for each beat -->
  <BeatStrip {builderState} />
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

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .visual-builder {
      padding: 8px;
      gap: 8px;
    }
  }
</style>
