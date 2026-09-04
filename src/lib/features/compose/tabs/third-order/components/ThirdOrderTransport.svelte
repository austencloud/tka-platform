<script lang="ts">
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import { getThirdOrderContext } from "../context/third-order-context";

  const state = getThirdOrderContext();
</script>

<footer class="transport" aria-label="Third Order playback">
  <div class="tempo-wrap">
    <TempoControl
      bpm={state.composition.bpm}
      onBpmChange={state.setBpm}
      showPresets={false}
      showPractice={false}
    />
  </div>
  <div class="timeline-wrap">
    <div class="count-readout">
      <span>{(state.masterBeat + 1).toFixed(2)}</span>
      <small>/ {Math.max(1, state.frame.totalBeats)} counts</small>
    </div>
    <input
      type="range"
      min="0"
      max={Math.max(0.01, state.frame.totalBeats - 0.01)}
      step="0.01"
      value={state.masterBeat}
      aria-label="Composition count"
      oninput={(event) =>
        state.setMasterBeat(Number(event.currentTarget.value))}
    />
  </div>
  <TransportControls
    isPlaying={state.isPlaying}
    onPlaybackToggle={state.togglePlayback}
    onStepHalfBeatBackward={() => state.stepBy(-0.5)}
    onStepHalfBeatForward={() => state.stepBy(0.5)}
    onRestartToStart={state.restart}
    onStepFullBeatForward={() => state.stepBy(1)}
  />
</footer>

<style>
  .transport {
    display: grid;
    grid-template-columns: minmax(170px, 0.65fr) minmax(240px, 1.5fr) minmax(
        220px,
        0.8fr
      );
    align-items: center;
    gap: 18px;
    min-height: 74px;
    padding: 10px clamp(14px, 2vw, 24px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #11131a) 90%,
      transparent
    );
    box-shadow: 0 -10px 35px rgba(0, 0, 0, 0.12);
  }
  .timeline-wrap {
    display: grid;
    grid-template-columns: auto minmax(120px, 1fr);
    align-items: center;
    gap: 13px;
  }
  .count-readout {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 112px;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }
  .count-readout span {
    font-size: 16px;
    font-weight: 800;
  }
  .count-readout small {
    color: var(--theme-text-dim, #9ca3af);
    font-size: 11px;
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--theme-accent, #8b5cf6);
    cursor: pointer;
  }
  @container (max-width: 880px) {
    .transport {
      grid-template-columns: auto 1fr auto;
      gap: 10px;
      min-height: 66px;
      padding: 8px 10px;
    }
    .tempo-wrap {
      display: none;
    }
    .timeline-wrap {
      grid-column: 1 / 3;
    }
  }
  @container (max-width: 560px) {
    .transport {
      grid-template-columns: 1fr;
      gap: 4px;
      padding-block: 6px;
    }
    .timeline-wrap {
      grid-column: 1;
    }
    .count-readout {
      min-width: 96px;
    }
  }
</style>
