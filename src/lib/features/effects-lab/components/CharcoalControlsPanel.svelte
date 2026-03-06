<!--
  CharcoalControlsPanel.svelte

  Parameter sliders for charcoal spark tuning.
  Groups: Emission, Physics, Appearance, Pool.
-->
<script lang="ts">
  import type { CharcoalSparkParams } from "$lib/shared/animation-engine/domain/types/CharcoalSparkTypes";
  import { CHARCOAL_SLIDER_GROUPS } from "$lib/shared/animation-engine/domain/types/CharcoalSparkTypes";

  interface Props {
    params: CharcoalSparkParams;
    onParamChange: (key: keyof CharcoalSparkParams, value: number | boolean) => void;
    onReset: () => void;
  }

  let { params, onParamChange, onReset }: Props = $props();
</script>

<div class="charcoal-controls">
  <div class="header-row">
    <h3>
      <i class="fas fa-meteor" aria-hidden="true"></i>
      Charcoal Sparks
    </h3>
    <button
      class="reset-btn"
      onclick={onReset}
      type="button"
      aria-label="Reset charcoal parameters to defaults"
    >
      Reset
    </button>
  </div>

  {#each CHARCOAL_SLIDER_GROUPS as group}
    <div class="slider-group">
      <span class="group-label">{group.label}</span>
      {#each group.sliders as slider}
        {@const value = params[slider.key] as number}
        <div class="slider-row">
          <label for="charcoal-{slider.key}">{slider.label}</label>
          <input
            id="charcoal-{slider.key}"
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            {value}
            oninput={(e) => onParamChange(slider.key, Number(e.currentTarget.value))}
            aria-label="{slider.label}"
          />
          <span class="slider-value">
            {slider.format ? slider.format(value) : Math.round(value)}
          </span>
        </div>
      {/each}
    </div>
  {/each}

  <!-- Shrink toggle -->
  <div class="toggle-row">
    <span>Shrink over life</span>
    <button
      class="toggle-btn"
      class:active={params.shrinkOverLife}
      onclick={() => onParamChange("shrinkOverLife", !params.shrinkOverLife)}
      aria-label={params.shrinkOverLife ? "Disable shrink" : "Enable shrink"}
      type="button"
    >
      {params.shrinkOverLife ? "ON" : "OFF"}
    </button>
  </div>
</div>

<style>
  .charcoal-controls {
    --charcoal-amber: #f59e0b;
    --charcoal-amber-bright: #fbbf24;
    --charcoal-amber-dim: rgba(245, 158, 11, 0.08);
    --charcoal-amber-border: rgba(245, 158, 11, 0.3);
    --charcoal-amber-border-strong: rgba(245, 158, 11, 0.5);

    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--charcoal-amber-dim);
    border-radius: var(--border-radius-lg, 12px);
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm, 8px);
  }

  h3 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  h3 i {
    color: var(--charcoal-amber);
  }

  .reset-btn {
    min-height: var(--min-touch-target);
    padding: 8px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .reset-btn:hover {
    border-color: var(--charcoal-amber-border);
    color: var(--charcoal-amber);
  }

  .reset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: var(--spacing-sm, 8px);
    padding-top: var(--spacing-sm, 8px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin-bottom: 2px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    min-height: var(--min-touch-target);
  }

  .slider-row label {
    min-width: 110px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--charcoal-amber);
  }

  .slider-value {
    min-width: 44px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--spacing-sm, 8px);
    padding-top: var(--spacing-sm, 8px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .toggle-btn {
    min-height: var(--min-touch-target);
    padding: 8px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9999px;
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    min-width: var(--min-touch-target);
  }

  .toggle-btn.active {
    background: var(--charcoal-amber-dim);
    border-color: var(--charcoal-amber-border-strong);
    color: var(--charcoal-amber-bright);
  }

  .toggle-btn:hover {
    border-color: color-mix(in srgb, var(--theme-text) 30%, transparent);
  }

  .toggle-btn.active:hover {
    border-color: color-mix(in srgb, var(--charcoal-amber) 70%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .reset-btn,
    .toggle-btn {
      transition: none;
    }
  }
</style>
