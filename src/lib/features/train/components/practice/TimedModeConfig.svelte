<!--
  TimedModeConfig.svelte - Timed Mode Settings

  Configuration panel for timed practice mode.
-->
<script lang="ts">
  import type { TimedConfig } from "../../state/train-practice-state.svelte";

  interface Props {
    config: TimedConfig;
    onUpdate: (config: Partial<TimedConfig>) => void;
  }

  let { config, onUpdate }: Props = $props();
</script>

<div class="config-panel">
  <h3>Timed Mode Settings</h3>
  <p class="description">Practice with beat timing and performance scoring.</p>

  <div class="setting-group">
    <label for="bpm">
      Tempo (BPM)
      <span class="hint">{config.bpm} beats per minute</span>
    </label>
    <input
      id="bpm"
      type="range"
      min="40"
      max="180"
      step="5"
      value={config.bpm}
      oninput={(e) => onUpdate({ bpm: parseInt(e.currentTarget.value) })}
    />
    <div class="range-labels">
      <span>Slower</span>
      <span>Faster</span>
    </div>
  </div>

  <div class="setting-group">
    <label class="checkbox-label">
      <input
        type="checkbox"
        checked={config.strictTiming}
        onchange={(e) => onUpdate({ strictTiming: e.currentTarget.checked })}
      />
      <span>Strict timing windows</span>
    </label>
    <p class="hint">Require precise timing for Perfect/Good/Miss scoring.</p>
  </div>

  <div class="setting-group">
    <label class="checkbox-label">
      <input
        type="checkbox"
        checked={config.showTimingFeedback}
        onchange={(e) =>
          onUpdate({ showTimingFeedback: e.currentTarget.checked })}
      />
      <span>Show timing feedback</span>
    </label>
    <p class="hint">Display visual feedback for hit timing (early/late).</p>
  </div>
</div>

<style>
  .config-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    color: var(--theme-text);
  }

  h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .description {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hint {
    font-size: 0.75rem;
    opacity: 0.6;
    font-weight: 400;
  }

  input[type="range"] {
    width: 100%;
    height: var(--min-touch-target);
    background: transparent;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  /* Track styling */
  input[type="range"]::-webkit-slider-runnable-track {
    height: 0.5rem;
    background: var(--theme-stroke);
    border-radius: 0.25rem;
  }

  input[type="range"]::-moz-range-track {
    height: 0.5rem;
    background: var(--theme-stroke);
    border-radius: 0.25rem;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 28px;
    height: 28px;
    background: var(--semantic-info, var(--semantic-info));
    border-radius: 50%;
    cursor: pointer;
    margin-top: -10px;
  }

  input[type="range"]::-moz-range-thumb {
    width: 28px;
    height: 28px;
    background: var(--semantic-info, var(--semantic-info));
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    min-height: var(--min-touch-target);
    padding: 0.5rem 0;
  }

  input[type="checkbox"] {
    width: 24px;
    height: 24px;
    cursor: pointer;
    flex-shrink: 0;
  }
</style>
