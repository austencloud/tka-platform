<script lang="ts">
  import type { UndulationEasing, MandalaPathShape } from "$lib/shared/mandala/components/SequenceMandala.svelte";

  interface Props {
    paused: boolean;
    pathShape: MandalaPathShape;
    easing: UndulationEasing;
    rotation: number;
    period: number;
    rangeMin: number;
    rangeMax: number;
    onPausedChange: (v: boolean) => void;
    onPathShapeChange: (v: MandalaPathShape) => void;
    onEasingChange: (v: UndulationEasing) => void;
    onRotationChange: (v: number) => void;
    onPeriodChange: (v: number) => void;
    onRangeMinChange: (v: number) => void;
    onRangeMaxChange: (v: number) => void;
  }

  let {
    paused,
    pathShape,
    easing,
    rotation,
    period,
    rangeMin,
    rangeMax,
    onPausedChange,
    onPathShapeChange,
    onEasingChange,
    onRotationChange,
    onPeriodChange,
    onRangeMinChange,
    onRangeMaxChange,
  }: Props = $props();

  let tuneExpanded: boolean = $state(false);

  const PATH_SHAPES: { id: MandalaPathShape; label: string }[] = [
    { id: "arc", label: "Arc" },
    { id: "linear", label: "Linear" },
    { id: "concave", label: "Concave" },
    { id: "motion-aware", label: "Motion" },
  ];

  const EASINGS: { id: UndulationEasing; label: string }[] = [
    { id: "sine", label: "Sine" },
    { id: "ease", label: "Ease" },
    { id: "soft-elastic", label: "Elastic" },
    { id: "breathe", label: "Breathe" },
    { id: "heartbeat", label: "Heart" },
    { id: "drift", label: "Drift" },
    { id: "bloom", label: "Bloom" },
    { id: "tidal", label: "Tidal" },
  ];

  const ROTATIONS: { value: number; label: string }[] = [
    { value: 0, label: "None" },
    { value: 45, label: "45°" },
    { value: 90, label: "90°" },
    { value: 180, label: "180°" },
    { value: 360, label: "360°" },
  ];
</script>

<div class="mandala-controls">
  <div class="control-section">
    <button
      class="play-toggle"
      onclick={() => onPausedChange(!paused)}
      aria-label={paused ? "Play" : "Pause"}
    >
      <i class="fas {paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>
    </button>
  </div>

  <div class="control-section">
    <span class="section-label">Path</span>
    <div class="btn-group">
      {#each PATH_SHAPES as shape}
        <button
          class="ctrl-btn"
          class:active={pathShape === shape.id}
          onclick={() => onPathShapeChange(shape.id)}
        >
          {shape.label}
        </button>
      {/each}
    </div>
  </div>

  <button
    class="tune-toggle"
    onclick={() => { tuneExpanded = !tuneExpanded; }}
    aria-expanded={tuneExpanded}
  >
    <i class="fas fa-sliders" aria-hidden="true"></i>
    Tune
    <i class="fas fa-chevron-{tuneExpanded ? 'up' : 'down'}" aria-hidden="true"></i>
  </button>

  {#if tuneExpanded}
    <div class="tune-panel">
      <div class="control-section">
        <span class="section-label">Easing</span>
        <div class="btn-group wrap">
          {#each EASINGS as e}
            <button
              class="ctrl-btn"
              class:active={easing === e.id}
              onclick={() => onEasingChange(e.id)}
            >
              {e.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-section">
        <span class="section-label">Rotation</span>
        <div class="btn-group">
          {#each ROTATIONS as r}
            <button
              class="ctrl-btn"
              class:active={rotation === r.value}
              onclick={() => onRotationChange(r.value)}
            >
              {r.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-section">
        <span class="section-label">Period</span>
        <input
          type="range"
          min="1"
          max="20"
          step="0.5"
          value={period}
          oninput={(e) => onPeriodChange(Number((e.target as HTMLInputElement).value))}
          class="range-input"
        />
        <span class="range-value">{period}s</span>
      </div>

      <div class="control-section">
        <span class="section-label">Range</span>
        <div class="range-pair">
          <input
            type="number"
            min="0"
            max="150"
            value={rangeMin}
            oninput={(e) => onRangeMinChange(Number((e.target as HTMLInputElement).value))}
            class="num-input"
          />
          <span>–</span>
          <input
            type="number"
            min="100"
            max="300"
            value={rangeMax}
            oninput={(e) => onRangeMaxChange(Number((e.target as HTMLInputElement).value))}
            class="num-input"
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mandala-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    color: var(--theme-text, #e2e8f0);
    font-size: 0.75rem;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.5;
  }

  .play-toggle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.1);
    color: #c4b5fd;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    transition: all 0.2s;
  }

  .play-toggle:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .btn-group {
    display: flex;
    gap: 3px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 2px;
  }

  .btn-group.wrap {
    flex-wrap: wrap;
  }

  .ctrl-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 0.65rem;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .ctrl-btn.active {
    background: rgba(139, 92, 246, 0.25);
    opacity: 1;
    color: #c4b5fd;
  }

  .ctrl-btn:hover {
    opacity: 0.9;
  }

  .tune-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    font-size: 0.68rem;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .tune-toggle:hover {
    opacity: 1;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .tune-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .range-input {
    width: 100%;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    cursor: pointer;
  }

  .range-input::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #a78bfa;
    cursor: pointer;
  }

  .range-value {
    font-size: 0.6rem;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
  }

  .range-pair {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .num-input {
    width: 48px;
    padding: 3px 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    color: inherit;
    font-size: 0.68rem;
    text-align: center;
  }
</style>
