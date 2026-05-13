<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state: labState }: Props = $props();

  const locationLabels: Record<string, string> = {
    n: "North", e: "East", s: "South", w: "West",
    ne: "NE", se: "SE", sw: "SW", nw: "NW",
  };

  function locName(loc: string): string {
    return locationLabels[loc] ?? loc;
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
    <span class="badge" class:locked={labState.bodyLocked} class:auto={!labState.bodyLocked}>
      {labState.bodyLocked ? "locked" : "auto"}
    </span>
  </span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Rotation</span>
      <span class="info-value {rotClass(labState.bodyRotation)}">{labState.bodyRotation.toFixed(1)}°</span>
    </div>
    <div class="info-row">
      <span class="info-label">Plane split</span>
      <span class="info-value {labState.planeSplitActive ? 'yellow' : 'green'}">
        {labState.planeSplitActive ? "Yes" : "No"}
      </span>
    </div>
    <div class="info-row">
      <span class="info-label">Arms crossing</span>
      <span class="info-value {labState.crossing ? 'warn' : 'green'}">
        {labState.crossing ? "Yes!" : "No"}
      </span>
    </div>
  </div>
</div>

<div class="panel-section">
  <span class="panel-label">Props</span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Blue (L)</span>
      <span class="info-value blue">{locName(labState.leftLocation)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">L reach</span>
      <span class="info-value {reachClass(labState.leftReachPct)}">{labState.leftReachPct}%</span>
    </div>
    <div class="spacer"></div>
    <div class="info-row">
      <span class="info-label">Red (R)</span>
      <span class="info-value red">{locName(labState.rightLocation)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">R reach</span>
      <span class="info-value {reachClass(labState.rightReachPct)}">{labState.rightReachPct}%</span>
    </div>
  </div>
</div>

{#if !labState.leftDiagnosis.reachable || !labState.rightDiagnosis.reachable}
<div class="panel-section">
  <span class="panel-label">Diagnosis</span>
  <div class="info-card diagnosis">
    {#if !labState.leftDiagnosis.reachable}
      <div class="diag-item">
        <span class="diag-side blue">Blue (L)</span>
        <span class="diag-reasons">{labState.leftDiagnosis.reasons.join(", ")}</span>
        <span class="diag-suggestion">{labState.leftDiagnosis.suggestion}</span>
      </div>
    {/if}
    {#if !labState.rightDiagnosis.reachable}
      <div class="diag-item">
        <span class="diag-side red">Red (R)</span>
        <span class="diag-reasons">{labState.rightDiagnosis.reasons.join(", ")}</span>
        <span class="diag-suggestion">{labState.rightDiagnosis.suggestion}</span>
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
  .diagnosis { border-color: #4a2a2a; background: #1a1520; }
  .diag-item { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
  .diag-item + .diag-item { border-top: 1px solid #2a2a3a; padding-top: 6px; }
  .diag-side { font-size: 11px; font-weight: 600; }
  .diag-side.blue { color: #4a9eff; }
  .diag-side.red { color: #ff4a4a; }
  .diag-reasons { font-size: 10px; color: #ff8844; }
  .diag-suggestion { font-size: 10px; color: #aaa; font-style: italic; }
</style>
