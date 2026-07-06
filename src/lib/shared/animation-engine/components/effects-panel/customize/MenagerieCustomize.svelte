<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { MenagerieIntent } from "$lib/shared/effects/domain/effects-config";
  import OptionChipRow from "../OptionChipRow.svelte";
  import AdvancedControls from "$lib/shared/effects/components/AdvancedControls.svelte";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  const PALETTES: { value: MenagerieIntent["palette"]; label: string; swatch: string }[] = [
    { value: "satin", label: "Satin", swatch: "#c0c0d0" },
    { value: "velvet", label: "Velvet", swatch: "#600018" },
    { value: "ethereal", label: "Ethereal", swatch: "#c080ff" },
    { value: "shadow", label: "Shadow", swatch: "#101020" },
    { value: "gold_leaf", label: "Gold Leaf", swatch: "#ffd700" },
    { value: "ember", label: "Ember", swatch: "#ff6000" },
    { value: "custom", label: "Custom", swatch: "#ffffff" },
  ];

  const CREATURES: { value: MenagerieIntent["creature"]; label: string }[] = [
    { value: "snake", label: "Snake" },
    { value: "dragon", label: "Dragon" },
    { value: "caterpillar", label: "Caterpillar" },
  ];

  const TRACKING: { value: MenagerieIntent["trackingMode"]; label: string }[] = [
    { value: "left_end", label: "Left" },
    { value: "right_end", label: "Right" },
    { value: "both_ends", label: "Both" },
  ];
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="menagerie-controls">
      <OptionChipRow
        label="Creature"
        ariaLabel="Animal creature"
        value={state.menagerie.creature}
        options={CREATURES}
        onChange={(v) => state.updateEffect("menagerie", { creature: v })}
      />

      <OptionChipRow
        label="Palette"
        ariaLabel="Animal palette"
        value={state.menagerie.palette}
        options={PALETTES}
        onChange={(v) => state.updateEffect("menagerie", { palette: v })}
      />

      {#if state.menagerie.palette === "custom"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.menagerie.customColor}
                oninput={(e) =>
                  state.updateEffect("menagerie", {
                    customColor: (e.currentTarget as HTMLInputElement).value,
                  })}
              />
            </label>
          </div>
        </div>
      {/if}

      <OptionChipRow
        label="Tracking"
        ariaLabel="Animal tracking mode"
        value={state.menagerie.trackingMode}
        options={TRACKING}
        onChange={(v) => state.updateEffect("menagerie", { trackingMode: v })}
      />

      <div class="slider-row">
        <label for="menagerie-intensity">Intensity</label>
        <input
          id="menagerie-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.menagerie.intensity}
          oninput={(e) =>
            state.updateEffect("menagerie", {
              intensity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.menagerie.intensity * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="menagerie-width">Width</label>
        <input
          id="menagerie-width"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.menagerie.width}
          oninput={(e) =>
            state.updateEffect("menagerie", {
              width: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.menagerie.width * 100)}%</span>
      </div>

      <AdvancedControls count={2}>
        <div class="slider-row">
          <label for="menagerie-length">Length</label>
          <input
            id="menagerie-length"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.menagerie.bodyLength}
            oninput={(e) =>
              state.updateEffect("menagerie", {
                bodyLength: +(e.currentTarget as HTMLInputElement).value,
              })}
          />
          <span class="slider-value">{Math.round(state.menagerie.bodyLength * 100)}%</span>
        </div>

        <div class="slider-row">
          <label for="menagerie-slither">Slither</label>
          <input
            id="menagerie-slither"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.menagerie.slither}
            oninput={(e) =>
              state.updateEffect("menagerie", {
                slither: +(e.currentTarget as HTMLInputElement).value,
              })}
          />
          <span class="slider-value">{Math.round(state.menagerie.slither * 100)}%</span>
        </div>
      </AdvancedControls>
    </div>
  {:else}
    <p class="empty">Effect state unavailable.</p>
  {/if}
</div>

<style>
  .customize-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    min-height: 44px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .back-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .back-btn i {
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-btn {
      transition: none;
    }
  }

  .menagerie-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .slider-row label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .slider-value {
    min-width: 48px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .color-label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .color-pickers {
    display: flex;
    gap: 8px;
    flex: 1;
    flex-wrap: wrap;
  }

  .color-picker input[type="color"] {
    -webkit-appearance: none;
    appearance: none;
    width: 32px;
    height: 32px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 50%;
    background: none;
    cursor: pointer;
    padding: 0;
  }

  .color-picker input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-picker input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .color-picker input[type="color"]::-moz-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .empty {
    opacity: 0.6;
    font-size: var(--font-size-min, 14px);
    padding: 4px 0;
  }
</style>
