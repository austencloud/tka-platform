<!--
  ConjoinedControls.svelte - Layout controls for Conjoined Lab

  Controls for:
  - Layout arrangement (left-right, top-bottom, diagonals)
  - Spacing between grids
  - Conjoined point visibility
-->
<script lang="ts">
  import type { ConjoinedLayout } from "../domain/types";
  import { LAYOUT_PRESETS } from "../domain/layout-presets";

  // Props
  let {
    layout,
    onLayoutChange,
    onSpacingChange,
  }: {
    layout: ConjoinedLayout;
    onLayoutChange?: (layout: ConjoinedLayout) => void;
    onSpacingChange?: (spacing: number) => void;
  } = $props();

  function handlePresetClick(preset: typeof LAYOUT_PRESETS[0]) {
    onLayoutChange?.(preset.layout);
  }

  function handleSpacingInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    onSpacingChange?.(value);
  }
</script>

<div class="conjoined-controls">
  <!-- Layout Presets -->
  <section class="control-section">
    <h3>Layout</h3>
    <div class="preset-grid">
      {#each LAYOUT_PRESETS as preset}
        <button
          class="preset-btn"
          class:active={layout.arrangement === preset.layout.arrangement}
          onclick={() => handlePresetClick(preset)}
          title={preset.name}
        >
          <i class="fas {preset.icon}" aria-hidden="true"></i>
          <span>{preset.name}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- Spacing Slider -->
  <section class="control-section">
    <h3>Spacing</h3>
    <div class="slider-row">
      <input
        type="range"
        min="0"
        max="200"
        value={layout.spacing}
        oninput={handleSpacingInput}
        class="spacing-slider"
        aria-label="Grid spacing"
      />
      <span class="spacing-value">{layout.spacing}px</span>
    </div>
  </section>

  <!-- Show Conjoined Point Toggle -->
  <section class="control-section">
    <h3>Options</h3>
    <label class="toggle-row">
      <input
        type="checkbox"
        checked={layout.showConjoinedPoint}
        onchange={() => onLayoutChange?.({ ...layout, showConjoinedPoint: !layout.showConjoinedPoint })}
      />
      <span>Show conjoined point</span>
    </label>
  </section>
</div>

<style>
  .conjoined-controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    min-width: 200px;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-section h3 {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .preset-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 8px;
    min-height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .preset-btn.active {
    background: var(--theme-accent, #10b981);
    border-color: var(--theme-accent, #10b981);
  }

  .preset-btn i {
    font-size: 16px;
  }

  .preset-btn span {
    font-size: var(--font-size-compact, 12px);
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .spacing-slider {
    flex: 1;
    height: 4px;
    appearance: none;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    cursor: pointer;
  }

  .spacing-slider::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    background: var(--theme-accent, #10b981);
    border-radius: 50%;
    cursor: pointer;
  }

  .spacing-value {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    min-width: 48px;
    text-align: right;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
    min-height: 48px;
  }

  .toggle-row input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--theme-accent, #10b981);
  }
</style>
