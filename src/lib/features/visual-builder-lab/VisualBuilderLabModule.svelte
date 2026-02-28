<!--
  VisualBuilderLabModule.svelte - Visual Sequence Builder Lab

  Click grid points to build sequences step-by-step. Each hand's path
  is built independently: blue first, then red. Prop animates along
  arc/line paths on each click.

  Layout: Grid-centric. The pictograph square dominates the view,
  sized to fill available space while maintaining 1:1 aspect ratio.
  Controls overlay the grid as corner clusters. Step strip below.
-->
<script lang="ts">
  import { createVisualBuilderState } from "./state/visual-builder-state.svelte";
  import InteractiveGrid from "./components/InteractiveGrid.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import StepStrip from "./components/StepStrip.svelte";

  const builderState = createVisualBuilderState();
</script>

<div class="visual-builder">
  <!-- Grid + overlaid controls -->
  <div class="grid-container">
    <InteractiveGrid {builderState} />
    <BuilderControls {builderState} />
  </div>

  <!-- Step strip: rendered mini pictographs for each step -->
  <StepStrip {builderState} />
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

  .grid-container {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .grid-container :global(.interactive-grid) {
    max-width: 100%;
    max-height: 100%;
  }

  @media (max-width: 768px) {
    .visual-builder {
      padding: 8px;
      gap: 8px;
    }
  }
</style>
