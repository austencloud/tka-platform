<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="motion-controls">
      <!-- Color mode chip row -->
      <div class="option-row">
        <span class="option-label">Color</span>
        <div class="chip-group" role="radiogroup" aria-label="Motion color mode">
          <button
            class="chip"
            class:active={state.motion.colorMode === "solid"}
            type="button"
            role="radio"
            aria-checked={state.motion.colorMode === "solid"}
            onclick={() => state.updateMotion({ colorMode: "solid" })}
          >
            Solid
          </button>
          <button
            class="chip"
            class:active={state.motion.colorMode === "rainbow"}
            type="button"
            role="radio"
            aria-checked={state.motion.colorMode === "rainbow"}
            onclick={() => state.updateMotion({ colorMode: "rainbow" })}
          >
            Rainbow
          </button>
          <button
            class="chip"
            class:active={state.motion.colorMode === "velocity"}
            type="button"
            role="radio"
            aria-checked={state.motion.colorMode === "velocity"}
            onclick={() => state.updateMotion({ colorMode: "velocity" })}
          >
            Velocity
          </button>
          <button
            class="chip"
            class:active={state.motion.colorMode === "prop-matched"}
            type="button"
            role="radio"
            aria-checked={state.motion.colorMode === "prop-matched"}
            onclick={() => state.updateMotion({ colorMode: "prop-matched" })}
          >
            Prop-Matched
          </button>
        </div>
      </div>

      {#if state.motion.colorMode === "solid"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.motion.color}
                oninput={(e) => state.updateMotion({ color: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
          </div>
        </div>
      {/if}

      <!-- Blur -->
      <div class="slider-row">
        <label for="motion-blur">Blur</label>
        <input
          id="motion-blur"
          type="range" min="0" max="1" step="0.05"
          value={state.motion.blur}
          oninput={(e) => state.updateMotion({ blur: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.motion.blur * 100)}%</span>
      </div>

      <!-- Speed Lines -->
      <div class="slider-row">
        <label for="motion-speed-lines">Speed Lines</label>
        <input
          id="motion-speed-lines"
          type="range" min="0" max="1" step="0.05"
          value={state.motion.speedLines}
          oninput={(e) => state.updateMotion({ speedLines: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.motion.speedLines * 100)}%</span>
      </div>

      <!-- Threshold -->
      <div class="slider-row">
        <label for="motion-threshold">Threshold</label>
        <input
          id="motion-threshold"
          type="range" min="0" max="1" step="0.05"
          value={state.motion.threshold}
          oninput={(e) => state.updateMotion({ threshold: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.motion.threshold * 100)}%</span>
      </div>

      <!-- Length -->
      <div class="slider-row">
        <label for="motion-length">Length</label>
        <input
          id="motion-length"
          type="range" min="0" max="1" step="0.05"
          value={state.motion.length}
          oninput={(e) => state.updateMotion({ length: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.motion.length * 100)}%</span>
      </div>

      <!-- Count -->
      <div class="slider-row">
        <label for="motion-count">Count</label>
        <input
          id="motion-count"
          type="range" min="3" max="12" step="1"
          value={state.motion.count}
          oninput={(e) => state.updateMotion({ count: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.motion.count}</span>
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

  .motion-controls {
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
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 8px;
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
    min-width: 40px;
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

  .color-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
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
