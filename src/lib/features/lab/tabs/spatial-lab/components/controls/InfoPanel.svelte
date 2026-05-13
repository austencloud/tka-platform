<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();

  function gridName(propX: number, propY: number): string {
    let best = "?", bestD = 999;
    for (const pt of state.gridPoints) {
      const d = Math.hypot(propX - pt.x, propY - pt.y);
      if (d < bestD) { bestD = d; best = pt.name; }
    }
    return best;
  }

  function reachClass(pct: number): string {
    if (pct > 100) return "warn";
    if (pct > 80) return "yellow";
    return "green";
  }

  function rotClass(deg: number): string {
    if (Math.abs(deg) > 45) return "yellow";
    if (Math.abs(deg) > 15) return "";
    return "green";
  }
</script>

<div class="panel-section">
  <span class="panel-label">
    Body
    <span class="badge" class:locked={state.bodyLocked} class:auto={!state.bodyLocked}>
      {state.bodyLocked ? "locked" : "auto"}
    </span>
  </span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Rotation</span>
      <span class="info-value {rotClass(state.bodyRotation)}">{state.bodyRotation.toFixed(1)}°</span>
    </div>
    <div class="info-row">
      <span class="info-label">Mode</span>
      <span class="info-value {state.bodyLocked ? 'yellow' : 'green'}">
        {state.bodyLocked ? "Locked" : "Auto-tracking"}
      </span>
    </div>
    <div class="info-row">
      <span class="info-label">Plane split</span>
      <span class="info-value {state.planeSplitActive ? 'yellow' : 'green'}">
        {state.planeSplitActive ? "Yes" : "No"}
      </span>
    </div>
    <div class="info-row">
      <span class="info-label">Arms crossing</span>
      <span class="info-value {state.crossing ? 'warn' : 'green'}">
        {state.crossing ? "Yes!" : "No"}
      </span>
    </div>
  </div>
  <div class="hint">Click body to lock/unlock</div>
</div>

<div class="panel-section">
  <span class="panel-label">Props</span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Left</span>
      <span class="info-value blue">{gridName(state.leftProp.x, state.leftProp.y)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">L reach</span>
      <span class="info-value {reachClass(state.leftReachPct)}">{state.leftReachPct}%</span>
    </div>
    <div class="spacer"></div>
    <div class="info-row">
      <span class="info-label">Right</span>
      <span class="info-value red">{gridName(state.rightProp.x, state.rightProp.y)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">R reach</span>
      <span class="info-value {reachClass(state.rightReachPct)}">{state.rightReachPct}%</span>
    </div>
  </div>
</div>

{#if !state.leftDiagnosis.reachable || !state.rightDiagnosis.reachable}
<div class="panel-section">
  <span class="panel-label">Diagnosis</span>
  <div class="info-card diagnosis">
    {#if !state.leftDiagnosis.reachable}
      <div class="diag-item">
        <span class="diag-side blue">Left</span>
        <span class="diag-reasons">{state.leftDiagnosis.reasons.join(", ")}</span>
        <span class="diag-suggestion">{state.leftDiagnosis.suggestion}</span>
      </div>
    {/if}
    {#if !state.rightDiagnosis.reachable}
      <div class="diag-item">
        <span class="diag-side red">Right</span>
        <span class="diag-reasons">{state.rightDiagnosis.reasons.join(", ")}</span>
        <span class="diag-suggestion">{state.rightDiagnosis.suggestion}</span>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .panel-section { display: flex; flex-direction: column; gap: 8px; }
  .panel-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
    color: #666; font-weight: 600; display: flex; align-items: center;
  }
  .badge {
    display: inline-block; font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px;
    padding: 2px 6px; border-radius: 3px; margin-left: 6px;
  }
  .badge.auto { background: #2a3a2a; color: #4aff8a; }
  .badge.locked { background: #3a2a2a; color: #ff8844; }
  .info-card { padding: 10px 12px; border-radius: 8px; border: 1px solid #2a2a4a; background: #1a1a35; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 12px; }
  .info-label { color: #888; }
  .info-value { color: #fff; font-weight: 500; font-variant-numeric: tabular-nums; }
  .info-value.blue { color: #4a9eff; }
  .info-value.red { color: #ff4a4a; }
  .info-value.green { color: #4aff8a; }
  .info-value.yellow { color: #ffcc00; }
  .info-value.warn { color: #ff6644; }
  .spacer { height: 4px; }
  .hint { font-size: 10px; color: #555; text-align: center; margin-top: 2px; }
  .diagnosis { border-color: #4a2a2a; background: #1a1520; }
  .diag-item { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
  .diag-item + .diag-item { border-top: 1px solid #2a2a3a; padding-top: 6px; }
  .diag-side { font-size: 11px; font-weight: 600; }
  .diag-side.blue { color: #4a9eff; }
  .diag-side.red { color: #ff4a4a; }
  .diag-reasons { font-size: 10px; color: #ff8844; }
  .diag-suggestion { font-size: 10px; color: #aaa; font-style: italic; }
</style>
