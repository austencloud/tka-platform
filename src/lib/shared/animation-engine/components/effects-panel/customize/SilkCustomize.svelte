<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { SilkIntent } from "$lib/shared/effects/domain/effects-config";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  const PALETTES: { id: SilkIntent["palette"]; label: string; swatch: string }[] = [
    { id: "satin", label: "Satin", swatch: "#c0c0d0" },
    { id: "velvet", label: "Velvet", swatch: "#600018" },
    { id: "ethereal", label: "Ethereal", swatch: "#c080ff" },
    { id: "shadow", label: "Shadow", swatch: "#101020" },
    { id: "gold_leaf", label: "Gold Leaf", swatch: "#ffd700" },
    { id: "ember", label: "Ember", swatch: "#ff6000" },
    { id: "custom", label: "Custom", swatch: "#ffffff" },
  ];

  const TRACKING: { id: SilkIntent["trackingMode"]; label: string }[] = [
    { id: "left_end", label: "Left" },
    { id: "right_end", label: "Right" },
    { id: "both_ends", label: "Both" },
  ];

  const FORMS: { id: SilkIntent["form"]; label: string }[] = [
    { id: "ribbon", label: "Ribbon" },
    { id: "serpent", label: "Serpent" },
  ];

  const CREATURES: { id: SilkIntent["creature"]; label: string }[] = [
    { id: "snake", label: "Snake" },
    { id: "dragon", label: "Dragon" },
  ];
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="silk-controls">
      <div class="option-row">
        <span class="option-label">Palette</span>
        <div class="chip-group" role="radiogroup" aria-label="Silk palette">
          {#each PALETTES as p (p.id)}
            <button
              class="chip swatch-chip"
              class:active={state.silk.palette === p.id}
              type="button"
              role="radio"
              aria-checked={state.silk.palette === p.id}
              onclick={() => state.updateEffect("silk", { palette: p.id })}
            >
              <span class="swatch" style="background: {p.swatch}" aria-hidden="true"></span>
              {p.label}
            </button>
          {/each}
        </div>
      </div>

      {#if state.silk.palette === "custom"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.silk.customColor}
                oninput={(e) =>
                  state.updateEffect("silk", {
                    customColor: (e.currentTarget as HTMLInputElement).value,
                  })}
              />
            </label>
          </div>
        </div>
      {/if}

      <div class="option-row">
        <span class="option-label">Form</span>
        <div class="chip-group" role="radiogroup" aria-label="Silk form">
          {#each FORMS as f (f.id)}
            <button
              class="chip"
              class:active={state.silk.form === f.id}
              type="button"
              role="radio"
              aria-checked={state.silk.form === f.id}
              onclick={() => state.updateEffect("silk", { form: f.id })}
            >
              {f.label}
            </button>
          {/each}
        </div>
      </div>

      {#if state.silk.form === "serpent"}
        <div class="option-row">
          <span class="option-label">Creature</span>
          <div class="chip-group" role="radiogroup" aria-label="Silk creature">
            {#each CREATURES as c (c.id)}
              <button
                class="chip"
                class:active={state.silk.creature === c.id}
                type="button"
                role="radio"
                aria-checked={state.silk.creature === c.id}
                onclick={() => state.updateEffect("silk", { creature: c.id })}
              >
                {c.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="option-row">
        <span class="option-label">Tracking</span>
        <div class="chip-group" role="radiogroup" aria-label="Silk tracking mode">
          {#each TRACKING as t (t.id)}
            <button
              class="chip"
              class:active={state.silk.trackingMode === t.id}
              type="button"
              role="radio"
              aria-checked={state.silk.trackingMode === t.id}
              onclick={() => state.updateEffect("silk", { trackingMode: t.id })}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="slider-row">
        <label for="silk-intensity">Intensity</label>
        <input
          id="silk-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.silk.intensity}
          oninput={(e) =>
            state.updateEffect("silk", {
              intensity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.silk.intensity * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="silk-width">Width</label>
        <input
          id="silk-width"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.silk.width}
          oninput={(e) =>
            state.updateEffect("silk", {
              width: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.silk.width * 100)}%</span>
      </div>

      {#if state.silk.form === "serpent"}
        <div class="slider-row">
          <label for="silk-length">Length</label>
          <input
            id="silk-length"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.silk.bodyLength}
            oninput={(e) =>
              state.updateEffect("silk", {
                bodyLength: +(e.currentTarget as HTMLInputElement).value,
              })}
          />
          <span class="slider-value">{Math.round(state.silk.bodyLength * 100)}%</span>
        </div>

        <div class="slider-row">
          <label for="silk-slither">Slither</label>
          <input
            id="silk-slither"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.silk.slither}
            oninput={(e) =>
              state.updateEffect("silk", {
                slither: +(e.currentTarget as HTMLInputElement).value,
              })}
          />
          <span class="slider-value">{Math.round(state.silk.slither * 100)}%</span>
        </div>
      {/if}

      {#if state.silk.form !== "serpent"}
      <div class="slider-row">
        <label for="silk-duration">Duration</label>
        <input
          id="silk-duration"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.silk.duration}
          oninput={(e) =>
            state.updateEffect("silk", {
              duration: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.silk.duration * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="silk-flutter">Flutter</label>
        <input
          id="silk-flutter"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.silk.flutter}
          oninput={(e) =>
            state.updateEffect("silk", {
              flutter: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.silk.flutter * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="silk-tautness">Tautness</label>
        <input
          id="silk-tautness"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.silk.tautness}
          oninput={(e) =>
            state.updateEffect("silk", {
              tautness: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.silk.tautness * 100)}%</span>
      </div>
      {/if}
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

  .silk-controls {
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
