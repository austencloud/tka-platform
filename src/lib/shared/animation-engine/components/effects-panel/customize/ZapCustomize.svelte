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
    <label class="row">
      <span>Intensity</span>
      <input
        type="range" min="0" max="1" step="0.05"
        value={state.zap.intensity}
        oninput={(e) => state.updateZap({ intensity: +(e.currentTarget as HTMLInputElement).value })}
      />
      <span class="val">{Math.round(state.zap.intensity * 100)}%</span>
    </label>

    <label class="row">
      <span>Frequency</span>
      <input
        type="range" min="1" max="30" step="1"
        value={state.zap.frequency}
        oninput={(e) => state.updateZap({ frequency: +(e.currentTarget as HTMLInputElement).value })}
      />
      <span class="val">{state.zap.frequency}/s</span>
    </label>

    <label class="row">
      <span>Color</span>
      <input
        type="color"
        value={state.zap.color}
        oninput={(e) => state.updateZap({ color: (e.currentTarget as HTMLInputElement).value })}
      />
      <span class="val">{state.zap.color}</span>
    </label>

    <label class="row">
      <span>Branching</span>
      <input
        type="range" min="0" max="1" step="0.05"
        value={state.zap.branching}
        oninput={(e) => state.updateZap({ branching: +(e.currentTarget as HTMLInputElement).value })}
      />
      <span class="val">{Math.round(state.zap.branching * 100)}%</span>
    </label>

    <label class="row">
      <span>Mode</span>
      <select
        value={state.zap.mode}
        onchange={(e) => state.updateZap({ mode: (e.currentTarget as HTMLSelectElement).value as "arc" | "crackle" })}
      >
        <option value="arc">Arc (tip-to-tip)</option>
        <option value="crackle">Crackle (radiate)</option>
      </select>
    </label>
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

  .row { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-min, 14px); }
  .row span:first-child { min-width: 72px; opacity: 0.7; }
  .row input[type=range] { flex: 1; min-width: 0; }
  .row .val { min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; opacity: 0.7; }
  .row select { flex: 1; }
  .empty { opacity: 0.6; font-size: var(--font-size-min, 14px); padding: 4px 0; }
</style>
