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
  <div class="transport-row">
    <button
      type="button"
      class="chip transport-chip"
      class:active={!paused}
      onclick={() => onPausedChange(!paused)}
      aria-label={paused ? "Play" : "Pause"}
      aria-pressed={!paused}
    >
      <i class="fas {paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>
    </button>
    <div class="speed-row">
      <span class="setting-label">Speed</span>
      <input
        type="range"
        min="1"
        max="20"
        step="0.5"
        value={period}
        oninput={(e) => onPeriodChange(Number((e.target as HTMLInputElement).value))}
        class="slider"
      />
      <span class="slider-value">{period}s</span>
    </div>
  </div>

  <div class="control-group">
    <span class="setting-label">Path Shape</span>
    <div class="chip-grid cols-4">
      {#each PATH_SHAPES as shape}
        <button
          type="button"
          class="chip"
          class:active={pathShape === shape.id}
          onclick={() => onPathShapeChange(shape.id)}
          aria-pressed={pathShape === shape.id}
        >{shape.label}</button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="setting-label">Easing</span>
    <div class="chip-grid cols-4">
      {#each EASINGS as e}
        <button
          type="button"
          class="chip"
          class:active={easing === e.id}
          onclick={() => onEasingChange(e.id)}
          aria-pressed={easing === e.id}
        >{e.label}</button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="setting-label">Rotation</span>
    <div class="chip-grid cols-5">
      {#each ROTATIONS as r}
        <button
          type="button"
          class="chip"
          class:active={rotation === r.value}
          onclick={() => onRotationChange(r.value)}
          aria-pressed={rotation === r.value}
        >{r.label}</button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="setting-label">Range</span>
    <div class="range-sliders">
      <div class="range-slider-row">
        <span class="range-hint">Min</span>
        <input
          type="range"
          min="0"
          max="150"
          step="5"
          value={rangeMin}
          oninput={(e) => onRangeMinChange(Number((e.target as HTMLInputElement).value))}
          class="slider"
        />
        <span class="slider-value">{rangeMin}</span>
      </div>
      <div class="range-slider-row">
        <span class="range-hint">Max</span>
        <input
          type="range"
          min="100"
          max="300"
          step="5"
          value={rangeMax}
          oninput={(e) => onRangeMaxChange(Number((e.target as HTMLInputElement).value))}
          class="slider"
        />
        <span class="slider-value">{rangeMax}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .mandala-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 14px 16px;
  }

  .transport-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .transport-chip {
    flex-shrink: 0;
  }

  .speed-row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .chip-grid {
    display: grid;
    gap: 6px;
  }

  .chip-grid.cols-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  .chip-grid.cols-5 {
    grid-template-columns: repeat(5, 1fr);
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 6px 4px;
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .slider {
    flex: 1;
    height: 4px;
    appearance: none;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border: 2px solid var(--theme-panel-bg, rgba(10, 10, 26, 0.9));
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .slider-value {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
  }

  .range-sliders {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .range-slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .range-hint {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    min-width: 28px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none !important;
    }
    .chip:active {
      transform: none !important;
    }
  }
</style>
