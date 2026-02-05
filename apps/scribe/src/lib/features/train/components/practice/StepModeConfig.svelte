<!--
  StepModeConfig.svelte - Step-by-Step Mode Settings

  Configuration panel for step-by-step practice mode.
-->
<script lang="ts">
  import type { StepConfig } from "../../state/train-practice-state.svelte";

  interface Props {
    config: StepConfig;
    onUpdate: (config: Partial<StepConfig>) => void;
  }

  let { config, onUpdate }: Props = $props();
</script>

<div class="config-panel">
  <h3>Step-by-Step Mode Settings</h3>
  <p class="description">
    Progress through the sequence one beat at a time at your own pace.
  </p>

  <div class="setting-group">
    <label class="checkbox-label">
      <input
        type="checkbox"
        checked={config.voiceCues}
        onchange={(e) => onUpdate({ voiceCues: e.currentTarget.checked })}
      />
      <span>Enable voice cues</span>
    </label>
    <p class="hint">Announces the next position verbally.</p>
  </div>

  <div class="setting-group">
    <label for="voiceKeyword">Voice command keyword</label>
    <input
      id="voiceKeyword"
      type="text"
      value={config.voiceKeyword}
      oninput={(e) => onUpdate({ voiceKeyword: e.currentTarget.value })}
      placeholder="next"
    />
    <p class="hint">Say this word to advance to the next beat.</p>
  </div>

  <div class="setting-group">
    <label for="confirmation">Advancement method</label>
    <select
      id="confirmation"
      value={config.requiredConfirmation}
      onchange={(e) =>
        onUpdate({
          requiredConfirmation: e.currentTarget.value as
            | "tap"
            | "voice"
            | "both",
        })}
    >
      <option value="tap">Tap/Click button</option>
      <option value="voice">Voice command</option>
      <option value="both">Tap or Voice</option>
    </select>
    <p class="hint">How to move to the next beat.</p>
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
  }

  .hint {
    font-size: 0.75rem;
    opacity: 0.6;
    margin: 0;
  }

  input[type="text"],
  select {
    min-height: var(--min-touch-target);
    padding: 0.75rem;
    background: var(--theme-stroke);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 0.5rem;
    color: var(--theme-text);
    font-size: 0.875rem;
  }

  input[type="text"]:focus,
  select:focus {
    outline: none;
    border-color: var(--semantic-info, var(--semantic-info));
    background: var(--theme-card-hover-bg);
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
