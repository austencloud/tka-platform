<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  // Palette swatch row is fixed at 5 entries for v1; add/remove deferred per spec.
  function paletteAt(i: number): string {
    if (!state) return "#ffffff";
    return state.sparkles.palette[i] ?? "#ffffff";
  }
  function setPaletteAt(i: number, value: string) {
    if (!state) return;
    const next = [...state.sparkles.palette];
    while (next.length <= i) next.push("#ffffff");
    next[i] = value;
    state.updateEffect("sparkles", { palette: next });
  }
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="sparkles-controls">
      <!-- Mode chip row -->
      <div class="option-row">
        <span class="option-label">Mode</span>
        <div class="chip-group" role="radiogroup" aria-label="Sparkle mode">
          <button
            class="chip"
            class:active={state.sparkles.mode === "burst"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.mode === "burst"}
            onclick={() => state.updateEffect("sparkles", { mode: "burst" })}
          >
            <i class="fas fa-bolt" aria-hidden="true"></i>
            Burst
          </button>
          <button
            class="chip"
            class:active={state.sparkles.mode === "stream"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.mode === "stream"}
            onclick={() => state.updateEffect("sparkles", { mode: "stream" })}
          >
            <i class="fas fa-water" aria-hidden="true"></i>
            Stream
          </button>
          <button
            class="chip"
            class:active={state.sparkles.mode === "trail"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.mode === "trail"}
            onclick={() => state.updateEffect("sparkles", { mode: "trail" })}
          >
            <i class="fas fa-route" aria-hidden="true"></i>
            Trail
          </button>
        </div>
      </div>

      <!-- Color mode chip row -->
      <div class="option-row">
        <span class="option-label">Color</span>
        <div class="chip-group" role="radiogroup" aria-label="Sparkle color mode">
          <button
            class="chip"
            class:active={state.sparkles.colorMode === "solid"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.colorMode === "solid"}
            onclick={() => state.updateEffect("sparkles", { colorMode: "solid" })}
          >
            Solid
          </button>
          <button
            class="chip"
            class:active={state.sparkles.colorMode === "rainbow"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.colorMode === "rainbow"}
            onclick={() => state.updateEffect("sparkles", { colorMode: "rainbow" })}
          >
            Rainbow
          </button>
          <button
            class="chip"
            class:active={state.sparkles.colorMode === "palette"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.colorMode === "palette"}
            onclick={() => state.updateEffect("sparkles", { colorMode: "palette" })}
          >
            Palette
          </button>
        </div>
      </div>

      {#if state.sparkles.colorMode === "solid"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.sparkles.color}
                oninput={(e) => state.updateEffect("sparkles", { color: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
          </div>
        </div>
      {:else if state.sparkles.colorMode === "palette"}
        <div class="color-row">
          <span class="color-label">Palette</span>
          <div class="color-pickers">
            {#each [0, 1, 2, 3, 4] as i (i)}
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

      <!-- Rate -->
      <div class="slider-row">
        <label for="sparkles-rate">Rate</label>
        <input
          id="sparkles-rate"
          type="range" min="0" max="1" step="0.05"
          value={state.sparkles.rate}
          oninput={(e) => state.updateEffect("sparkles", { rate: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.sparkles.rate * 100)}%</span>
      </div>

      <!-- Size -->
      <div class="slider-row">
        <label for="sparkles-size">Size</label>
        <input
          id="sparkles-size"
          type="range" min="0" max="1" step="0.05"
          value={state.sparkles.size}
          oninput={(e) => state.updateEffect("sparkles", { size: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.sparkles.size * 100)}%</span>
      </div>

      <!-- Lifetime -->
      <div class="slider-row">
        <label for="sparkles-lifetime">Lifetime</label>
        <input
          id="sparkles-lifetime"
          type="range" min="0.1" max="3" step="0.1"
          value={state.sparkles.lifetime}
          oninput={(e) => state.updateEffect("sparkles", { lifetime: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.sparkles.lifetime.toFixed(1)}s</span>
      </div>

      <!-- Spread -->
      <div class="slider-row">
        <label for="sparkles-spread">Spread</label>
        <input
          id="sparkles-spread"
          type="range" min="0" max="30" step="1"
          value={state.sparkles.spread}
          oninput={(e) => state.updateEffect("sparkles", { spread: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.sparkles.spread}px</span>
      </div>

      <!-- Gravity -->
      <div class="slider-row">
        <label for="sparkles-gravity">Gravity</label>
        <input
          id="sparkles-gravity"
          type="range" min="0" max="1" step="0.05"
          value={state.sparkles.gravity}
          oninput={(e) => state.updateEffect("sparkles", { gravity: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.sparkles.gravity * 100)}%</span>
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

  .sparkles-controls {
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
    font-size: 14px;
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
