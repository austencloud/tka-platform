<script lang="ts">
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";
  import ViewSwitcher from "./controls/ViewSwitcher.svelte";
  import VisualizationToggles from "./controls/VisualizationToggles.svelte";
  import InfoPanel from "./controls/InfoPanel.svelte";
  import PresetGrid from "./controls/PresetGrid.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state: labState }: Props = $props();
</script>

<div class="side-panel">
  <ViewSwitcher active={labState.viewProjection} onchange={(v) => labState.setView(v)} />
  <VisualizationToggles state={labState} />
  <div class="divider"></div>
  <InfoPanel state={labState} />
  <div class="divider"></div>
  <PresetGrid state={labState} />
</div>

<style>
  .side-panel {
    width: 260px; background: #12122a; border-left: 1px solid #2a2a4a;
    padding: 16px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto;
  }
  .divider { height: 1px; background: #2a2a4a; margin: 2px 0; }
</style>
