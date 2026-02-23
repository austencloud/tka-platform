<!--
  LedControlPanel.svelte

  LED controls section extracted from LedTuningTab:
  - Enable/disable toggle
  - Pattern grid selector
  - Color picker and parameter sliders

  CSS variables (--led-green, --led-green-bright, etc.) are inherited
  from the parent's .tuning-tab element.
-->
<script lang="ts">
  import { LED_PATTERNS } from "$lib/shared/animation-engine/domain/types/LedPatterns";

  interface Props {
    ledEnabled: boolean;
    patternId: string;
    primaryColor: string;
    patternSpeed: number;
    glowRadius: number;
    bloomIntensity: number;
    trailFadeRate: number;
  }

  let {
    ledEnabled = $bindable(),
    patternId = $bindable(),
    primaryColor = $bindable(),
    patternSpeed = $bindable(),
    glowRadius = $bindable(),
    bloomIntensity = $bindable(),
    trailFadeRate = $bindable(),
  }: Props = $props();
</script>

<div class="led-section">
  <h3>
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
    LED Effect
  </h3>

  <div class="toggle-row">
    <span>Enabled</span>
    <button
      class="toggle-btn"
      class:active={ledEnabled}
      onclick={() => (ledEnabled = !ledEnabled)}
      aria-label={ledEnabled ? "Disable LED effect" : "Enable LED effect"}
    >
      {ledEnabled ? "ON" : "OFF"}
    </button>
  </div>

  {#if ledEnabled}
    <div class="pattern-grid">
      {#each LED_PATTERNS as pattern (pattern.id)}
        <button
          class="pattern-card"
          class:active={patternId === pattern.id}
          onclick={() => (patternId = pattern.id)}
          aria-pressed={patternId === pattern.id}
          aria-label="Select {pattern.name} LED pattern"
        >
          <span class="pattern-name">{pattern.name}</span>
        </button>
      {/each}
    </div>

    <div class="slider-group">
      <div class="slider-row">
        <label for="color-picker">Color</label>
        <input id="color-picker" type="color" bind:value={primaryColor} />
        <span class="slider-value">{primaryColor}</span>
      </div>

      <div class="slider-row">
        <label for="pattern-speed-slider">Pattern Speed</label>
        <input
          id="pattern-speed-slider"
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          bind:value={patternSpeed}
        />
        <span class="slider-value">{patternSpeed.toFixed(1)}x</span>
      </div>

      <div class="slider-row">
        <label for="glow-radius-slider">Glow Radius</label>
        <input
          id="glow-radius-slider"
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          bind:value={glowRadius}
        />
        <span class="slider-value">{glowRadius.toFixed(1)}</span>
      </div>

      <div class="slider-row">
        <label for="bloom-intensity-slider">Bloom Intensity</label>
        <input
          id="bloom-intensity-slider"
          type="range"
          min="0"
          max="0.15"
          step="0.01"
          bind:value={bloomIntensity}
        />
        <span class="slider-value">{bloomIntensity.toFixed(2)}</span>
      </div>

      <div class="slider-row">
        <label for="trail-fade-slider">Trail Persistence</label>
        <input
          id="trail-fade-slider"
          type="range"
          min="0.80"
          max="0.98"
          step="0.01"
          bind:value={trailFadeRate}
        />
        <span class="slider-value">{trailFadeRate.toFixed(2)}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .led-section {
    border-color: var(--led-green-dim);
  }

  .led-section h3 {
    margin: 0 0 var(--spacing-sm, 8px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .led-section h3 i {
    color: var(--led-green);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .toggle-btn {
    padding: 6px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9999px;
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    min-width: 56px;
  }

  .toggle-btn.active {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--led-green) 30%, transparent),
      color-mix(in srgb, var(--led-green) 15%, transparent)
    );
    border-color: var(--led-green-border-strong);
    color: var(--led-green-bright);
  }

  .toggle-btn:hover {
    border-color: color-mix(in srgb, var(--theme-text) 30%, transparent);
  }

  .toggle-btn.active:hover {
    border-color: color-mix(in srgb, var(--led-green) 70%, transparent);
  }

  .pattern-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    margin: var(--spacing-sm, 8px) 0 var(--spacing-md, 16px);
  }

  .pattern-card {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: center;
  }

  .pattern-card:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .pattern-card.active {
    background: var(--led-green-dim);
    border-color: var(--led-green-border-strong);
  }

  .pattern-card:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .pattern-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
    line-height: 1.2;
  }

  .pattern-card.active .pattern-name {
    color: var(--led-green-bright);
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .slider-row label {
    min-width: 100px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--led-green);
  }

  .slider-row input[type="color"] {
    width: 36px;
    height: 28px;
    padding: 0;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-sm, 4px);
    background: transparent;
    cursor: pointer;
  }

  .slider-row input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .slider-row input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }

  .slider-value {
    min-width: 54px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn,
    .pattern-card {
      transition: none;
    }
  }
</style>
