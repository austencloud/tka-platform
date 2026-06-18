<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { PetalsIntent } from "$lib/shared/effects/domain/effects-config";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  const PALETTES: { id: PetalsIntent["palette"]; label: string; swatch: string }[] = [
    { id: "blossom", label: "Blossom", swatch: "#ffc0d8" },
    { id: "autumn", label: "Autumn", swatch: "#d84820" },
    { id: "jungle", label: "Jungle", swatch: "#408840" },
    { id: "ash", label: "Ash", swatch: "#484848" },
    { id: "gold", label: "Gold", swatch: "#ffd060" },
    { id: "custom", label: "Custom", swatch: "#ffffff" },
  ];

  const TRACKING: { id: PetalsIntent["trackingMode"]; label: string }[] = [
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
    <div class="petals-controls">
      <!-- Palette chip row -->
      <div class="option-row">
        <span class="option-label">Palette</span>
        <div class="chip-group" role="radiogroup" aria-label="Petals palette">
          {#each PALETTES as p (p.id)}
            <button
              class="chip swatch-chip"
              class:active={state.petals.palette === p.id}
              type="button"
              role="radio"
              aria-checked={state.petals.palette === p.id}
              onclick={() => state.updateEffect("petals", { palette: p.id })}
            >
              <span class="swatch" style="background: {p.swatch}" aria-hidden="true"></span>
              {p.label}
            </button>
          {/each}
        </div>
      </div>

      {#if state.petals.palette === "custom"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.petals.customColor}
                oninput={(e) =>
                  state.updateEffect("petals", {
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
        <div class="chip-group" role="radiogroup" aria-label="Petals tracking mode">
          {#each TRACKING as t (t.id)}
            <button
              class="chip"
              class:active={state.petals.trackingMode === t.id}
              type="button"
              role="radio"
              aria-checked={state.petals.trackingMode === t.id}
              onclick={() => state.updateEffect("petals", { trackingMode: t.id })}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Ambient emission -->
      <div class="slider-row">
        <label for="petals-ambient">Drift</label>
        <input
          id="petals-ambient"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.petals.ambientEmission}
          oninput={(e) =>
            state.updateEffect("petals", {
              ambientEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.petals.ambientEmission * 100)}%</span>
      </div>

      <!-- Motion emission -->
      <div class="slider-row">
        <label for="petals-motion">Motion</label>
        <input
          id="petals-motion"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.petals.motionEmission}
          oninput={(e) =>
            state.updateEffect("petals", {
              motionEmission: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.petals.motionEmission * 100)}%</span>
      </div>

      <!-- Intensity (size) -->
      <div class="slider-row">
        <label for="petals-intensity">Size</label>
        <input
          id="petals-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.petals.intensity}
          oninput={(e) =>
            state.updateEffect("petals", {
              intensity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.petals.intensity * 100)}%</span>
      </div>

      <!-- Carry: how much of the prop's velocity a petal inherits -->
      <div class="slider-row">
        <label for="petals-carry">Carry</label>
        <input
          id="petals-carry"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.petals.carry}
          oninput={(e) =>
            state.updateEffect("petals", {
              carry: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.petals.carry * 100)}%</span>
      </div>

      <!-- Streak: how long the inherited motion lingers -->
      <div class="slider-row">
        <label for="petals-streak">Streak</label>
        <input
          id="petals-streak"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.petals.streakLength}
          oninput={(e) =>
            state.updateEffect("petals", {
              streakLength: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.petals.streakLength * 100)}%</span>
      </div>

      <!-- Fall speed -->
      <div class="slider-row">
        <label for="petals-fall">Fall</label>
        <input
          id="petals-fall"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.petals.fallSpeed}
          oninput={(e) =>
            state.updateEffect("petals", {
              fallSpeed: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.petals.fallSpeed * 100)}%</span>
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

  .petals-controls {
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
