<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { SmokeIntent } from "$lib/shared/effects/domain/effects-config";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  // Palette swatches mirror the palette registry's core color so the
  // chip reads identity at a glance. No lifetime slider: lifetime is
  // palette-owned (genie is short, fog is long - that's what makes them
  // those things). Spec §"Intent shape".
  const PALETTES: { id: SmokeIntent["palette"]; label: string; swatch: string }[] = [
    { id: "incense", label: "Incense", swatch: "#d8d8d8" },
    { id: "fog", label: "Fog", swatch: "#c0c0c8" },
    { id: "genie", label: "Genie", swatch: "#a060ff" },
    { id: "cursed", label: "Cursed", swatch: "#202020" },
    { id: "spirit", label: "Spirit", swatch: "#80c8ff" },
    { id: "campfire", label: "Campfire", swatch: "#805040" },
    { id: "custom", label: "Custom", swatch: "#ffffff" },
  ];

  const TRACKING: { id: SmokeIntent["trackingMode"]; label: string }[] = [
    { id: "left_end", label: "Left" },
    { id: "right_end", label: "Right" },
    { id: "both_ends", label: "Both" },
  ];
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="smoke-controls">
      <!-- Palette chip row (7 items) -->
      <div class="option-row">
        <span class="option-label">Palette</span>
        <div class="chip-group" role="radiogroup" aria-label="Smoke palette">
          {#each PALETTES as p (p.id)}
            <button
              class="chip swatch-chip"
              class:active={state.smoke.palette === p.id}
              type="button"
              role="radio"
              aria-checked={state.smoke.palette === p.id}
              onclick={() => state.updateEffect("smoke", { palette: p.id })}
            >
              <span class="swatch" style="background: {p.swatch}" aria-hidden="true"></span>
              {p.label}
            </button>
          {/each}
        </div>
      </div>

      {#if state.smoke.palette === "custom"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.smoke.customColor}
                oninput={(e) =>
                  state.updateEffect("smoke", {
                    customColor: (e.currentTarget as HTMLInputElement).value,
                  })}
              />
            </label>
          </div>
        </div>
      {/if}

      <!-- Tracking chip row -->
      <div class="option-row">
        <span class="option-label">Tracking</span>
        <div class="chip-group" role="radiogroup" aria-label="Smoke tracking mode">
          {#each TRACKING as t (t.id)}
            <button
              class="chip"
              class:active={state.smoke.trackingMode === t.id}
              type="button"
              role="radio"
              aria-checked={state.smoke.trackingMode === t.id}
              onclick={() => state.updateEffect("smoke", { trackingMode: t.id })}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Ambient emission -->
      <div class="slider-row">
        <label for="smoke-ambient">Ambient</label>
        <input
          id="smoke-ambient"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.smoke.ambientEmission}
          oninput={(e) =>
            state.updateEffect("smoke", {
              ambientEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.smoke.ambientEmission * 100)}%</span>
      </div>

      <!-- Motion emission -->
      <div class="slider-row">
        <label for="smoke-motion">Motion</label>
        <input
          id="smoke-motion"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.smoke.motionEmission}
          oninput={(e) =>
            state.updateEffect("smoke", {
              motionEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.smoke.motionEmission * 100)}%</span>
      </div>

      <!-- Intensity (size + opacity) -->
      <div class="slider-row">
        <label for="smoke-intensity">Intensity</label>
        <input
          id="smoke-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.smoke.intensity}
          oninput={(e) =>
            state.updateEffect("smoke", {
              intensity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.smoke.intensity * 100)}%</span>
      </div>

      <!-- Curl strength (multiplier on palette.curlBias) -->
      <div class="slider-row">
        <label for="smoke-curl">Curl</label>
        <input
          id="smoke-curl"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.smoke.curlStrength}
          oninput={(e) =>
            state.updateEffect("smoke", {
              curlStrength: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.smoke.curlStrength * 100)}%</span>
      </div>

      <!-- Rise speed (multiplier on palette.riseBias) -->
      <div class="slider-row">
        <label for="smoke-rise">Rise</label>
        <input
          id="smoke-rise"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.smoke.riseSpeed}
          oninput={(e) =>
            state.updateEffect("smoke", {
              riseSpeed: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.smoke.riseSpeed * 100)}%</span>
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
    .back-btn,
    .chip {
      transition: none;
    }
  }

  .smoke-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .option-label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
  }

  .chip {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .swatch-chip {
    flex: 1 1 40%;
  }

  .swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
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
