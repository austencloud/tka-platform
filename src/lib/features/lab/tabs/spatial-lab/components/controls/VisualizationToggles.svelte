<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();

  const toggles = [
    { key: "showReachEnvelopes" as const, label: "Reach envelopes" },
    { key: "showArmLines" as const, label: "Arm lines" },
    { key: "showCrossingAlert" as const, label: "Crossing alert" },
  ];
</script>

<div class="panel-section">
  <span class="panel-label">Visualization</span>
  {#each toggles as t}
    <div class="toggle-row">
      <span class="toggle-label">{t.label}</span>
      <button
        class="toggle-btn"
        class:on={state[t.key]}
        aria-pressed={state[t.key]}
        aria-label={t.label}
        onclick={() => { state[t.key] = !state[t.key]; }}
      ></button>
    </div>
  {/each}
</div>

<style>
  .panel-section { display: flex; flex-direction: column; gap: 8px; }
  .panel-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
    color: #666; font-weight: 600;
  }
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; }
  .toggle-label { font-size: 12px; color: #ccc; }
  .toggle-btn {
    width: 36px; height: 20px; border-radius: 10px; border: none; cursor: pointer;
    position: relative; transition: background 0.2s; background: #2a2a4a;
  }
  .toggle-btn.on { background: #4a6aff; }
  .toggle-btn::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s;
  }
  .toggle-btn.on::after { transform: translateX(16px); }
</style>
