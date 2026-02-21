<!--
  VisualBuilderToolPanel - Tool panel content for the Visual Builder tab.

  Renders BuilderControls (turn/rotation/done buttons) at top,
  InteractiveGrid (clickable pictograph) filling the remaining space.
-->
<script lang="ts">
  import type { VisualBuilderTabState } from "../../shared/state/visual-builder-tab-state.svelte";
  import BuilderControls from "$lib/features/visual-builder-lab/components/BuilderControls.svelte";
  import InteractiveGrid from "$lib/features/visual-builder-lab/components/InteractiveGrid.svelte";

  let { tabState }: { tabState: VisualBuilderTabState } = $props();

  const builderState = $derived(tabState.visualBuilderState);
</script>

<div class="visual-builder-tool-panel">
  <div class="controls-section">
    <BuilderControls {builderState} />
  </div>
  <div class="grid-section">
    <InteractiveGrid {builderState} />
  </div>
</div>

<style>
  .visual-builder-tool-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .controls-section {
    flex-shrink: 0;
  }

  .grid-section {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
