<!--
  BuildPhaseIndicator.svelte - Shows current build step and beat progress

  "Click start position" → "Click end position" → "Beat confirmed"
  Also shows beat count and undo/reset controls.
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { state }: { state: VisualBuilderState } = $props();

  const handName = $derived(state.activeHand === MotionColor.BLUE ? "blue" : "red");

  const phaseMessage = $derived.by(() => {
    if (state.buildPhase === "select-start") {
      return `Click ${handName} hand's start position`;
    }
    return `Click ${handName} hand's end position`;
  });

  const statusDetails = $derived.by(() => {
    const parts: string[] = [];
    if (state.blueStart !== null) parts.push(`Blue: ${state.blueStart}${state.blueEnd ? " → " + state.blueEnd : ""}`);
    if (state.redStart !== null) parts.push(`Red: ${state.redStart}${state.redEnd ? " → " + state.redEnd : ""}`);
    return parts.join("  |  ");
  });
</script>

<div class="build-phase">
  <div class="phase-row">
    <span class="phase-icon" class:blue={state.activeHand === MotionColor.BLUE} class:red={state.activeHand === MotionColor.RED}>
      <i class="fas fa-crosshairs"></i>
    </span>
    <span class="phase-message">{phaseMessage}</span>
  </div>

  {#if statusDetails}
    <div class="status-details">{statusDetails}</div>
  {/if}

  <div class="controls-row">
    {#if state.beatCount > 0}
      <span class="beat-count">{state.beatCount} beat{state.beatCount !== 1 ? "s" : ""}</span>
    {/if}

    <div class="action-buttons">
      <button
        class="action-btn"
        onclick={() => state.undoLastAction()}
        disabled={state.blueStart === null && state.redStart === null && state.beatCount === 0}
        aria-label="Undo last action"
      >
        <i class="fas fa-undo"></i>
        Undo
      </button>

      <button
        class="action-btn danger"
        onclick={() => state.reset()}
        disabled={state.blueStart === null && state.beatCount === 0}
        aria-label="Reset all beats"
      >
        <i class="fas fa-trash-alt"></i>
        Clear
      </button>
    </div>
  </div>
</div>

<style>
  .build-phase {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
  }

  .phase-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .phase-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 14px;
  }

  .phase-icon.blue {
    background: rgba(46, 139, 240, 0.2);
    color: var(--prop-blue, #2e8bf0);
  }

  .phase-icon.red {
    background: rgba(237, 28, 36, 0.2);
    color: var(--prop-red, #ed1c24);
  }

  .phase-message {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
    font-weight: 500;
  }

  .status-details {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    padding-left: 38px;
  }

  .controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
  }

  .beat-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-weight: 500;
  }

  .action-buttons {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
    min-height: 32px;
  }

  .action-btn:hover:not(:disabled) {
    color: var(--theme-text, #fff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.danger:hover:not(:disabled) {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .action-btn i {
    font-size: 11px;
  }
</style>
