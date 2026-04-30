<!--
  FireControlsPanel.svelte

  Fire effect physics controls: intensity/smoke/color sliders and quick presets.
  Effect is always active when in the fire lab - no enable toggle needed.
-->
<script lang="ts">
  interface Props {
    intensity: number;
    colorBlend: number;
    onIntensityChange: (value: number) => void;
    onColorBlendChange: (value: number) => void;
  }

  let {
    intensity,
    colorBlend,
    onIntensityChange,
    onColorBlendChange,
  }: Props = $props();


</script>

<div class="fire-controls">
  <h3>
    <i class="fas fa-fire" aria-hidden="true"></i>
    Fire Effect
  </h3>

  <!-- Intensity slider -->
  <div class="slider-group">
    <div class="slider-row">
      <label for="intensity-slider">Intensity</label>
      <input
        id="intensity-slider"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={intensity}
        oninput={(e) => onIntensityChange(Number(e.currentTarget.value))}
        aria-label="Fire intensity"
      />
      <span class="slider-value">{(intensity * 100).toFixed(0)}%</span>
    </div>
  </div>

  <!-- Color blend slider -->
  <div class="slider-group">
    <div class="slider-row">
      <label for="color-blend-slider">Color</label>
      <input
        id="color-blend-slider"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={colorBlend}
        oninput={(e) => onColorBlendChange(Number(e.currentTarget.value))}
        aria-label="Flame color blend: natural to prop-colored"
      />
      <span class="slider-value">{colorBlend < 0.1 ? "Natural" : colorBlend > 0.9 ? "Colored" : `${(colorBlend * 100).toFixed(0)}%`}</span>
    </div>
  </div>

</div>

<style>
  .fire-controls {
    --flame-orange: #f97316;
    --flame-orange-dim: rgba(249, 115, 22, 0.08);

    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--flame-orange-dim);
    border-radius: var(--border-radius-lg, 12px);
  }

  h3 {
    margin: 0 0 var(--spacing-sm, 8px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  h3 i {
    color: var(--flame-orange);
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    margin-top: var(--spacing-md, 16px);
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    min-height: var(--min-touch-target);
  }

  .slider-row label {
    min-width: 120px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--flame-orange);
  }

  .slider-value {
    min-width: 44px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

</style>
