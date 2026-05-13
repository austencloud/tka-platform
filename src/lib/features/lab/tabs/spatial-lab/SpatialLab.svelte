<script lang="ts">
  import { createSpatialLabState } from "./state/spatial-lab-state.svelte";
  import SpatialScene from "./components/SpatialScene.svelte";
  import SpatialControls from "./components/SpatialControls.svelte";
  import SpatialStatusBar from "./components/SpatialStatusBar.svelte";

  const state = createSpatialLabState();
</script>

<div class="spatial-lab">
  <div class="lab-header">
    <div class="header-left">
      <span class="lab-title">Spatial Lab</span>
      <span class="lab-subtitle">{state.mode === "sequence" ? "Sequence Playback" : "Sandbox Mode"}</span>
    </div>
    <span class="header-hint">Drag props · Click body to lock/unlock · Orbit with mouse</span>
  </div>
  <div class="lab-body">
    <SpatialScene {state} />
    <SpatialControls {state} />
  </div>
  <SpatialStatusBar {state} />
</div>

<style>
  .spatial-lab {
    display: flex; flex-direction: column; height: 100%;
    background: #0d0d1a; color: #e0e0e0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
  .lab-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px; background: #12122a; border-bottom: 1px solid #2a2a4a;
  }
  .header-left { display: flex; align-items: baseline; }
  .lab-title { font-size: 16px; font-weight: 600; color: #fff; letter-spacing: 0.5px; }
  .lab-subtitle { font-size: 11px; color: #888; margin-left: 12px; }
  .header-hint { font-size: 10px; color: #666; }
  .lab-body { display: flex; flex: 1; overflow: hidden; }
</style>
