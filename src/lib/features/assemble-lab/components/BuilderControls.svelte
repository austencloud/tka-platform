<!--
  BuilderControls.svelte - Context-sensitive overlay controls for the assemble grid.

  Mobile: a dedicated instruction/control strip above the grid and a full-width
  hand picker below it. Desktop keeps those controls in the builder header.
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

  // Show action button when sequence can be completed or is complete
  const showActions = $derived(builderState.canFinishHand || isComplete);
  const actionsDimmed = $derived(isAnimating);
  const handSelectionDisabled = $derived(isAnimating || isComplete);

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
      <span class="instruction-text">{phaseInstruction}</span>

      <div class="phase-controls">
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
                  align="end"
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
                  align="end"
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

<!-- Persistent hand rail: below the grid on desktop only. The reserved action
     slot keeps the two hand targets stable when Complete becomes available. -->
<div class="action-row" class:dimmed={actionsDimmed}>
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
        onclick={() => builderState.finishHand()}
      >
        <i class="fas fa-check" aria-hidden="true"></i>
        <span>Complete</span>
      </PanelButton>
    {/if}
  </div>
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

  /* ── Mobile status strip ── */
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

  .has-phase-controls .instruction-text {
    text-align: left;
  }

  .mobile-grid-picker {
    width: 100%;
    pointer-events: auto;
  }

  .phase-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    pointer-events: auto;
  }

  .phase-controls:empty {
    display: none;
  }

  /* ── Inline turn/orientation trigger ── */
  .inline-control-wrapper {
    position: relative;
  }

  .inline-trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    padding: 6px 11px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #26c6da) 46%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #26c6da) 13%,
      var(--theme-card-bg, rgba(10, 22, 30, 0.92))
    );
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .inline-trigger:hover {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #26c6da) 72%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #26c6da) 22%,
      var(--theme-card-bg, rgba(10, 22, 30, 0.92))
    );
  }

  .inline-trigger:active {
    transform: scale(0.96);
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
    opacity: 0.3;
    pointer-events: none;
  }

  /* ── Action row (desktop only) ── */
  .action-row {
    display: flex;
    align-items: stretch;
    gap: var(--settings-spacing-sm, 8px);
    padding: 6px 0;
    flex-shrink: 0;
    min-height: var(--min-touch-target, 44px);
  }

  .action-row.dimmed {
    opacity: 0.3;
    pointer-events: none;
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

  /* === Focus indicators === */
  .inline-trigger:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  @container tool-panel (max-width: 420px) {
    .top-status-area.has-dual-controls .status-line {
      grid-template-columns: minmax(0, 1fr);
      padding: 8px;
    }

    .has-dual-controls .instruction-text {
      text-align: center;
    }

    .has-dual-controls .phase-controls {
      justify-content: center;
    }
  }

  /* === Reduced motion === */
  @media (prefers-reduced-motion: reduce) {
    .action-row,
    .action-slot,
    .inline-trigger,
    .inline-trigger i {
      transition: none;
    }

    :global(.assemble-popover-panel) {
      animation: none;
    }
  }
</style>
