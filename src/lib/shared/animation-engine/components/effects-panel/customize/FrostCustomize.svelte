<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { FrostIntent } from "$lib/shared/effects/domain/EffectsConfig";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  const PALETTES: { id: FrostIntent["palette"]; label: string; swatch: string }[] = [
    { id: "glacial", label: "Glacial", swatch: "#a0d8ff" },
    { id: "breath", label: "Breath", swatch: "#d0e8f0" },
    { id: "black_ice", label: "Black Ice", swatch: "#202830" },
    { id: "aurora", label: "Aurora", swatch: "#60ff80" },
    { id: "diamond", label: "Diamond", swatch: "#e8e8f0" },
    { id: "cursed", label: "Cursed", swatch: "#4020a0" },
    { id: "custom", label: "Custom", swatch: "#ffffff" },
  ];

  const TRACKING: { id: FrostIntent["trackingMode"]; label: string }[] = [
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
    <div class="frost-controls">
      <div class="option-row">
        <span class="option-label">Palette</span>
        <div class="chip-group" role="radiogroup" aria-label="Frost palette">
          {#each PALETTES as p (p.id)}
            <button
              class="chip swatch-chip"
              class:active={state.frost.palette === p.id}
              type="button"
              role="radio"
              aria-checked={state.frost.palette === p.id}
              onclick={() => state.updateEffect("frost", { palette: p.id })}
            >
              <span class="swatch" style="background: {p.swatch}" aria-hidden="true"></span>
              {p.label}
            </button>
          {/each}
        </div>
      </div>

      {#if state.frost.palette === "custom"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.frost.customColor}
                oninput={(e) =>
                  state.updateEffect("frost", {
                    customColor: (e.currentTarget as HTMLInputElement).value,
                  })}
              />
            </label>
          </div>
        </div>
      {/if}

      <div class="option-row">
        <span class="option-label">Tracking</span>
        <div class="chip-group" role="radiogroup" aria-label="Frost tracking mode">
          {#each TRACKING as t (t.id)}
            <button
              class="chip"
              class:active={state.frost.trackingMode === t.id}
              type="button"
              role="radio"
              aria-checked={state.frost.trackingMode === t.id}
              onclick={() => state.updateEffect("frost", { trackingMode: t.id })}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="slider-row">
        <label for="frost-ambient">Ambient</label>
        <input
          id="frost-ambient"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.frost.ambientEmission}
          oninput={(e) =>
            state.updateEffect("frost", {
              ambientEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.frost.ambientEmission * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="frost-motion">Motion</label>
        <input
          id="frost-motion"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.frost.motionEmission}
          oninput={(e) =>
            state.updateEffect("frost", {
              motionEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.frost.motionEmission * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="frost-intensity">Intensity</label>
        <input
          id="frost-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.frost.intensity}
          oninput={(e) =>
            state.updateEffect("frost", {
              intensity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.frost.intensity * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="frost-crystallinity">Snowflake Size</label>
        <input
          id="frost-crystallinity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.frost.crystallinity}
          oninput={(e) =>
            state.updateEffect("frost", {
              crystallinity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.frost.crystallinity * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="frost-spread">Trail Length</label>
        <input
          id="frost-spread"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.frost.spreadRate}
          oninput={(e) =>
            state.updateEffect("frost", {
              spreadRate: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.frost.spreadRate * 100)}%</span>
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

  .frost-controls {
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
