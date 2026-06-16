<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { BUILT_IN_COLOR_PRESETS, type LedColorPreset } from "../../domain/types/led-color-presets";
  import {
    CATEGORY_LABELS,
    type PatternCategory,
    getPatternsByCategory,
    getPatternDescriptor,
  } from "../../domain/patterns/registry";

  const effectsConfig = getEffectsConfigContext();

  let patternPickerOpen = $state(false);
  let colorInputRef: HTMLInputElement | null = $state(null);

  const activePatternId = $derived(effectsConfig?.led.patternId ?? "solid");
  const brightness = $derived(effectsConfig?.led.brightness ?? 3);
  const patternSpeed = $derived(effectsConfig?.led.patternSpeed ?? 1.0);
  const primaryColor = $derived(effectsConfig?.led.primaryColor ?? "#00ff88");
  const activePresetId = $derived(effectsConfig?.activePresets.led ?? null);

  const activeDescriptor = $derived(getPatternDescriptor(activePatternId));
  const allPresets = $derived([...BUILT_IN_COLOR_PRESETS]);
  const categories = Object.keys(CATEGORY_LABELS) as PatternCategory[];

  function selectPreset(preset: LedColorPreset) {
    effectsConfig?.updateEffect("led", { primaryColor: preset.primaryColor });
  }

  function selectPattern(id: string) {
    effectsConfig?.updateEffect("led", { patternId: id });
    patternPickerOpen = false;
  }

  function addCustomColor(e: Event) {
    const color = (e.target as HTMLInputElement).value;
    effectsConfig?.updateEffect("led", { primaryColor: color });
  }
</script>

<div class="led-section">
  <div class="color-row">
    {#each allPresets as preset (preset.id)}
      <button
        type="button"
        class="swatch"
        class:active={activePresetId === preset.id}
        style:background={preset.primaryColor}
        title={preset.name}
        aria-label={preset.name}
        onclick={() => selectPreset(preset)}
      ></button>
    {/each}
    <button type="button" class="swatch add-swatch" title="Custom color" aria-label="Custom color" onclick={() => colorInputRef?.click()}>+</button>
    <input
      bind:this={colorInputRef}
      type="color"
      value={primaryColor}
      class="hidden-input"
      onchange={addCustomColor}
    />
  </div>

  <button type="button" class="pattern-selector" onclick={() => patternPickerOpen = !patternPickerOpen}>
    <span class="pattern-current">{activeDescriptor?.name ?? "Solid"}</span>
    <span class="pattern-category">{activeDescriptor ? CATEGORY_LABELS[activeDescriptor.category] : ""}</span>
    <span class="selector-chevron" class:open={patternPickerOpen}>
      <i class="fas fa-chevron-down" aria-hidden="true"></i>
    </span>
  </button>

  {#if patternPickerOpen}
    <div class="pattern-picker">
      {#each categories as category}
        {@const patterns = getPatternsByCategory(category)}
        <div class="picker-category-label">{CATEGORY_LABELS[category]}</div>
        <div class="picker-row">
          {#each patterns as pattern (pattern.id)}
            <button
              type="button"
              class="picker-btn"
              class:active={activePatternId === pattern.id}
              onclick={() => selectPattern(pattern.id)}
            >
              {pattern.name}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <div class="speed-row">
    <input
      type="range"
      class="speed-slider"
      min="0.1"
      max="5.0"
      step="0.1"
      value={patternSpeed}
      oninput={(e) => effectsConfig?.updateEffect("led", { patternSpeed: parseFloat((e.target as HTMLInputElement).value) })}
      aria-label="Pattern speed"
    />
    <span class="speed-label">{patternSpeed.toFixed(1)}x</span>
    {#each [1, 2, 3, 4, 5] as level}
      <button
        type="button"
        class="bright-btn"
        class:active={brightness === level}
        onclick={() => effectsConfig?.updateEffect("led", { brightness: level })}
        aria-label="Brightness {level}"
      >
        {level}
      </button>
    {/each}
  </div>
</div>

<style>
  .led-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .color-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }

  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 100ms ease;
    padding: 0;
    flex-shrink: 0;
  }

  .swatch:hover {
    transform: scale(1.1);
  }

  .swatch.active {
    border-color: white;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
  }

  .add-swatch {
    background: transparent;
    border: 2px dashed rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hidden-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .pattern-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    min-height: 32px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    cursor: pointer;
    transition: border-color 100ms ease;
  }

  .pattern-selector:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .pattern-current {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .pattern-category {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    margin-left: auto;
  }

  .selector-chevron {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    transition: transform 150ms ease;
  }

  .selector-chevron.open {
    transform: rotate(180deg);
  }

  .pattern-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .picker-category-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    padding: 4px 0 2px;
  }

  .picker-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .picker-btn {
    padding: 5px 10px;
    min-height: 30px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 100ms ease;
  }

  .picker-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, white);
  }

  .picker-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .speed-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .speed-slider {
    flex: 1;
    min-width: 0;
    -webkit-appearance: none;
    appearance: none;
    height: 3px;
    border-radius: 2px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    outline: none;
    cursor: pointer;
  }

  .speed-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--theme-accent, #8b5cf6);
    border: 2px solid var(--theme-card-bg, rgba(18, 18, 28, 0.98));
    cursor: pointer;
  }

  .speed-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--theme-accent, #8b5cf6);
    border: 2px solid var(--theme-card-bg, rgba(18, 18, 28, 0.98));
    cursor: pointer;
  }

  .speed-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    /* Widened from 26px so "5.0x" fits at the 12px floor without clipping */
    min-width: 32px;
    text-align: right;
    flex-shrink: 0;
  }

  .bright-btn {
    width: 22px;
    height: 22px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: all 100ms ease;
  }

  .bright-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, white);
  }

  .bright-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .swatch,
    .pattern-selector,
    .selector-chevron,
    .picker-btn,
    .bright-btn {
      transition: none;
    }
  }
</style>
