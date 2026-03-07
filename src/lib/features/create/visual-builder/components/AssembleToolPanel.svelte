<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  Renders BuilderControls (turn/rotation/done buttons) at top,
  InteractiveGrid (clickable pictograph) filling the remaining space.
-->
<script lang="ts">
  import type { AssembleTabState } from "../../shared/state/assemble-tab-state.svelte";
  import BuilderControls from "$lib/features/visual-builder-lab/components/BuilderControls.svelte";
  import InteractiveGrid from "$lib/features/visual-builder-lab/components/InteractiveGrid.svelte";

  let { tabState }: { tabState: AssembleTabState } = $props();

  const builderState = $derived(tabState.assembleBuilderState);
</script>

<div class="assemble-tool-panel">
  <div class="controls-section">
    <BuilderControls {builderState} />
  </div>
  <div class="grid-section">
    <InteractiveGrid {builderState} />
  </div>
</div>

<style>
  .assemble-tool-panel {
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
