<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { AssembleState } from "../state/assemble-state.svelte";

  let { builderState }: { builderState: AssembleState } = $props();

  const stepNumber = $derived((builderState.selectedStepIndex ?? 0) + 1);
  const handLabel = $derived(
    builderState.activeHand === MotionColor.BLUE ? "Blue" : "Red"
  );
  const totalSteps = $derived(
    Math.max(builderState.blueSteps.length, builderState.redSteps.length)
  );
  const canMoveBack = $derived(
    builderState.canReorderSteps &&
      builderState.selectedStepIndex !== null &&
      builderState.selectedStepIndex > 0
  );
  const canMoveForward = $derived(
    builderState.canReorderSteps &&
      builderState.selectedStepIndex !== null &&
      builderState.selectedStepIndex < totalSteps - 1
  );
</script>

<div class="toolbar" role="toolbar" aria-label="Selected step actions">
  {#if builderState.stepEditMode === "replace"}
    <div class="replace-prompt" role="status">
      <strong>Replace {handLabel} step {stepNumber}</strong>
      <span>Tap its new destination on the grid.</span>
    </div>
    <PanelButton onclick={() => builderState.cancelStepEdit()}>
      <i class="fas fa-times" aria-hidden="true"></i>
      <span>Cancel</span>
    </PanelButton>
  {:else}
    <span class="selection-label">Step {stepNumber}</span>
    <div class="toolbar-actions">
      <PanelButton
        disabled={!canMoveBack}
        onclick={() => builderState.moveSelectedStep(-1)}
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span class="wide-label">Earlier</span>
      </PanelButton>
      <PanelButton
        disabled={!canMoveForward}
        onclick={() => builderState.moveSelectedStep(1)}
      >
        <span class="wide-label">Later</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </PanelButton>
      <PanelButton
        variant="primary"
        disabled={!builderState.canReplaceSelectedStep}
        onclick={() => builderState.beginReplaceSelectedStep()}
      >
        <i class="fas fa-location-dot" aria-hidden="true"></i>
        <span>Replace {handLabel}</span>
      </PanelButton>
      <PanelButton onclick={() => builderState.deleteSelectedStep()}>
        <i class="fas fa-trash" aria-hidden="true"></i>
        <span>Delete</span>
      </PanelButton>
      <PanelButton onclick={() => builderState.selectStep(null)}>
        <i class="fas fa-check" aria-hidden="true"></i>
        <span class="wide-label">Done</span>
      </PanelButton>
    </div>
  {/if}
</div>

<style>
  .toolbar {
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: 2px var(--settings-spacing-sm, 8px);
  }

  .selection-label {
    flex: 0 0 auto;
    min-width: 58px;
    color: var(--theme-text-muted);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    text-align: center;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
  }

  .toolbar :global(.panel-btn) {
    min-height: var(--min-touch-target, 44px);
    padding: 7px 11px;
    white-space: nowrap;
  }

  .replace-prompt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }

  .replace-prompt strong {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
  }

  .replace-prompt span {
    color: var(--theme-text-muted);
    font-size: var(--font-size-compact, 12px);
  }

  @container tool-panel (max-width: 640px) {
    .selection-label,
    .wide-label {
      display: none;
    }

    .toolbar :global(.panel-btn) {
      padding-inline: 10px;
    }
  }
</style>
