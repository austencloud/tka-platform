<!--
  SaveModePanel.svelte

  Panel for saving the current sequence's rotation direction pattern.
  Shows a preview grid of the current pattern and a save form.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { formatRotationValue } from "../../../domain/models/rotation-direction-pattern-data";

  interface Props {
    sequence: SequenceData | null;
    patternName: string;
    saving: boolean;
    onSave: () => void;
    onNameChange: (name: string) => void;
  }

  let { sequence, patternName, saving, onSave, onNameChange }: Props = $props();

  function getRotationColorClass(value: string): string {
    if (value === "CW") return "cw";
    if (value === "CC") return "ccw";
    return "none";
  }
</script>

<div class="save-section">
  {#if !sequence || sequence.steps.length === 0}
    <p class="empty-message">No sequence to save pattern from</p>
  {:else}
    <div class="pattern-preview">
      <h3>Current Pattern ({sequence.steps.length} steps)</h3>
      <div class="preview-grid">
        {#each sequence.steps as beat, i}
          <!-- Invisible placeholder = hand not really there: null (no-motion
               display state), never "none" (motion present, no rotation). -->
          {@const blueMotion = isVisibleMotion(beat.motions?.blue) ? beat.motions.blue : null}
          {@const redMotion = isVisibleMotion(beat.motions?.red) ? beat.motions.red : null}
          {@const blueRotation = formatRotationValue(
            blueMotion?.rotationDirection === "cw"
              ? "cw"
              : blueMotion?.rotationDirection === "ccw"
                ? "ccw"
                : blueMotion
                  ? "none"
                  : null
          )}
          {@const redRotation = formatRotationValue(
            redMotion?.rotationDirection === "cw"
              ? "cw"
              : redMotion?.rotationDirection === "ccw"
                ? "ccw"
                : redMotion
                  ? "none"
                  : null
          )}
          <div class="preview-beat">
            <span class="beat-num">{i + 1}</span>
            <div class="rotation-pair">
              <span
                class="rotation-value {getRotationColorClass(
                  blueRotation
                )} blue"
              >
                {blueRotation}
              </span>
              <span class="separator">|</span>
              <span
                class="rotation-value {getRotationColorClass(redRotation)} red"
              >
                {redRotation}
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="save-form">
      <input
        type="text"
        placeholder="Pattern name (optional - auto-generated if empty)"
        value={patternName}
        oninput={(e) => onNameChange(e.currentTarget.value)}
        maxlength={50}
      />
      <button class="save-btn" onclick={onSave} disabled={saving}>
        {#if saving}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-save" aria-hidden="true"></i>
        {/if}
        Save Pattern
      </button>
    </div>
  {/if}
</div>

<style>
  .save-section {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .empty-message {
    text-align: center;
    color: var(--theme-text-muted, var(--theme-text-dim));
    padding: 32px 16px;
  }

  .pattern-preview {
    margin-bottom: 16px;
  }

  .pattern-preview h3 {
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0 0 12px;
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 6px;
  }

  .preview-beat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px;
    background: var(--theme-card-bg);
    border-radius: 6px;
    font-size: 0.75rem;
    gap: 4px;
  }

  .beat-num {
    font-weight: 600;
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  .rotation-pair {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .separator {
    color: var(--theme-text-dim);
    font-size: 0.7rem;
  }

  .rotation-value {
    font-family: monospace;
    display: inline-block;
    min-width: 20px;
    text-align: center;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .rotation-value.cw {
    color: #06b6d4;
  }

  .rotation-value.ccw {
    color: var(--semantic-warning);
  }

  .rotation-value.none {
    color: rgba(255, 255, 255, 0.4);
  }

  .save-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .save-form input {
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 8px;
    color: var(--theme-text);
    font-size: 0.9rem;
  }

  .save-form input::placeholder {
    color: var(--theme-text-dim);
  }

  .save-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      #d97706 100%
    );
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .save-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
