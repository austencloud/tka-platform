<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { PulseIntent } from "$lib/shared/effects/domain/effects-config";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  const TRIGGERS: { id: PulseIntent["trigger"]; label: string }[] = [
    { id: "beat", label: "Beat" },
    { id: "velocity", label: "Velocity" },
    { id: "continuous", label: "Continuous" },
  ];

  const STYLES: { id: PulseIntent["style"]; label: string }[] = [
    { id: "stroke", label: "Stroke" },
    { id: "glow", label: "Glow" },
  ];

  const PALETTES: { id: PulseIntent["palette"]; label: string; swatch: string }[] = [
    { id: "sonar", label: "Sonar", swatch: "#38bdf8" },
    { id: "ripple", label: "Ripple", swatch: "#93c5fd" },
    { id: "aurora", label: "Aurora", swatch: "#a855f7" },
    { id: "neon", label: "Neon", swatch: "#f0abfc" },
    { id: "ember", label: "Ember", swatch: "#ff6000" },
    { id: "void", label: "Void", swatch: "#404060" },
    { id: "custom", label: "Custom", swatch: "#ffffff" },
  ];

  const COLOR_MODES: { id: PulseIntent["colorMode"]; label: string }[] = [
    { id: "solid", label: "Solid" },
    { id: "prop-matched", label: "Prop-matched" },
    { id: "rainbow", label: "Rainbow" },
    { id: "palette", label: "Palette" },
  ];

  const TRACKING: { id: PulseIntent["trackingMode"]; label: string }[] = [
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
    <div class="pulse-controls">
      <!-- Trigger -->
      <div class="option-row">
        <span class="option-label">Trigger</span>
        <div class="chip-group" role="radiogroup" aria-label="Pulse trigger mode">
          {#each TRIGGERS as t (t.id)}
            <button
              class="chip"
              class:active={state.pulse.trigger === t.id}
              type="button"
              role="radio"
              aria-checked={state.pulse.trigger === t.id}
              onclick={() => state.updateEffect("pulse", { trigger: t.id })}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Style -->
      <div class="option-row">
        <span class="option-label">Style</span>
        <div class="chip-group" role="radiogroup" aria-label="Pulse style">
          {#each STYLES as s (s.id)}
            <button
              class="chip"
              class:active={state.pulse.style === s.id}
              type="button"
              role="radio"
              aria-checked={state.pulse.style === s.id}
              onclick={() => state.updateEffect("pulse", { style: s.id })}
            >
              {s.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Palette -->
      <div class="option-row">
        <span class="option-label">Palette</span>
        <div class="chip-group" role="radiogroup" aria-label="Pulse palette">
          {#each PALETTES as p (p.id)}
            <button
              class="chip swatch-chip"
              class:active={state.pulse.palette === p.id}
              type="button"
              role="radio"
              aria-checked={state.pulse.palette === p.id}
              onclick={() => state.updateEffect("pulse", { palette: p.id })}
            >
              <span class="swatch" style="background: {p.swatch}" aria-hidden="true"></span>
              {p.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Color Mode -->
      <div class="option-row">
        <span class="option-label">Color</span>
        <div class="chip-group" role="radiogroup" aria-label="Pulse color mode">
          {#each COLOR_MODES as cm (cm.id)}
            <button
              class="chip"
              class:active={state.pulse.colorMode === cm.id}
              type="button"
              role="radio"
              aria-checked={state.pulse.colorMode === cm.id}
              onclick={() => state.updateEffect("pulse", { colorMode: cm.id })}
            >
              {cm.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Conditional color picker -->
      {#if state.pulse.palette === "custom" || state.pulse.colorMode === "solid"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.pulse.palette === "custom" ? state.pulse.customColor : state.pulse.color}
                oninput={(e) => {
                  const val = (e.currentTarget as HTMLInputElement).value;
                  if (state.pulse.palette === "custom") {
                    state.updateEffect("pulse", { customColor: val });
                  } else {
                    state.updateEffect("pulse", { color: val });
                  }
                }}
              />
            </label>
          </div>
        </div>
      {/if}

      <!-- Tracking -->
      <div class="option-row">
        <span class="option-label">Tracking</span>
        <div class="chip-group" role="radiogroup" aria-label="Pulse tracking mode">
          {#each TRACKING as t (t.id)}
            <button
              class="chip"
              class:active={state.pulse.trackingMode === t.id}
              type="button"
              role="radio"
              aria-checked={state.pulse.trackingMode === t.id}
              onclick={() => state.updateEffect("pulse", { trackingMode: t.id })}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Conditional sliders based on trigger -->
      {#if state.pulse.trigger === "beat"}
        <div class="slider-row">
          <label for="pulse-beat-interval">Beat Interval</label>
          <input
            id="pulse-beat-interval"
            type="range"
            min="1"
            max="8"
            step="1"
            value={state.pulse.beatInterval}
            oninput={(e) =>
              state.updateEffect("pulse", {
                beatInterval: +(e.currentTarget as HTMLInputElement).value,
              })}
          />
          <span class="slider-value">{state.pulse.beatInterval}</span>
        </div>
      {/if}

      {#if state.pulse.trigger === "velocity"}
        <div class="slider-row">
          <label for="pulse-velocity-threshold">Vel. Threshold</label>
          <input
            id="pulse-velocity-threshold"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.pulse.velocityThreshold}
            oninput={(e) =>
              state.updateEffect("pulse", {
                velocityThreshold: +(e.currentTarget as HTMLInputElement).value,
              })}
          />
          <span class="slider-value">{Math.round(state.pulse.velocityThreshold * 100)}%</span>
        </div>
      {/if}

      <!-- Always-visible sliders -->
      <div class="slider-row">
        <label for="pulse-intensity">Intensity</label>
        <input
          id="pulse-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.intensity}
          oninput={(e) =>
            state.updateEffect("pulse", {
              intensity: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.intensity * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="pulse-reach">Reach</label>
        <input
          id="pulse-reach"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.reach}
          oninput={(e) =>
            state.updateEffect("pulse", {
              reach: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.reach * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="pulse-lifetime">Lifetime</label>
        <input
          id="pulse-lifetime"
          type="range"
          min="0.2"
          max="3.0"
          step="0.1"
          value={state.pulse.lifetime}
          oninput={(e) =>
            state.updateEffect("pulse", {
              lifetime: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{state.pulse.lifetime.toFixed(1)}s</span>
      </div>

      <div class="slider-row">
        <label for="pulse-thickness">Thickness</label>
        <input
          id="pulse-thickness"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.thickness}
          oninput={(e) =>
            state.updateEffect("pulse", {
              thickness: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.thickness * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="pulse-velocity-scale">Velocity → Size</label>
        <input
          id="pulse-velocity-scale"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.velocityScale}
          oninput={(e) =>
            state.updateEffect("pulse", {
              velocityScale: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.velocityScale * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="pulse-asymmetry">Asymmetry</label>
        <input
          id="pulse-asymmetry"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.asymmetry}
          oninput={(e) =>
            state.updateEffect("pulse", {
              asymmetry: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.asymmetry * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="pulse-chromatic">Chromatic</label>
        <input
          id="pulse-chromatic"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.chromatic}
          oninput={(e) =>
            state.updateEffect("pulse", {
              chromatic: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.chromatic * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="pulse-flash">Flash</label>
        <input
          id="pulse-flash"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.flash}
          oninput={(e) =>
            state.updateEffect("pulse", {
              flash: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.flash * 100)}%</span>
      </div>

      <div class="slider-row">
        <label for="pulse-harmonics">Harmonics</label>
        <input
          id="pulse-harmonics"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.pulse.harmonics}
          oninput={(e) =>
            state.updateEffect("pulse", {
              harmonics: +(e.currentTarget as HTMLInputElement).value,
            })}
        />
        <span class="slider-value">{Math.round(state.pulse.harmonics * 100)}%</span>
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

  .pulse-controls {
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
