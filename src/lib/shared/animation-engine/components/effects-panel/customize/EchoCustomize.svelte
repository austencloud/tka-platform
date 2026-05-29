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
    <div class="echo-controls">
      <!-- Shape chip row -->
      <div class="option-row">
        <span class="option-label">Shape</span>
        <div class="chip-group" role="radiogroup" aria-label="Echo shape">
          <button
            class="chip"
            class:active={state.echo.shape === "staff"}
            type="button"
            role="radio"
            aria-checked={state.echo.shape === "staff"}
            onclick={() => state.updateEffect("echo", { shape: "staff" })}
          >
            <i class="fas fa-ruler" aria-hidden="true"></i>
            Staff
          </button>
          <button
            class="chip"
            class:active={state.echo.shape === "tips"}
            type="button"
            role="radio"
            aria-checked={state.echo.shape === "tips"}
            onclick={() => state.updateEffect("echo", { shape: "tips" })}
          >
            <i class="fas fa-circle" aria-hidden="true"></i>
            Tips
          </button>
          <button
            class="chip"
            class:active={state.echo.shape === "both"}
            type="button"
            role="radio"
            aria-checked={state.echo.shape === "both"}
            onclick={() => state.updateEffect("echo", { shape: "both" })}
          >
            <i class="fas fa-layer-group" aria-hidden="true"></i>
            Both
          </button>
        </div>
      </div>

      <!-- Color mode chip row -->
      <div class="option-row">
        <span class="option-label">Color</span>
        <div class="chip-group" role="radiogroup" aria-label="Echo color mode">
          <button
            class="chip"
            class:active={state.echo.colorMode === "solid"}
            type="button"
            role="radio"
            aria-checked={state.echo.colorMode === "solid"}
            onclick={() => state.updateEffect("echo", { colorMode: "solid" })}
          >
            Solid
          </button>
          <button
            class="chip"
            class:active={state.echo.colorMode === "rainbow"}
            type="button"
            role="radio"
            aria-checked={state.echo.colorMode === "rainbow"}
            onclick={() => state.updateEffect("echo", { colorMode: "rainbow" })}
          >
            Rainbow
          </button>
          <button
            class="chip"
            class:active={state.echo.colorMode === "prop-matched"}
            type="button"
            role="radio"
            aria-checked={state.echo.colorMode === "prop-matched"}
            onclick={() => state.updateEffect("echo", { colorMode: "prop-matched" })}
          >
            Prop-Matched
          </button>
          <button
            class="chip"
            class:active={state.echo.colorMode === "gradient"}
            type="button"
            role="radio"
            aria-checked={state.echo.colorMode === "gradient"}
            onclick={() => state.updateEffect("echo", { colorMode: "gradient" })}
          >
            Gradient
          </button>
        </div>
      </div>

      {#if state.echo.colorMode === "solid"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.echo.color}
                oninput={(e) =>
                  state.updateEffect("echo", { color: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
          </div>
        </div>
      {/if}

      <!-- Intensity -->
      <div class="slider-row">
        <label for="echo-intensity">Intensity</label>
        <input
          id="echo-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.echo.intensity}
          oninput={(e) =>
            state.updateEffect("echo", { intensity: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.echo.intensity * 100)}%</span>
      </div>

      <!-- Decay (beats) -->
      <div class="slider-row">
        <label for="echo-decay">Decay</label>
        <input
          id="echo-decay"
          type="range"
          min="1"
          max="8"
          step="0.5"
          value={state.echo.decay}
          oninput={(e) =>
            state.updateEffect("echo", { decay: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.echo.decay}b</span>
      </div>

      <!-- Interval (beats) -->
      <div class="slider-row">
        <label for="echo-interval">Interval</label>
        <input
          id="echo-interval"
          type="range"
          min="0.25"
          max="2"
          step="0.25"
          value={state.echo.interval}
          oninput={(e) =>
            state.updateEffect("echo", { interval: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.echo.interval}b</span>
      </div>

      <!-- Thickness -->
      <div class="slider-row">
        <label for="echo-thickness">Thickness</label>
        <input
          id="echo-thickness"
          type="range"
          min="1"
          max="8"
          step="1"
          value={state.echo.thickness}
          oninput={(e) =>
            state.updateEffect("echo", { thickness: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.echo.thickness}px</span>
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

  .echo-controls {
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

  .chip i {
    font-size: 11px;
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
