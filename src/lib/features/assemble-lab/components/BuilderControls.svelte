<!--
  BuilderControls.svelte - Context-sensitive overlay controls for the assemble grid.

  Mobile: a dedicated instruction/control strip above the grid and a full-width
  hand picker below it. Desktop keeps those controls in the builder header.
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import GridModePicker from "./GridModePicker.svelte";
  import BuilderHandPicker from "./BuilderHandPicker.svelte";
  import BuilderPhaseControls from "./BuilderPhaseControls.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import {
    getBuilderControlVisibility,
    getBuilderPhaseInstruction,
  } from "../services/builder-phase-presentation";
  import EditHistoryShortcutBridge from "$lib/shared/keyboard/components/EditHistoryShortcutBridge.svelte";

  let { builderState }: { builderState: AssembleState } = $props();

  const isAnimating = $derived(builderState.phase === "animating");
  const isComplete = $derived(builderState.phase === "complete");
  const controlVisibility = $derived(
    getBuilderControlVisibility(builderState.phase)
  );

  // Show action button when sequence can be completed or is complete
  const showActions = $derived(builderState.canFinishHand || isComplete);
  const actionsDimmed = $derived(isAnimating);
  const handSelectionDisabled = $derived(isAnimating || isComplete);
  const currentStepNumber = $derived(
    (builderState.activeHand === MotionColor.BLUE
      ? builderState.blueSteps.length
      : builderState.redSteps.length) + (isComplete ? 0 : 1)
  );

  const phaseInstruction = $derived(
    getBuilderPhaseInstruction(builderState.phase)
  );
</script>

<EditHistoryShortcutBridge
  onUndo={builderState.undoStep}
  onRedo={builderState.redoStep}
  canUndo={builderState.canUndo}
  canRedo={builderState.canRedo}
  undoLabel={builderState.undoLabel}
  redoLabel={builderState.redoLabel}
/>

<!-- Grid overlay -->
<div class="builder-controls-overlay">
  <!-- Mobile status strip. Controls live in flow with the instruction so a
       growing label can wrap without ever sitting underneath a button. -->
  <div
    class="top-status-area"
    class:has-phase-controls={controlVisibility.orientation ||
      controlVisibility.motionSettings}
    class:has-dual-controls={controlVisibility.orientation &&
      controlVisibility.motionSettings}
  >
    <div class="status-line">
      <span class="instruction-text">
        <span class="mobile-step-number">Step {currentStepNumber}</span>
        <span>{phaseInstruction}</span>
      </span>

      <div class="mobile-phase-controls">
        <BuilderPhaseControls {builderState} reserveSlots={false} />
      </div>
    </div>

    {#if builderState.canChangeGridMode}
      <div class="mobile-grid-picker">
        <GridModePicker
          gridMode={builderState.gridMode}
          showCenter={builderState.showCenter}
          disabled={!builderState.canChangeGridMode}
          onGridModeChange={(mode) => builderState.setGridMode(mode)}
          onCenterChange={(show) => builderState.setShowCenter(show)}
        />
      </div>
    {/if}
  </div>

  <!-- Bottom bar: hand toggle (left) + Complete/New (right) - mobile only -->
  <div class="bottom-bar">
    <div class="mobile-hand-picker">
      <BuilderHandPicker
        activeHand={builderState.activeHand}
        blueCount={builderState.blueSteps.length}
        redCount={builderState.redSteps.length}
        disabled={handSelectionDisabled}
        onchange={(hand) => builderState.switchToHand(hand)}
      />
    </div>

    <!-- Action button: Complete or New -->
    <div
      class="action-slot"
      class:visible={showActions}
      class:dimmed={actionsDimmed}
      class:can-finish={builderState.canFinishHand}
    >
      {#if builderState.canFinishHand}
        <PanelButton
          variant="primary"
          disabled={isAnimating}
          ariaBusy={isAnimating}
          onclick={() => builderState.finishHand()}
        >
          <i class="fas fa-check" aria-hidden="true"></i>
          <span>Complete</span>
        </PanelButton>
      {/if}

      {#if isComplete}
        <PanelButton variant="primary" onclick={() => builderState.reset()}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          <span>New</span>
        </PanelButton>
      {/if}
    </div>
  </div>
</div>

<!-- Persistent hand rail: below the grid on desktop only. The reserved action
     slot keeps the two hand targets stable when Complete becomes available. -->
<div
  class="action-row"
  class:dimmed={actionsDimmed}
  class:can-finish={builderState.canFinishHand}
>
  <div class="desktop-hand-picker">
    <BuilderHandPicker
      activeHand={builderState.activeHand}
      blueCount={builderState.blueSteps.length}
      redCount={builderState.redSteps.length}
      disabled={handSelectionDisabled}
      onchange={(hand) => builderState.switchToHand(hand)}
    />
  </div>

  <div class="desktop-action-slot">
    {#if isComplete}
      <PanelButton
        variant="primary"
        fullWidth
        onclick={() => builderState.reset()}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
        <span>New</span>
      </PanelButton>
    {:else}
      <PanelButton
        variant="primary"
        fullWidth
        disabled={!builderState.canFinishHand || isAnimating}
        ariaBusy={isAnimating}
        onclick={() => builderState.finishHand()}
      >
        <i class="fas fa-check" aria-hidden="true"></i>
        <span>Complete</span>
      </PanelButton>
    {/if}
  </div>
</div>

<style>
  .builder-controls-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .top-status-area {
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: var(--settings-spacing-sm, 8px);
    width: min(100%, 520px);
    margin-inline: auto;
    pointer-events: none;
  }

  @container tool-panel (max-width: 768px) {
    .top-status-area {
      display: flex;
    }
  }

  .status-line {
    align-self: center;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    width: fit-content;
    max-width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 5px 7px 5px 12px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #26c6da) 24%, transparent);
    border-radius: var(--settings-radius-md, 14px);
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--theme-panel-bg, rgba(7, 18, 25, 0.94)) 78%,
        transparent
      ),
      color-mix(in srgb, var(--theme-accent, #26c6da) 8%, transparent)
    );
    box-shadow:
      0 10px 26px color-mix(in srgb, var(--theme-shadow, #000) 30%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px) saturate(125%);
  }

  .top-status-area.has-phase-controls .status-line {
    grid-template-columns: minmax(0, 1fr) auto;
    width: 100%;
  }

  .instruction-text {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
    color: var(--theme-text, #fff);
    text-shadow: 0 1px 6px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    pointer-events: none;
  }

  .mobile-step-number {
    display: none;
    margin-right: 7px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 900;
    white-space: nowrap;
  }

  @container tool-panel (max-width: 768px) {
    .mobile-step-number {
      display: inline;
    }
  }

  .has-phase-controls .instruction-text {
    text-align: left;
  }

  .mobile-grid-picker {
    width: 100%;
    pointer-events: auto;
  }

  .mobile-phase-controls {
    display: flex;
    justify-content: flex-end;
    pointer-events: auto;
  }

  /* ── Bottom bar (mobile only) ── */
  .bottom-bar {
    display: none;
    position: relative;
    width: 100%;
    pointer-events: none;
  }

  @container tool-panel (max-width: 768px) {
    .bottom-bar {
      display: flex;
    }
  }

  .mobile-hand-picker {
    width: 100%;
    pointer-events: auto;
  }

  /* ── Action slot (mobile) ── */
  .action-slot {
    display: none;
    position: absolute;
    right: 0;
    bottom: calc(100% + var(--settings-spacing-sm, 8px));
    justify-content: flex-end;
    pointer-events: none;
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    gap: var(--settings-spacing-sm, 8px);
  }

  @container tool-panel (max-width: 768px) {
    .action-slot {
      display: flex;
    }
  }

  .action-slot.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .action-slot.dimmed {
    pointer-events: none;
  }

  .action-slot.dimmed.can-finish :global(.panel-btn:disabled) {
    opacity: 1;
  }

  .action-slot.can-finish :global(.panel-btn--primary),
  .action-row.can-finish .desktop-action-slot :global(.panel-btn--primary) {
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 52%,
      white
    );
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 82%, white);
    color: #04150a;
    font-size: var(--assemble-action-size, 15px);
    font-weight: 900;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.32),
      0 0 18px
        color-mix(in srgb, var(--semantic-success, #22c55e) 38%, transparent);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .action-slot.can-finish :global(.panel-btn--primary:hover:not(:disabled)),
  .action-row.can-finish
    .desktop-action-slot
    :global(.panel-btn--primary:hover:not(:disabled)) {
    filter: brightness(1.08);
  }

  /* ── Action row (desktop only) ── */
  .action-row {
    display: flex;
    grid-row: 1;
    align-items: stretch;
    gap: var(--settings-spacing-md, 12px);
    padding: 10px 12px;
    width: 100%;
    flex-shrink: 0;
    min-height: var(--min-touch-target, 44px);
    border-bottom: 1px solid var(--assemble-builder-stroke, var(--theme-stroke));
    background: color-mix(in srgb, var(--theme-text, #fff) 3%, transparent);
  }

  .action-row.dimmed {
    pointer-events: none;
  }

  .action-row.dimmed.can-finish :global(.panel-btn:disabled),
  .desktop-hand-picker :global(.segment:disabled),
  .mobile-hand-picker :global(.segment:disabled) {
    opacity: 1;
  }

  .desktop-hand-picker {
    min-width: 0;
    flex: 1 1 auto;
  }

  .desktop-action-slot {
    display: flex;
    width: 9rem;
    flex: 0 0 9rem;
  }

  @container tool-panel (max-width: 768px) {
    .action-row {
      display: none;
    }
  }

  @container tool-panel (max-width: 420px) {
    .top-status-area.has-dual-controls .status-line {
      grid-template-columns: minmax(0, 1fr);
      padding: 8px;
    }

    .has-dual-controls .instruction-text {
      text-align: center;
    }

    .has-dual-controls .mobile-phase-controls {
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .action-row,
    .action-slot {
      transition: none;
    }
  }
</style>
