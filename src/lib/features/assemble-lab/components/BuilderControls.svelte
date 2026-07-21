<!--
  BuilderControls.svelte - Context-sensitive overlay controls for the assemble grid.

  Mobile bottom bar: single hand toggle (left) + Complete/New action (right).
  Top-center: instruction text with inline tappable turn/orientation control.
  Desktop: triggers hidden (BuilderTurnBar handles turns, header handles hands).
  Action row (Complete / New) below grid on desktop.
-->
<script lang="ts">
  import { Popover } from "bits-ui";
  import { getSoloPropSaveOrchestrator } from "$lib/features/library/get-solo-prop-save-orchestrator";
  import {
    MotionColor,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type {
    AssembleState,
    BuilderStep,
  } from "../state/assemble-state.svelte";
  import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/solo-prop-step-data";
  import type { SoloPropSaveOrchestrator } from "$lib/features/library/services/solo-prop-save-orchestrator";
  import { createSoloProp } from "$lib/shared/foundation/services/solo-prop-factory";
  import OrientationExplainer from "./OrientationExplainer.svelte";
  import GridModePicker from "./GridModePicker.svelte";
  import BuilderMotionSettings from "./BuilderMotionSettings.svelte";
  import BuilderOrientationPicker from "./BuilderOrientationPicker.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { stepToMotion } from "../services/builder-step-converter";
  import {
    getBuilderControlVisibility,
    getBuilderPhaseInstruction,
  } from "../services/builder-phase-presentation";

  let { builderState }: { builderState: AssembleState } = $props();

  const handColor = $derived(
    builderState.activeHand === MotionColor.BLUE
      ? "var(--prop-blue, #2e8bf0)"
      : "var(--prop-red, #ed1c24)"
  );

  const isAnimating = $derived(builderState.phase === "animating");
  const isComplete = $derived(builderState.phase === "complete");
  const isBlueHand = $derived(builderState.activeHand === MotionColor.BLUE);
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

  // Pulse the inactive hand's side when it has 0 steps
  const redNeedsAttention = $derived(
    isBlueHand &&
      builderState.redSteps.length === 0 &&
      builderState.blueSteps.length > 0
  );
  const blueNeedsAttention = $derived(
    !isBlueHand &&
      builderState.blueSteps.length === 0 &&
      builderState.redSteps.length > 0
  );

  // Solo prop save: show when exactly one hand has steps and the other is empty
  const canSaveSoloProp = $derived(
    (builderState.blueSteps.length > 0 && builderState.redSteps.length === 0) ||
      (builderState.redSteps.length > 0 && builderState.blueSteps.length === 0)
  );
  let isSavingSoloProp = $state(false);
  let soloPropSaveError = $state<string | null>(null);

  function builderStepToSoloPropStep(
    step: BuilderStep,
    color: MotionColor
  ): SoloPropStepData {
    const motion = stepToMotion(step, color, builderState.gridMode);
    return {
      startLocation: step.startPosition,
      endLocation: step.endPosition,
      startOrientation: step.startOrientation,
      endOrientation: step.endOrientation,
      motionType: motion.motionType,
      rotationDirection: motion.rotationDirection,
      turns: motion.turns,
      duration: 1,
    };
  }

  async function handleSaveSoloProp(): Promise<void> {
    if (!canSaveSoloProp || isSavingSoloProp) return;

    const steps =
      builderState.blueSteps.length > 0
        ? builderState.blueSteps
        : builderState.redSteps;

    if (steps.length === 0) return;

    isSavingSoloProp = true;
    soloPropSaveError = null;

    try {
      const orchestrator =
        getSoloPropSaveOrchestrator() as SoloPropSaveOrchestrator;

      const color =
        builderState.blueSteps.length > 0
          ? MotionColor.BLUE
          : MotionColor.RED;
      const soloPropSteps = steps.map((step) =>
        builderStepToSoloPropStep(step, color)
      );
      const startLocation = steps[0]!.startPosition;
      const startOrientation = steps[0]!.startOrientation;

      const soloPropData = createSoloProp(
        soloPropSteps,
        startLocation,
        startOrientation
      );

      await orchestrator.save(soloPropData);
    } catch (err) {
      console.error("[BuilderControls] Solo prop save failed:", err);
      soloPropSaveError = "Couldn't save this prop. Try again.";
      toast.error(soloPropSaveError);
    } finally {
      isSavingSoloProp = false;
    }
  }

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

  function toggleHand(): void {
    const next = isBlueHand ? MotionColor.RED : MotionColor.BLUE;
    builderState.switchToHand(next);
  }
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
    <!-- Hand toggle: single pill with both hands -->
    <button
      class="hand-toggle"
      class:toggle-hidden={!showHandToggle}
      class:needs-attention-red={redNeedsAttention}
      class:needs-attention-blue={blueNeedsAttention}
      onclick={toggleHand}
      aria-label="Switch hand (Blue: {builderState.blueSteps
        .length}, Red: {builderState.redSteps.length})"
      tabindex={showHandToggle ? 0 : -1}
    >
      <span class="toggle-side blue-side" class:active-side={isBlueHand}>
        <span class="toggle-dot blue-dot" aria-hidden="true"></span>
        <span class="toggle-count">{builderState.blueSteps.length}</span>
      </span>
      <span class="toggle-divider" aria-hidden="true"></span>
      <span class="toggle-side red-side" class:active-side={!isBlueHand}>
        <span class="toggle-count">{builderState.redSteps.length}</span>
        <span class="toggle-dot red-dot" aria-hidden="true"></span>
      </span>
    </button>

    <!-- Action button: Complete or New or Save Solo Prop -->
    <div
      class="action-slot"
      class:visible={showActions || canSaveSoloProp}
      class:dimmed={actionsDimmed}
    >
      {#if canSaveSoloProp}
        <PanelButton
          variant="secondary"
          onclick={() => void handleSaveSoloProp()}
          disabled={isSavingSoloProp}
        >
          <i class="fas fa-download" aria-hidden="true"></i>
          <span>{isSavingSoloProp ? "Saving..." : "Save Solo"}</span>
        </PanelButton>
      {/if}

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
  class:visible={showActions || canSaveSoloProp}
  class:dimmed={actionsDimmed}
  style="--hand-color: {handColor}"
>
  {#if canSaveSoloProp}
    <PanelButton
      variant="secondary"
      onclick={() => void handleSaveSoloProp()}
      disabled={isSavingSoloProp}
    >
      <i class="fas fa-download" aria-hidden="true"></i>
      <span>{isSavingSoloProp ? "Saving..." : "Save Solo"}</span>
    </PanelButton>
  {/if}

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

{#if soloPropSaveError}
  <p class="save-error" role="alert">{soloPropSaveError}</p>
{/if}

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

  /* ── Hand toggle ── */
  .hand-toggle {
    display: flex;
    align-items: center;
    padding: 0;
    border-radius: 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    cursor: pointer;
    pointer-events: auto;
    min-height: var(--min-touch-target, 44px);
    overflow: hidden;
    transition:
      opacity 0.2s ease,
      border-color 0.2s ease;
  }

  .hand-toggle.toggle-hidden {
    opacity: 0;
    pointer-events: none;
  }

  .toggle-side {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-weight: 600;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .toggle-side.active-side {
    color: var(--theme-text, #fff);
  }

  .blue-side.active-side {
    background: color-mix(in srgb, var(--prop-blue, #2e8bf0) 15%, transparent);
  }

  .red-side.active-side {
    background: color-mix(in srgb, var(--prop-red, #ed1c24) 15%, transparent);
  }

  .toggle-divider {
    width: 1px;
    height: 20px;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    flex-shrink: 0;
  }

  .toggle-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }

  .active-side .toggle-dot {
    opacity: 1;
  }

  .blue-dot {
    background: var(--prop-blue, #2e8bf0);
  }

  .red-dot {
    background: var(--prop-red, #ed1c24);
  }

  .toggle-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    min-width: 14px;
    text-align: center;
  }

  /* Pulse the red side when it needs attention */
  .hand-toggle.needs-attention-red {
    border-color: color-mix(in srgb, var(--prop-red, #ed1c24) 60%, transparent);
  }

  .hand-toggle.needs-attention-blue {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #2e8bf0) 60%,
      transparent
    );
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
  .inline-trigger:focus-visible,
  .hand-toggle:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  .save-error {
    flex: 0 0 auto;
    margin: 0;
    min-height: 1.2em;
    color: var(--semantic-error, var(--prop-red));
    font-size: var(--font-size-compact, 12px);
    text-align: center;
  }

  /* === Reduced motion === */
  @media (prefers-reduced-motion: reduce) {
    .action-row,
    .inline-trigger,
    .inline-trigger i,
    .hand-toggle,
    .toggle-side,
    .toggle-dot {
      transition: none;
    }

    :global(.assemble-popover-panel) {
      animation: none;
    }

    .hand-toggle.needs-attention-red,
    .hand-toggle.needs-attention-blue {
      border-color: var(--theme-accent, #6366f1);
    }
  }
</style>
