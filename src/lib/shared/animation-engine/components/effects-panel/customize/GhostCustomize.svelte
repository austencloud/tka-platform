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
    <div class="ghost-controls">
      <!-- Intensity — overall trail opacity -->
      <div class="slider-row">
        <label for="ghost-intensity">Intensity</label>
        <input
          id="ghost-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.ghost.intensity}
          oninput={(e) =>
            state.updateEffect("ghost", { intensity: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.ghost.intensity * 100)}%</span>
      </div>

      <!-- Persistence — how long each ghost lingers before fading out -->
      <div class="slider-row">
        <label for="ghost-decay">Persistence</label>
        <input
          id="ghost-decay"
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={state.ghost.decay}
          oninput={(e) =>
            state.updateEffect("ghost", { decay: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.ghost.decay}</span>
      </div>

      <!-- Density — higher packs more ghosts into the trail -->
      <div class="slider-row">
        <label for="ghost-interval">Density</label>
        <input
          id="ghost-interval"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.ghost.interval}
          oninput={(e) =>
            state.updateEffect("ghost", { interval: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.ghost.interval * 100)}%</span>
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

  .ghost-controls {
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

  .empty {
    opacity: 0.6;
    font-size: var(--font-size-min, 14px);
    padding: 4px 0;
  }
</style>
