<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  // Palette row fixed at 5 entries for v1; add/remove deferred.
  function paletteAt(i: number): string {
    if (!state) return "#ffffff";
    return state.bloom.palette[i] ?? "#ffffff";
  }
  function setPaletteAt(i: number, value: string) {
    if (!state) return;
    const next = [...state.bloom.palette];
    while (next.length <= i) next.push("#ffffff");
    next[i] = value;
    state.updateEffect("bloom", { palette: next });
  }
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="bloom-controls">
      <!-- Color mode chip row -->
      <div class="option-row">
        <span class="option-label">Color</span>
        <div class="chip-group" role="radiogroup" aria-label="Bloom color mode">
          <button
            class="chip"
            class:active={state.bloom.colorMode === "solid"}
            type="button"
            role="radio"
            aria-checked={state.bloom.colorMode === "solid"}
            onclick={() => state.updateEffect("bloom", { colorMode: "solid" })}
          >
            Solid
          </button>
          <button
            class="chip"
            class:active={state.bloom.colorMode === "prop-matched"}
            type="button"
            role="radio"
            aria-checked={state.bloom.colorMode === "prop-matched"}
            onclick={() => state.updateEffect("bloom", { colorMode: "prop-matched" })}
          >
            Prop-Matched
          </button>
          <button
            class="chip"
            class:active={state.bloom.colorMode === "rainbow"}
            type="button"
            role="radio"
            aria-checked={state.bloom.colorMode === "rainbow"}
            onclick={() => state.updateEffect("bloom", { colorMode: "rainbow" })}
          >
            Rainbow
          </button>
          <button
            class="chip"
            class:active={state.bloom.colorMode === "palette"}
            type="button"
            role="radio"
            aria-checked={state.bloom.colorMode === "palette"}
            onclick={() => state.updateEffect("bloom", { colorMode: "palette" })}
          >
            Palette
          </button>
        </div>
      </div>

      <!-- Falloff chip row -->
      <div class="option-row">
        <span class="option-label">Falloff</span>
        <div class="chip-group" role="radiogroup" aria-label="Bloom falloff">
          <button
            class="chip"
            class:active={state.bloom.falloff === "smooth"}
            type="button"
            role="radio"
            aria-checked={state.bloom.falloff === "smooth"}
            onclick={() => state.updateEffect("bloom", { falloff: "smooth" })}
          >
            Smooth
          </button>
          <button
            class="chip"
            class:active={state.bloom.falloff === "sharp"}
            type="button"
            role="radio"
            aria-checked={state.bloom.falloff === "sharp"}
            onclick={() => state.updateEffect("bloom", { falloff: "sharp" })}
          >
            Sharp
          </button>
          <button
            class="chip"
            class:active={state.bloom.falloff === "ring"}
            type="button"
            role="radio"
            aria-checked={state.bloom.falloff === "ring"}
            onclick={() => state.updateEffect("bloom", { falloff: "ring" })}
          >
            Ring
          </button>
        </div>
      </div>

      {#if state.bloom.colorMode === "solid"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.bloom.color}
                oninput={(e) =>
                  state.updateEffect("bloom", { color: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
          </div>
        </div>
      {:else if state.bloom.colorMode === "palette"}
        <div class="color-row">
          <span class="color-label">Palette</span>
          <div class="color-pickers">
            {#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
              <label class="color-picker">
                <input
                  type="color"
                  value={paletteAt(i)}
                  oninput={(e) => setPaletteAt(i, (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Intensity -->
      <div class="slider-row">
        <label for="bloom-intensity">Intensity</label>
        <input
          id="bloom-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.bloom.intensity}
          oninput={(e) =>
            state.updateEffect("bloom", { intensity: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.bloom.intensity * 100)}%</span>
      </div>

      <!-- Radius -->
      <div class="slider-row">
        <label for="bloom-radius">Radius</label>
        <input
          id="bloom-radius"
          type="range"
          min="8"
          max="200"
          step="2"
          value={state.bloom.radius}
          oninput={(e) =>
            state.updateEffect("bloom", { radius: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.bloom.radius}px</span>
      </div>

      <!-- Pulse -->
      <div class="slider-row">
        <label for="bloom-pulse">Pulse</label>
        <input
          id="bloom-pulse"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.bloom.pulse}
          oninput={(e) =>
            state.updateEffect("bloom", { pulse: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.bloom.pulse * 100)}%</span>
      </div>

      <!-- Pulse Rate -->
      <div class="slider-row">
        <label for="bloom-pulse-rate">Rate</label>
        <input
          id="bloom-pulse-rate"
          type="range"
          min="0.25"
          max="4"
          step="0.25"
          value={state.bloom.pulseRate}
          oninput={(e) =>
            state.updateEffect("bloom", { pulseRate: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.bloom.pulseRate}Hz</span>
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

  .bloom-controls {
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
