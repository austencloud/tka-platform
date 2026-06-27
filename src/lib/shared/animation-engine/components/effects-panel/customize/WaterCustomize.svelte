<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { WaterIntent } from "$lib/shared/effects/domain/effects-config";
  import OptionChipRow from "../OptionChipRow.svelte";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  const PALETTES: { value: WaterIntent["palette"]; label: string; swatch: string }[] = [
    { value: "classic", label: "Classic", swatch: "#3a7fd9" },
    { value: "mercury", label: "Mercury", swatch: "#9a9fa8" },
    { value: "acid", label: "Acid", swatch: "#7fd94a" },
    { value: "blood", label: "Ritual", swatch: "#8a1818" },
    { value: "spirit", label: "Spirit", swatch: "#80ffe8" },
    { value: "custom", label: "Custom", swatch: "#ffffff" },
  ];

  const TRACKING: { value: WaterIntent["trackingMode"]; label: string }[] = [
    { value: "left_end", label: "Left" },
    { value: "right_end", label: "Right" },
    { value: "both_ends", label: "Both" },
  ];

  const STYLES: { value: WaterIntent["spewStyle"]; label: string; icon: string }[] = [
    { value: "splash", label: "Splash", icon: "fa-droplet" },
    { value: "flow", label: "Flow", icon: "fa-wave-square" },
    { value: "mist", label: "Mist", icon: "fa-cloud" },
  ];
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="water-controls">
      <OptionChipRow label="Palette" ariaLabel="Water palette" value={state.water.palette} options={PALETTES} onChange={(v) => state.updateEffect("water", { palette: v })} />

      {#if state.water.palette === "custom"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.water.customColor}
                oninput={(e) =>
                  state.updateEffect("water", {
                    customColor: (e.currentTarget as HTMLInputElement).value,
                  })}
              />
            </label>
          </div>
        </div>
      {/if}

      <OptionChipRow label="Style" ariaLabel="Water spew style" value={state.water.spewStyle} options={STYLES} onChange={(v) => state.updateEffect("water", { spewStyle: v })} />

      <OptionChipRow label="Tracking" ariaLabel="Water tracking mode" value={state.water.trackingMode} options={TRACKING} onChange={(v) => state.updateEffect("water", { trackingMode: v })} />

      <!-- Ambient emission -->
      <div class="slider-row">
        <label for="water-ambient">Drip</label>
        <input
          id="water-ambient"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.water.ambientEmission}
          oninput={(e) =>
            state.updateEffect("water", {
              ambientEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.water.ambientEmission * 100)}%</span>
      </div>

      <!-- Motion emission -->
      <div class="slider-row">
        <label for="water-motion">Motion</label>
        <input
          id="water-motion"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.water.motionEmission}
          oninput={(e) =>
            state.updateEffect("water", {
              motionEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.water.motionEmission * 100)}%</span>
      </div>

      <!-- Intensity -->
      <div class="slider-row">
        <label for="water-intensity">Intensity</label>
        <input
          id="water-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.water.intensity}
          oninput={(e) =>
            state.updateEffect("water", {
              intensity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.water.intensity * 100)}%</span>
      </div>

      <!-- Clarity -->
      <div class="slider-row">
        <label for="water-clarity">Clarity</label>
        <input
          id="water-clarity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.water.clarity}
          oninput={(e) =>
            state.updateEffect("water", {
              clarity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.water.clarity * 100)}%</span>
      </div>

      <!-- Surface tension (inactive until 1f.iii metaballs ship) -->
      <div class="slider-row">
        <label for="water-tension">Tension</label>
        <input
          id="water-tension"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.water.surfaceTension}
          oninput={(e) =>
            state.updateEffect("water", {
              surfaceTension: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.water.surfaceTension * 100)}%</span>
      </div>
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

  .water-controls {
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
