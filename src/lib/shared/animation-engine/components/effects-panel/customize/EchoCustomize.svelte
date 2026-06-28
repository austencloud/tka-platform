<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import OptionChipRow from "../OptionChipRow.svelte";
  import type { EchoIntent } from "$lib/shared/effects/domain/effects-config";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  const SHAPES: { value: EchoIntent["shape"]; label: string; icon: string }[] = [
    { value: "staff", label: "Staff", icon: "fa-ruler" },
    { value: "tips", label: "Tips", icon: "fa-circle" },
    { value: "both", label: "Both", icon: "fa-layer-group" },
  ];

  const COLOR_MODES: { value: EchoIntent["colorMode"]; label: string }[] = [
    { value: "solid", label: "Solid" },
    { value: "rainbow", label: "Rainbow" },
    { value: "prop-matched", label: "Prop-Matched" },
    { value: "gradient", label: "Gradient" },
  ];
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="echo-controls">
      <OptionChipRow
        label="Shape"
        ariaLabel="Echo shape"
        value={state.echo.shape}
        options={SHAPES}
        onChange={(v) => state.updateEffect("echo", { shape: v })}
      />

      <OptionChipRow
        label="Color"
        ariaLabel="Echo color mode"
        value={state.echo.colorMode}
        options={COLOR_MODES}
        onChange={(v) => state.updateEffect("echo", { colorMode: v })}
      />

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

      <!-- Glow (luminous bloom) -->
      <div class="slider-row">
        <label for="echo-glow">Glow</label>
        <input
          id="echo-glow"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.echo.glow}
          oninput={(e) =>
            state.updateEffect("echo", { glow: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.echo.glow * 100)}%</span>
      </div>

      <!-- Depth (older phantoms recede) -->
      <div class="slider-row">
        <label for="echo-depth">Depth</label>
        <input
          id="echo-depth"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.echo.depth}
          oninput={(e) =>
            state.updateEffect("echo", { depth: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.echo.depth * 100)}%</span>
      </div>

      <!-- Flash (capture pop on the beat) -->
      <div class="slider-row">
        <label for="echo-flash">Flash</label>
        <input
          id="echo-flash"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.echo.flash}
          oninput={(e) =>
            state.updateEffect("echo", { flash: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.echo.flash * 100)}%</span>
      </div>

      <!-- Streak (connective thread linking consecutive clones) -->
      <div class="slider-row">
        <label for="echo-streak">Streak</label>
        <input
          id="echo-streak"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.echo.streak}
          oninput={(e) =>
            state.updateEffect("echo", { streak: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.echo.streak * 100)}%</span>
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

  .echo-controls {
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
