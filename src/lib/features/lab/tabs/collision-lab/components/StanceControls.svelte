<script lang="ts">
  /**
   * StanceControls
   *
   * Four sliders for the performer's stance: where they stand on the
   * floor (X and Z offset relative to the grid), plus body yaw and
   * spine pitch. The reviewer dials these in live to find a
   * configuration that clears the collision, then commits the current
   * values via the label buttons.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import { STANCE_BOUNDS } from "../domain/types";

  const labCtx = getCollisionLabContext();

  const RAD2DEG = 180 / Math.PI;
  const DEG2RAD = Math.PI / 180;

  const reach = $derived(labCtx.state.currentReachability);

  function onFootX(e: Event) {
    labCtx.state.setFootOffsetX(parseFloat((e.target as HTMLInputElement).value));
  }
  function onFootZ(e: Event) {
    labCtx.state.setFootOffsetZ(parseFloat((e.target as HTMLInputElement).value));
  }
  function onYaw(e: Event) {
    const deg = parseFloat((e.target as HTMLInputElement).value);
    labCtx.state.setRootYawRad(deg * DEG2RAD);
  }
  function onPitch(e: Event) {
    const deg = parseFloat((e.target as HTMLInputElement).value);
    labCtx.state.setSpinePitchRad(deg * DEG2RAD);
  }
</script>

<div class="controls">
  <div class="header">
    <h4 class="title">Performer stance</h4>
    <button class="reset" onclick={() => labCtx.state.resetStance()}>
      Reset
    </button>
  </div>

  <div class="reach-badge" class:unreachable={!reach.reachable}>
    {#if reach.reachable}
      <span class="dot ok"></span>
      Hands can reach props
    {:else}
      <span class="dot bad"></span>
      <div class="reach-details">
        <span>Out of reach</span>
        {#if reach.blueExcess > 0}
          <small>Blue hand: {(reach.blueExcess * 100).toFixed(0)} cm short</small>
        {/if}
        {#if reach.redExcess > 0}
          <small>Red hand: {(reach.redExcess * 100).toFixed(0)} cm short</small>
        {/if}
      </div>
    {/if}
  </div>

  <div class="slider">
    <label for="foot-x">
      Left / Right
      <span class="value">{labCtx.state.footOffsetX.toFixed(2)} m</span>
    </label>
    <input
      id="foot-x"
      type="range"
      min={STANCE_BOUNDS.footOffset.min}
      max={STANCE_BOUNDS.footOffset.max}
      step={STANCE_BOUNDS.footOffset.step}
      value={labCtx.state.footOffsetX}
      oninput={onFootX}
    />
  </div>

  <div class="slider">
    <label for="foot-z">
      Back / Forward
      <span class="value">{labCtx.state.footOffsetZ.toFixed(2)} m</span>
    </label>
    <input
      id="foot-z"
      type="range"
      min={STANCE_BOUNDS.footOffset.min}
      max={STANCE_BOUNDS.footOffset.max}
      step={STANCE_BOUNDS.footOffset.step}
      value={labCtx.state.footOffsetZ}
      oninput={onFootZ}
    />
  </div>

  <div class="slider">
    <label for="yaw">
      Body turn
      <span class="value">{Math.round(labCtx.state.rootYawRad * RAD2DEG)}°</span>
    </label>
    <input
      id="yaw"
      type="range"
      min={STANCE_BOUNDS.rootYawDeg.min}
      max={STANCE_BOUNDS.rootYawDeg.max}
      step={STANCE_BOUNDS.rootYawDeg.step}
      value={Math.round(labCtx.state.rootYawRad * RAD2DEG)}
      oninput={onYaw}
    />
  </div>

  <div class="slider">
    <label for="pitch">
      Lean forward
      <span class="value">{Math.round(labCtx.state.spinePitchRad * RAD2DEG)}°</span>
    </label>
    <input
      id="pitch"
      type="range"
      min={STANCE_BOUNDS.spinePitchDeg.min}
      max={STANCE_BOUNDS.spinePitchDeg.max}
      step={STANCE_BOUNDS.spinePitchDeg.step}
      value={Math.round(labCtx.state.spinePitchRad * RAD2DEG)}
      oninput={onPitch}
    />
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    opacity: 0.9;
  }
  .reset {
    padding: 4px 10px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 4px;
    color: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .reset:hover {
    background: var(--theme-stroke);
  }
  .slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .slider label {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    opacity: 0.8;
  }
  .slider .value {
    font-family: monospace;
    font-weight: 600;
    opacity: 1;
  }
  .slider input[type="range"] {
    width: 100%;
    margin: 0;
  }
  .reach-badge {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    background: color-mix(in srgb, #22c55e 10%, var(--theme-panel-bg));
    border: 1px solid color-mix(in srgb, #22c55e 40%, transparent);
    border-radius: 6px;
    font-size: 12px;
  }
  .reach-badge.unreachable {
    background: color-mix(in srgb, #ef4444 12%, var(--theme-panel-bg));
    border-color: color-mix(in srgb, #ef4444 50%, transparent);
    color: #fca5a5;
  }
  .reach-badge .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
  }
  .reach-badge .dot.ok {
    background: #22c55e;
    box-shadow: 0 0 6px #22c55e;
  }
  .reach-badge .dot.bad {
    background: #ef4444;
    box-shadow: 0 0 6px #ef4444;
  }
  .reach-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .reach-details small {
    opacity: 0.85;
    font-size: 11px;
  }
</style>
