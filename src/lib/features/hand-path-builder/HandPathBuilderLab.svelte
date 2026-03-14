<!--
  HandPathBuilderLab.svelte - Hand Path Builder lab tab

  Tap grid locations to draw spatial hand paths for blue and red hands.
  No rotation — pure geometric paths through grid positions.
  Output: HandPathData objects saved to Firestore via HandPathRepository.

  Workflow:
    1. Pick a grid mode (diamond default)
    2. Tap to build the blue hand path (min 2 points)
    3. Switch to red, tap to build the red hand path (must match blue length)
    4. Complete → save both paths to the library
-->
<script lang="ts">
  import { createBuilderState } from "./state/builder-state.svelte";
  import { setBuilderContext } from "./context/builder-context";
  import BuilderGrid from "./components/BuilderGrid.svelte";
  import PathPreview from "./components/PathPreview.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import GridModeSelector from "./components/GridModeSelector.svelte";

  const state = createBuilderState();
  setBuilderContext(state);
</script>

<div class="hand-path-builder">
  <header class="lab-header">
    <h2 class="lab-title">Hand Path Builder</h2>
    <p class="lab-subtitle">Tap grid points to draw spatial paths for each hand.</p>
  </header>

  <div class="mode-bar">
    <GridModeSelector />
  </div>

  <div class="grid-area">
    <BuilderGrid />
  </div>

  <div class="preview-area">
    <PathPreview />
  </div>

  <div class="controls-area">
    <BuilderControls />
  </div>
</div>

<style>
  .hand-path-builder {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 16px;
    gap: 12px;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    box-sizing: border-box;
  }

  .lab-header {
    text-align: center;
    flex-shrink: 0;
  }

  .lab-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0 0 4px;
  }

  .lab-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    margin: 0;
  }

  .mode-bar {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  .grid-area {
    width: 100%;
    max-width: 400px;
    flex-shrink: 0;
  }

  .preview-area {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  .controls-area {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .hand-path-builder {
      padding: 10px;
      gap: 10px;
    }

    .lab-title {
      font-size: 16px;
    }
  }
</style>
