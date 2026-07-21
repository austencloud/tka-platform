<!--
  BuilderControls.svelte - Context-sensitive overlay controls for the assemble grid.

  Mobile bottom bar: single hand toggle (left) + Complete/New action (right).
  Top-center: instruction text with inline tappable turn/orientation control.
  Desktop: triggers hidden (BuilderTurnBar handles turns, header handles hands).
  Action row (Complete / New) below grid on desktop.
-->
<script lang="ts">
  import { Popover } from "bits-ui";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import OrientationExplainer from "./OrientationExplainer.svelte";
  import GridModePicker from "./GridModePicker.svelte";
  import BuilderMotionSettings from "./BuilderMotionSettings.svelte";
  import BuilderOrientationPicker from "./BuilderOrientationPicker.svelte";
  import BuilderHandPicker from "./BuilderHandPicker.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import {
    getBuilderControlVisibility,
    getBuilderPhaseInstruction,
  } from "../services/builder-phase-presentation";

  let { builderState }: { builderState: AssembleState } = $props();

  const isAnimating = $derived(builderState.phase === "animating");
  const isComplete = $derived(builderState.phase === "complete");
  const controlVisibility = $derived(
    getBuilderControlVisibility(builderState.phase)
  );

  // Show hand toggle whenever either hand has steps (hidden only when both are empty)
  const showHandToggle = $derived(
    builderState.blueSteps.length > 0 || builderState.redSteps.length > 0
  );

  // Show action button when sequence can be completed or is complete
  const showActions = $derived(builderState.canFinishHand || isComplete);
  const actionsDimmed = $derived(isAnimating);

  let oriPopoverOpen = $state(false);
  let explainerOpen = $state(false);
  const currentOriLabel = $derived(
    String(builderState.currentOrientation).replace("center", "")
  );

  // ── Turns ──
  let turnsPopoverOpen = $state(false);

  const FLOAT_TURN = -0.5;
  const isFloat = $derived(builderState.turnCount === FLOAT_TURN);

  const rotLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? "CW"
      : "CCW"
  );

  const isFlipped = $derived(
    builderState.rotationDirection === RotationDirection.COUNTER_CLOCKWISE
  );

  // Close popovers when phase changes (subscribing to phase to auto-close)
  $effect(() => {
    const _phase = builderState.phase;
    oriPopoverOpen = false;
    turnsPopoverOpen = false;
  });

  // ── Instruction text ──
  const phaseInstruction = $derived(
    getBuilderPhaseInstruction(builderState.phase)
  );
</script>

<!-- Grid overlay -->
<div class="controls-overlay">
  <!-- Top-center: instruction text only (mobile only) -->
  <div class="top-status-area">
    <span class="instruction-text">{phaseInstruction}</span>
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

  <!-- Top-left: turn/orientation trigger (mobile only) -->
  <div class="top-left-control">
    <!-- Orientation control: during placing phase -->
    {#if controlVisibility.orientation}
      <div class="inline-control-wrapper">
        <Popover.Root bind:open={oriPopoverOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                class="inline-trigger"
                aria-label="Orientation: {currentOriLabel}"
              >
                <i class="fas fa-compass" aria-hidden="true"></i>
                <span>{currentOriLabel}</span>
              </button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              class="assemble-popover-panel orientation-popover"
              aria-label="Starting orientation"
            >
              <BuilderOrientationPicker
                value={builderState.currentOrientation}
                onchange={(orientation) => {
                  builderState.setOrientation(orientation);
                  oriPopoverOpen = false;
                }}
                onHelp={() => {
                  oriPopoverOpen = false;
                  explainerOpen = true;
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    {/if}

    <!-- The next motion's turn settings are available as soon as its start point exists. -->
    {#if controlVisibility.motionSettings}
      <div class="inline-control-wrapper">
        <Popover.Root bind:open={turnsPopoverOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                class="inline-trigger"
                aria-label="Turn settings: {isFloat
                  ? 'Float'
                  : `${rotLabel} ${builderState.turnCount}`}"
              >
                {#if !isFloat}
                  <i
                    class="fas fa-rotate-right"
                    class:flipped={isFlipped}
                    aria-hidden="true"
                  ></i>
                {/if}
                <span
                  >{isFloat
                    ? "fl"
                    : `${rotLabel} ${builderState.turnCount}`}</span
                >
              </button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              class="assemble-popover-panel turns-popover"
              aria-label="Turn count and rotation direction"
            >
              <BuilderMotionSettings
                turnCount={builderState.turnCount}
                rotationDirection={builderState.rotationDirection}
                onchangeTurnCount={(turnCount) =>
                  builderState.setTurnCount(turnCount)}
                onchangeRotationDirection={(direction) =>
                  builderState.setRotationDirection(direction)}
                stacked
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    {/if}
  </div>

  <!-- Bottom bar: hand toggle (left) + Complete/New (right) - mobile only -->
  <div class="bottom-bar">
    {#if showHandToggle}
      <div class="mobile-hand-picker">
        <BuilderHandPicker
          activeHand={builderState.activeHand}
          blueCount={builderState.blueSteps.length}
          redCount={builderState.redSteps.length}
          onchange={(hand) => builderState.switchToHand(hand)}
        />
      </div>
    {/if}

    <!-- Action button: Complete or New -->
    <div
      class="action-slot"
      class:visible={showActions}
      class:dimmed={actionsDimmed}
    >
      {#if builderState.canFinishHand}
        <PanelButton
          variant="primary"
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

<!-- Action row: below the grid on desktop only -->
<div
  class="action-row"
  class:visible={showActions}
  class:dimmed={actionsDimmed}
>
  {#if builderState.canFinishHand}
    <PanelButton variant="primary" onclick={() => builderState.finishHand()}>
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

<OrientationExplainer bind:isOpen={explainerOpen} />

<style>
  /* === Grid overlay === */
  .controls-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* ── Top-center status area (mobile only) ── */
  .top-status-area {
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    /* Position at ~30% from top - midpoint between top dot and grid edge */
    padding-top: 2%;
    pointer-events: none;
  }

  @container tool-panel (max-width: 768px) {
    .top-status-area {
      display: flex;
    }
  }

  .instruction-text {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    text-shadow: 0 1px 6px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    pointer-events: none;
  }

  .mobile-grid-picker {
    pointer-events: auto;
  }

  /* ── Top-left control area (turn/orientation trigger on mobile) ── */
  .top-left-control {
    display: none;
    position: absolute;
    top: 8px;
    left: 8px;
    pointer-events: auto;
    z-index: 10;
  }

  @container tool-panel (max-width: 768px) {
    .top-left-control {
      display: flex;
    }
  }

  /* ── Inline turn/orientation trigger ── */
  .inline-control-wrapper {
    position: relative;
  }

  .inline-trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1.5px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
    border-radius: 8px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease;
  }

  .inline-trigger:hover {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
  }

  .inline-trigger i {
    font-size: 12px;
    transition: transform 0.2s ease;
  }

  .inline-trigger i.flipped {
    transform: scaleX(-1);
  }

  /* ── Popover ── */
  :global(.assemble-popover-panel) {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 14px);
    padding: var(--settings-spacing-sm, 8px);
    box-shadow: 0 8px 32px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    animation: popover-in 0.15s ease-out;
    width: min(520px, calc(100vw - 16px));
    max-width: calc(100vw - 16px);
    z-index: var(--z-dropdown, 100);
  }

  :global(.assemble-popover-panel.orientation-popover) {
    width: min(420px, calc(100vw - 16px));
  }

  @keyframes popover-in {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ── Bottom bar (mobile only) ── */
  .bottom-bar {
    display: none;
    justify-content: space-between;
    align-items: flex-end;
    pointer-events: none;
  }

  @container tool-panel (max-width: 768px) {
    .bottom-bar {
      display: flex;
    }
  }

  .mobile-hand-picker {
    width: min(210px, 62vw);
    pointer-events: auto;
  }

  /* ── Action slot (mobile) ── */
  .action-slot {
    display: none;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    gap: var(--settings-spacing-sm, 8px);
  }

  @container tool-panel (max-width: 768px) {
    .action-slot {
      display: flex;
    }
  }

  .action-slot.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .action-slot.dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  /* ── Action row (desktop only) ── */
  .action-row {
    display: flex;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: 6px 0;
    flex-shrink: 0;
    opacity: 0;
    pointer-events: none;
    min-height: var(--min-touch-target, 44px);
    transition: opacity 0.2s ease;
  }

  .action-row.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .action-row.dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  @container tool-panel (max-width: 768px) {
    .action-row {
      display: none;
    }
  }

  /* === Focus indicators === */
  .inline-trigger:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  /* === Reduced motion === */
  @media (prefers-reduced-motion: reduce) {
    .action-row,
    .inline-trigger,
    .inline-trigger i {
      transition: none;
    }

    :global(.assemble-popover-panel) {
      animation: none;
    }
  }
</style>
