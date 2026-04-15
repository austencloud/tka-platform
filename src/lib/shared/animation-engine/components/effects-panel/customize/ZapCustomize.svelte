<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();
</script>

<div class="customize-panel">
  <header class="customize-header">
    <button type="button" class="back-btn" onclick={onBack} aria-label="Back to presets">
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <span class="customize-title">Zap</span>
  </header>

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
  {/if}
</div>

<style>
  .customize-panel { display: flex; flex-direction: column; gap: 10px; padding: 0; }
  .customize-header {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 4px;
  }
  .back-btn {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    background: transparent; color: inherit; cursor: pointer;
  }
  .customize-title { font-weight: 600; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .row span:first-child { min-width: 72px; opacity: 0.7; }
  .row input[type=range] { flex: 1; min-width: 0; }
  .row .val { min-width: 40px; text-align: right; font-variant-numeric: tabular-nums; opacity: 0.7; }
  .row select { flex: 1; }
</style>
