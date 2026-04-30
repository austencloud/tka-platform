<script lang="ts">
  /**
   * StanceControls - Tweak panel
   *
   * A row of four sliders (foot X, foot Z, body yaw, spine pitch) for
   * fine-tuning the stance after the reviewer has picked a candidate
   * from the grid. The primary labeling flow is the candidate grid;
   * these sliders exist for the rare case where none of the six
   * candidates is exactly right but one of them is close enough to
   * want a small nudge.
   *
   * Always rendered (no collapsible wrapper) so the reviewer can see
   * the current stance values even before picking. When no candidate
   * is picked yet, the sliders are visually dimmed and pointer-events
   * are disabled. The first slider drag after a pick calls
   * `state.markManuallyAdjusted()` so the eventual label records
   * `pickedIndex: null` instead of the original candidate index.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import { STANCE_BOUNDS } from "../domain/types";

  const labCtx = getCollisionLabContext();

  const RAD2DEG = 180 / Math.PI;
  const DEG2RAD = Math.PI / 180;

  const candidateSet = $derived(labCtx.state.currentCandidateSet);
  const hasPicked = $derived(
    candidateSet?.pickedIndex !== null && candidateSet?.pickedIndex !== undefined
  );
  const alreadyAdjusted = $derived(candidateSet?.manuallyAdjusted ?? false);

  /**
   * First-touch adjustment marker - the reviewer has just dragged a
   * slider for the first time since picking a candidate. After this the
   * label will save with `pickedIndex: null`.
   */
  function markAdjusted() {
    if (hasPicked && !alreadyAdjusted) {
      labCtx.state.markManuallyAdjusted();
    }
  }

  function onFootX(e: Event) {
    markAdjusted();
    labCtx.state.setFootOffsetX(parseFloat((e.target as HTMLInputElement).value));
  }
  function onFootZ(e: Event) {
    markAdjusted();
    labCtx.state.setFootOffsetZ(parseFloat((e.target as HTMLInputElement).value));
  }
  function onYaw(e: Event) {
    markAdjusted();
    const deg = parseFloat((e.target as HTMLInputElement).value);
    labCtx.state.setRootYawRad(deg * DEG2RAD);
  }
  function onPitch(e: Event) {
    markAdjusted();
    const deg = parseFloat((e.target as HTMLInputElement).value);
    labCtx.state.setSpinePitchRad(deg * DEG2RAD);
  }
</script>

<div class="tweak-panel">
  <div class="header">
    <span class="title">Fine-tune stance</span>
    {#if !hasPicked}
      <span class="hint">Pick a candidate first</span>
    {:else if alreadyAdjusted}
      <span class="hint adjusted">Adjusted</span>
    {/if}
  </div>

  <div class="controls" class:disabled={!hasPicked}>
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
        disabled={!hasPicked}
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
        disabled={!hasPicked}
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
        disabled={!hasPicked}
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
        disabled={!hasPicked}
        oninput={onPitch}
      />
    </div>
  </div>
</div>

<style>
  .tweak-panel {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 8px 14px 12px;
  }

  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 2px 0 6px;
    font-size: 13px;
    font-weight: 600;
  }

  .title {
    flex: 1;
  }

  .hint {
    font-size: 11px;
    font-weight: 500;
    opacity: 0.7;
  }
  .hint.adjusted {
    color: #f59e0b;
    opacity: 1;
  }

  .controls {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px 16px;
  }

  /* Stack to two columns on narrow layouts. */
  @container (max-width: 720px) {
    .controls {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .controls.disabled {
    opacity: 0.35;
    pointer-events: none;
  }

  .slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .slider label {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    opacity: 0.8;
    gap: 8px;
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
  .slider input[type="range"]:disabled {
    cursor: not-allowed;
  }
</style>
