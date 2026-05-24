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

  const PATH_SHAPES: { id: MandalaPathShape; label: string }[] = [
    { id: "arc", label: "Arc" },
    { id: "linear", label: "Linear" },
    { id: "concave", label: "Concave" },
    { id: "motion-aware", label: "Motion Aware" },
  ];

  const EASINGS: { id: UndulationEasing; label: string }[] = [
    { id: "sine", label: "Sine" },
    { id: "ease", label: "Ease" },
    { id: "soft-elastic", label: "Elastic" },
    { id: "breathe", label: "Breathe" },
    { id: "heartbeat", label: "Heartbeat" },
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
  <div class="transport">
    <button
      class="transport-btn"
      class:active={!paused}
      onclick={() => onPausedChange(!paused)}
      aria-label={paused ? "Play" : "Pause"}
    >
      <i class="fas {paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>
    </button>
    <div class="speed-control">
      <input
        type="range"
        min="1"
        max="20"
        step="0.5"
        value={period}
        oninput={(e) => onPeriodChange(Number((e.target as HTMLInputElement).value))}
        class="speed-slider"
      />
      <span class="speed-label">{period}s</span>
    </div>
  </div>

  <div class="control-group">
    <span class="group-label">Path Shape</span>
    <div class="pill-row">
      {#each PATH_SHAPES as shape}
        <button
          class="pill"
          class:active={pathShape === shape.id}
          onclick={() => onPathShapeChange(shape.id)}
        >
          {shape.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="group-label">Easing</span>
    <div class="pill-grid">
      {#each EASINGS as e}
        <button
          class="pill"
          class:active={easing === e.id}
          onclick={() => onEasingChange(e.id)}
        >
          {e.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="group-label">Rotation</span>
    <div class="pill-row">
      {#each ROTATIONS as r}
        <button
          class="pill"
          class:active={rotation === r.value}
          onclick={() => onRotationChange(r.value)}
        >
          {r.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="group-label">Range</span>
    <div class="range-row">
      <div class="range-field">
        <span class="range-hint">Min</span>
        <input
          type="number"
          min="0"
          max="150"
          value={rangeMin}
          oninput={(e) => onRangeMinChange(Number((e.target as HTMLInputElement).value))}
          class="num-input"
        />
      </div>
      <span class="range-sep">–</span>
      <div class="range-field">
        <span class="range-hint">Max</span>
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
</div>

<style>
  .mandala-controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
    color: var(--theme-text, #e2e8f0);
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .transport-btn {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.08);
    color: rgba(196, 181, 253, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.15s ease;
  }

  .transport-btn.active {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
  }

  .transport-btn:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.6);
    color: #ddd6fe;
  }

  .speed-control {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .speed-slider {
    flex: 1;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    cursor: pointer;
  }

  .speed-slider::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #a78bfa;
    border: 2px solid rgba(10, 10, 26, 0.6);
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .speed-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .speed-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.35);
  }

  .pill-row {
    display: flex;
    gap: 4px;
  }

  .pill-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .pill {
    padding: 6px 0;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
    flex: 1;
  }

  .pill:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .pill.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  .range-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .range-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .range-hint {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.25);
  }

  .range-sep {
    color: rgba(255, 255, 255, 0.2);
    font-size: 14px;
    padding-bottom: 6px;
  }

  .num-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
    color: inherit;
    font-size: 12px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    transition: border-color 0.15s ease;
  }

  .num-input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.4);
  }
</style>
