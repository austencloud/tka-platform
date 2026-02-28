<!--
  FireControlsPanel.svelte

  Fire effect physics controls: intensity/smoke/color sliders and quick presets.
  Effect is always active when in the fire lab — no enable toggle needed.
-->
<script lang="ts">
  interface Props {
    intensity: number;
    colorBlend: number;
    smokeLevel: number;
    onIntensityChange: (value: number) => void;
    onColorBlendChange: (value: number) => void;
    onSmokeLevelChange: (value: number) => void;
  }

  let {
    intensity,
    colorBlend,
    smokeLevel,
    onIntensityChange,
    onColorBlendChange,
    onSmokeLevelChange,
  }: Props = $props();

  function applyPreset(preset: { intensity: number; smokeLevel: number; colorBlend: number }) {
    onIntensityChange(preset.intensity);
    onSmokeLevelChange(preset.smokeLevel);
    onColorBlendChange(preset.colorBlend);
  }
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

  <!-- Smoke slider -->
  <div class="slider-group">
    <div class="slider-row">
      <label for="smoke-slider">Smoke</label>
      <input
        id="smoke-slider"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={smokeLevel}
        oninput={(e) => onSmokeLevelChange(Number(e.currentTarget.value))}
        aria-label="Smoke level"
      />
      <span class="slider-value">{(smokeLevel * 100).toFixed(0)}%</span>
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

  <!-- Quick presets -->
  <div class="presets-section">
    <span class="section-label">Presets</span>
    <div class="presets-row">
      <button
        class="preset-btn"
        onclick={() => applyPreset({ intensity: 0.8, smokeLevel: 0.05, colorBlend: 0 })}
        type="button"
        aria-label="Apply clean burn preset"
      >
        Clean Burn
      </button>
      <button
        class="preset-btn"
        onclick={() => applyPreset({ intensity: 0.6, smokeLevel: 0.7, colorBlend: 0 })}
        type="button"
        aria-label="Apply smoky fire preset"
      >
        Smoky
      </button>
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

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .presets-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: var(--spacing-sm, 8px);
  }

  .presets-row {
    display: flex;
    gap: 6px;
  }

  .preset-btn {
    flex: 1;
    min-height: 48px;
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .preset-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
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
    min-height: 48px;
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

  @media (prefers-reduced-motion: reduce) {
    .preset-btn {
      transition: none;
    }
  }
</style>
