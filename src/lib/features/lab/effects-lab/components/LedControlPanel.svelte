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
  import { LED_PATTERNS } from "$lib/shared/animation-engine/domain/types/led-patterns";
  import type { LedColorMode } from "$lib/shared/animation-engine/domain/types/led-types";

  interface Props {
    brightness: number;
    patternId: string;
    primaryColor: string;
    patternSpeed: number;
    glowRadius: number;
    bloomIntensity: number;
    trailFadeRate: number;
    colorMode: LedColorMode;
    blueHandColor: string;
    redHandColor: string;
  }

  let {
    brightness = $bindable(),
    patternId = $bindable(),
    primaryColor = $bindable(),
    patternSpeed = $bindable(),
    glowRadius = $bindable(),
    bloomIntensity = $bindable(),
    trailFadeRate = $bindable(),
    colorMode = $bindable(),
    blueHandColor = $bindable(),
    redHandColor = $bindable(),
  }: Props = $props();

  const brightnessLevels = [1, 2, 3, 4, 5];

  const colorModes: { id: LedColorMode; label: string }[] = [
    { id: "unified", label: "Unified" },
    { id: "per-hand", label: "Per-Hand" },
    { id: "prop-matched", label: "Prop Colors" },
  ];
</script>

<div class="led-section">
  <h3>
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
    LED Effect
  </h3>

  <div class="brightness-section">
      <span class="brightness-label">Brightness</span>
      <div class="brightness-row">
        {#each brightnessLevels as level}
          <button
            class="brightness-btn"
            class:active={brightness === level}
            aria-pressed={brightness === level}
            onclick={() => (brightness = level)}
            type="button"
            aria-label="Set LED brightness to level {level}"
          >
            {level}
          </button>
        {/each}
      </div>
    </div>

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

    <!-- Color Mode -->
    <div class="color-mode-section">
      <span class="color-mode-label">Color Mode</span>
      <div class="color-mode-toggle" role="radiogroup" aria-label="LED color mode">
        {#each colorModes as mode (mode.id)}
          <button
            role="radio"
            class="color-mode-btn"
            class:active={colorMode === mode.id}
            aria-checked={colorMode === mode.id}
            onclick={() => (colorMode = mode.id)}
          >
            {mode.label}
          </button>
        {/each}
      </div>

      {#if colorMode === "unified"}
        <div class="color-picker-row">
          <label for="color-picker">Color</label>
          <input id="color-picker" type="color" bind:value={primaryColor} />
          <span class="color-value">{primaryColor}</span>
        </div>
      {:else if colorMode === "per-hand"}
        <div class="color-picker-row">
          <label for="blue-hand-picker">Blue hand</label>
          <input id="blue-hand-picker" type="color" bind:value={blueHandColor} />
          <span class="color-value">{blueHandColor}</span>
        </div>
        <div class="color-picker-row">
          <label for="red-hand-picker">Red hand</label>
          <input id="red-hand-picker" type="color" bind:value={redHandColor} />
          <span class="color-value">{redHandColor}</span>
        </div>
      {/if}
      <!-- prop-matched: no pickers needed, uses canonical blue/red -->
    </div>

    <div class="slider-group">
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

  .brightness-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: var(--spacing-sm, 8px) 0;
  }

  .brightness-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .brightness-row {
    display: flex;
    gap: 6px;
  }

  .brightness-btn {
    flex: 1;
    min-height: var(--min-touch-target);
    padding: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .brightness-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .brightness-btn.active {
    background: var(--led-green-dim);
    border-color: var(--led-green-border-strong);
    color: var(--led-green-bright);
  }

  .brightness-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .pattern-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: var(--spacing-sm, 8px) 0 var(--spacing-md, 16px);
  }

  .pattern-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target);
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

  .color-mode-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: var(--spacing-sm, 8px) 0;
  }

  .color-mode-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .color-mode-toggle {
    display: flex;
    gap: 2px;
    background: color-mix(in srgb, var(--theme-text) 3%, transparent);
    border-radius: var(--border-radius-md, 8px);
    padding: 3px;
  }

  .color-mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    min-height: var(--min-touch-target);
  }

  .color-mode-btn:hover {
    color: var(--theme-text, white);
    background: color-mix(in srgb, var(--theme-text) 6%, transparent);
  }

  .color-mode-btn.active {
    background: var(--led-green-mid, rgba(0, 255, 136, 0.15));
    color: var(--led-green-bright, #33ffaa);
    box-shadow: 0 1px 3px var(--theme-overlay-dark, rgba(0, 0, 0, 0.2));
  }

  .color-mode-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  .color-picker-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .color-picker-row label {
    min-width: 100px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .color-picker-row input[type="color"] {
    width: 36px;
    height: 28px;
    padding: 0;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-sm, 4px);
    background: transparent;
    cursor: pointer;
  }

  .color-picker-row input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-picker-row input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }

  .color-value {
    min-width: 54px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
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
    min-height: var(--min-touch-target);
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

  .slider-value {
    min-width: 54px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .pattern-card,
    .brightness-btn,
    .color-mode-btn {
      transition: none;
    }
  }
</style>
