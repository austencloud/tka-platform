<script lang="ts">
  import StageCanvas from "./StageCanvas.svelte";
  import BeatTimeline from "./BeatTimeline.svelte";
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import type { FormationPresetId } from "../domain/stage-types";

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);

  const presets: { id: FormationPresetId; label: string }[] = [
    { id: "line", label: "Line" },
    { id: "triangle", label: "Triangle" },
    { id: "diamond", label: "Diamond" },
    { id: "circle", label: "Circle" },
    { id: "v-shape", label: "V-Shape" },
    { id: "grid", label: "Grid" },
    { id: "stagger", label: "Stagger" },
    { id: "cluster", label: "Cluster" },
  ];

  function initDefault() {
    if (choreography.formations.length === 0) {
      stageState.addFormation(0, "line");
      stageState.addFormation(4, "triangle");
    }
  }

  $effect(() => { initDefault(); });
</script>

<div class="stage-editor-panel">
  <aside class="sidebar">
    <div class="module-header">
      <i class="fas fa-people-group" aria-hidden="true"></i>
      <span>Stage</span>
    </div>
    <section>
      <h3>Performers</h3>
      <label>
        Count: {choreography.performers.length}
        <input
          type="range"
          min="2"
          max="8"
          value={choreography.performers.length}
          oninput={(e) => stageState.setPerformerCount(+(e.target as HTMLInputElement).value)}
        />
      </label>
    </section>

    <section>
      <h3>Presets</h3>
      <div class="preset-grid">
        {#each presets as preset}
          <button
            class="preset-btn"
            onclick={() => stageState.applyPreset(preset.id)}
          >
            {preset.label}
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h3>Formations</h3>
      <p class="hint">{choreography.formations.length} keyframe{choreography.formations.length === 1 ? "" : "s"}</p>
      <p class="hint">Active: F{stageState.activeFormationIndex + 1} (beat {stageState.activeFormation?.beat ?? 0})</p>
    </section>
  </aside>

  <main class="editor-main">
    <StageCanvas />
    <BeatTimeline />
  </main>
</div>

<style>
  .stage-editor-panel {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100%;
    overflow: hidden;
  }
  .sidebar {
    background: #16213e;
    padding: 16px;
    border-right: 1px solid #2a2a4a;
    overflow-y: auto;
  }
  .sidebar h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #8888aa;
    margin: 16px 0 8px;
  }
  .sidebar h3:first-child { margin-top: 0; }
  .sidebar label {
    display: block;
    font-size: 12px;
    color: #c0c0e0;
  }
  .sidebar input[type="range"] {
    width: 100%;
    margin-top: 4px;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: #2a2a4a;
    border-radius: 2px;
    outline: none;
  }
  .sidebar input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #06b6d4;
    cursor: pointer;
  }
  .sidebar input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #06b6d4;
    border: none;
    cursor: pointer;
  }
  .preset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .preset-btn {
    background: #2a2a4a;
    color: #c0c0e0;
    border: 1px solid #3a3a5a;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    text-align: center;
  }
  .preset-btn:hover {
    background: #3a3a6a;
    border-color: #5a5a8a;
  }
  .hint {
    font-size: 11px;
    color: #6a6a8a;
    margin: 4px 0;
  }
  .module-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid #2a2a4a;
    margin-bottom: 4px;
  }
  .module-header i {
    color: #06b6d4;
    font-size: 16px;
  }
  .module-header span {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0ff;
  }
  .editor-main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
