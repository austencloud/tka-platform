<!--
  BuilderControls.svelte - Context-sensitive overlay controls for the assemble grid.

  Mobile bottom bar: single hand toggle (left) + Complete/New action (right).
  Top-center: instruction text with inline tappable turn/orientation control.
  Desktop: triggers hidden (BuilderTurnBar handles turns, header handles hands).
  Action row (Complete / New) below grid on desktop.
-->
<script lang="ts">

import { getSoloPropSaveOrchestrator } from "$lib/features/library/get-solo-prop-save-orchestrator";
  import {
    MotionColor,
    MotionType,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { AssembleState, BuilderStep } from "../state/assemble-state.svelte";
  import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/SoloPropStepData";
  import type { SoloPropSaveOrchestrator } from "$lib/features/library/services/solo-prop-save-orchestrator";
  import { createSoloProp } from "$lib/shared/foundation/services/solo-prop-factory";
  import OrientationExplainer from "./OrientationExplainer.svelte";
  import GridModePicker from "./GridModePicker.svelte";

  let { builderState }: { builderState: AssembleState } = $props();

  const handColor = $derived(
    builderState.activeHand === MotionColor.BLUE
      ? "var(--prop-blue, #2e8bf0)"
      : "var(--prop-red, #ed1c24)"
  );

  const isAnimating = $derived(builderState.phase === "animating");
  const isComplete = $derived(builderState.phase === "complete");
  const isPlacing = $derived(builderState.phase === "placing");
  const isBuilding = $derived(builderState.phase === "building");
  const isIdle = $derived(builderState.phase === "idle");
  const isBlueHand = $derived(builderState.activeHand === MotionColor.BLUE);

  // Show hand toggle whenever either hand has steps (hidden only when both are empty)
  const showHandToggle = $derived(
    builderState.blueSteps.length > 0 || builderState.redSteps.length > 0
  );

  // Show action button when sequence can be completed or is complete
  const showActions = $derived(builderState.canFinishHand || isComplete);
  const actionsDimmed = $derived(isAnimating);

  // Pulse the inactive hand's side when it has 0 steps
  const redNeedsAttention = $derived(isBlueHand && builderState.redSteps.length === 0 && builderState.blueSteps.length > 0);
  const blueNeedsAttention = $derived(!isBlueHand && builderState.blueSteps.length === 0 && builderState.redSteps.length > 0);

  // Solo prop save: show when exactly one hand has steps and the other is empty
  const canSaveSoloProp = $derived(
    (builderState.blueSteps.length > 0 && builderState.redSteps.length === 0) ||
    (builderState.redSteps.length > 0 && builderState.blueSteps.length === 0)
  );
  let isSavingSoloProp = $state(false);
  let soloPropSaveError = $state<string | null>(null);

  /**
   * Derive MotionType from a builder step's start/end positions.
   * Same heuristic as the assemble-state arc math: same point = static,
   * diametrically opposite = dash, different = shift (pro or anti).
   */
  function deriveMotionType(step: BuilderStep): MotionType {
    if (step.turnCount < 0) return MotionType.FLOAT;
    if (step.startPosition === step.endPosition) return MotionType.STATIC;

    // Check for dash (opposite positions) by comparing location angles
    // We use a simple set-based check for cardinal opposites
    const OPPOSITES: Record<string, string> = {
      north: "south", south: "north",
      east: "west", west: "east",
      northeast: "southwest", southwest: "northeast",
      northwest: "southeast", southeast: "northwest",
    };
    if (OPPOSITES[step.startPosition] === step.endPosition) {
      return MotionType.DASH;
    }

    // Shift: pro if rotation matches arc direction, anti otherwise.
    // Simplified: default to PRO since the exact determination requires
    // angle math that the renderer will recalculate anyway.
    return MotionType.PRO;
  }

  function builderStepToSoloPropStep(step: BuilderStep): SoloPropStepData {
    return {
      startLocation: step.startPosition,
      endLocation: step.endPosition,
      startOrientation: step.startOrientation,
      endOrientation: step.endOrientation,
      motionType: deriveMotionType(step),
      rotationDirection: step.rotationDirection,
      turns: step.turnCount < 0 ? "fl" : step.turnCount,
      duration: 1,
    };
  }

  async function handleSaveSoloProp(): Promise<void> {
    if (!canSaveSoloProp || isSavingSoloProp) return;

    const steps = builderState.blueSteps.length > 0
      ? builderState.blueSteps
      : builderState.redSteps;

    if (steps.length === 0) return;

    isSavingSoloProp = true;
    soloPropSaveError = null;

    try {
      const orchestrator = getSoloPropSaveOrchestrator() as SoloPropSaveOrchestrator;

      const soloPropSteps = steps.map(builderStepToSoloPropStep);
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
      soloPropSaveError = err instanceof Error ? err.message : "Save failed";
    } finally {
      isSavingSoloProp = false;
    }
  }

  // ── Orientation ──
  const ORIENTATIONS = [
    { value: Orientation.IN, label: "in", ariaLabel: "in orientation" },
    { value: Orientation.OUT, label: "out", ariaLabel: "out orientation" },
    { value: Orientation.CLOCK, label: "clock", ariaLabel: "clock orientation" },
    { value: Orientation.COUNTER, label: "counter", ariaLabel: "counter orientation" },
  ] as const;

  let oriPopoverOpen = $state(false);
  let explainerOpen = $state(false);
  let oriTriggerRef: HTMLElement | null = $state(null);
  let turnsTriggerRef: HTMLElement | null = $state(null);

  // Compute popover position anchored below the trigger button
  function getPopoverPosition(triggerRef: HTMLElement | null): { top: string; left: string } {
    if (!triggerRef) return { top: "40%", left: "8px" };
    const rect = triggerRef.getBoundingClientRect();
    return {
      top: `${rect.bottom + 8}px`,
      left: `${rect.left}px`,
    };
  }

  const currentOriLabel = $derived(
    ORIENTATIONS.find(o => o.value === builderState.currentOrientation)?.label ?? "in"
  );

  function selectOrientation(ori: Orientation): void {
    builderState.setOrientation(ori);
    oriPopoverOpen = false;
  }

  // ── Turns ──
  let turnsPopoverOpen = $state(false);

  const FLOAT_TURN = -0.5;
  const TURN_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;
  const isFloat = $derived(builderState.turnCount === FLOAT_TURN);

  const rotLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE ? "CW" : "CCW"
  );

  const isFlipped = $derived(
    builderState.rotationDirection === RotationDirection.COUNTER_CLOCKWISE
  );

  function toggleRotation(): void {
    const next = builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
    builderState.setRotationDirection(next);
  }

  function selectTurn(t: number): void {
    builderState.setTurnCount(t);
    turnsPopoverOpen = false;
  }

  function turnAriaLabel(t: number): string {
    if (t === 0) return "No turns";
    if (t === 0.5) return "Half turn";
    return `${t} turn${t > 1 ? "s" : ""}`;
  }

  // Close popovers when phase changes (subscribing to phase to auto-close)
  $effect(() => {
    const _phase = builderState.phase;
    oriPopoverOpen = false;
    turnsPopoverOpen = false;
  });

  function handlePopoverKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      oriPopoverOpen = false;
      turnsPopoverOpen = false;
    }
  }

  // ── Instruction text ──
  const phaseInstruction = $derived.by(() => {
    switch (builderState.phase) {
      case "idle": return "Tap a starting point";
      case "placing": return "Tap destination";
      case "building":
      case "animating": return "Tap next point";
      case "complete": return "Sequence complete";
      default: return "";
    }
  });

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
      <GridModePicker
        gridMode={builderState.gridMode}
        showCenter={builderState.showCenter}
        disabled={!builderState.canChangeGridMode}
        onGridModeChange={(mode) => builderState.setGridMode(mode)}
        onCenterChange={(show) => builderState.setShowCenter(show)}
      />
    {/if}
  </div>

  <!-- Top-left: turn/orientation trigger (mobile only) -->
  <div class="top-left-control">
    <!-- Orientation control: during placing phase -->
    {#if isPlacing}
      <div class="inline-control-wrapper">
        <button
          bind:this={oriTriggerRef}
          class="inline-trigger"
          onclick={() => { oriPopoverOpen = !oriPopoverOpen; }}
          aria-label="Orientation: {currentOriLabel}"
          aria-expanded={oriPopoverOpen}
        >
          <i class="fas fa-compass" aria-hidden="true"></i>
          <span>{currentOriLabel}</span>
        </button>

        {#if oriPopoverOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="popover-backdrop"
            onclick={() => { oriPopoverOpen = false; }}
            onkeydown={handlePopoverKeydown}
            role="presentation"
          ></div>

          {@const oriPos = getPopoverPosition(oriTriggerRef)}
          <div class="popover-panel" style:top={oriPos.top} style:left={oriPos.left} role="dialog" aria-label="Starting orientation">
            <div class="popover-pills" role="radiogroup" aria-label="Orientation">
              {#each ORIENTATIONS as ori}
                <button
                  class="popover-pill"
                  class:active={builderState.currentOrientation === ori.value}
                  role="radio"
                  aria-checked={builderState.currentOrientation === ori.value}
                  aria-label={ori.ariaLabel}
                  onclick={() => selectOrientation(ori.value)}
                >
                  {ori.label}
                </button>
              {/each}
              <button
                class="help-btn"
                onclick={() => { oriPopoverOpen = false; explainerOpen = true; }}
                aria-label="Learn about orientation"
              >
                ?
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Turns control: during building/animating phase -->
    {#if isBuilding || isAnimating}
      <div class="inline-control-wrapper">
        <button
          bind:this={turnsTriggerRef}
          class="inline-trigger"
          onclick={() => { turnsPopoverOpen = !turnsPopoverOpen; }}
          aria-label="Turn settings: {isFloat ? 'Float' : `${rotLabel} ${builderState.turnCount}`}"
          aria-expanded={turnsPopoverOpen}
        >
          {#if !isFloat}
            <i class="fas fa-rotate-right" class:flipped={isFlipped} aria-hidden="true"></i>
          {/if}
          <span>{isFloat ? "fl" : builderState.turnCount}</span>
        </button>

        {#if turnsPopoverOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="popover-backdrop"
            onclick={() => { turnsPopoverOpen = false; }}
            onkeydown={handlePopoverKeydown}
            role="presentation"
          ></div>

          {@const turnsPos = getPopoverPosition(turnsTriggerRef)}
          <div class="popover-panel turns-popover" style:top={turnsPos.top} style:left={turnsPos.left} role="dialog" aria-label="Turn count and rotation direction">
            <button
              class="popover-rotation"
              class:dimmed={isFloat}
              onclick={toggleRotation}
              disabled={isFloat}
              aria-label="Toggle rotation direction"
            >
              <i class="fas fa-rotate-right" class:flipped={isFlipped} aria-hidden="true"></i>
              <span>{isFloat ? "N/A" : rotLabel}</span>
            </button>

            <div class="turns-grid" role="radiogroup" aria-label="Turn count">
              <button
                class="popover-pill float-pill"
                class:active={isFloat}
                role="radio"
                aria-checked={isFloat}
                aria-label="Float (negative half turn, shifts only)"
                onclick={() => selectTurn(FLOAT_TURN)}
              >
                fl
              </button>
              {#each TURN_OPTIONS as t}
                <button
                  class="popover-pill"
                  class:active={builderState.turnCount === t}
                  role="radio"
                  aria-checked={builderState.turnCount === t}
                  aria-label={turnAriaLabel(t)}
                  onclick={() => selectTurn(t)}
                >
                  {t}
                </button>
              {/each}
            </div>
          </div>
        {/if}
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
      aria-label="Switch hand (Blue: {builderState.blueSteps.length}, Red: {builderState.redSteps.length})"
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
    <div class="action-slot" class:visible={showActions || canSaveSoloProp} class:dimmed={actionsDimmed}>
      {#if canSaveSoloProp}
        <button
          class="action-btn solo-save-btn"
          onclick={handleSaveSoloProp}
          disabled={isSavingSoloProp}
          aria-label="Save solo prop"
        >
          <i class="fas fa-download" aria-hidden="true"></i>
          <span>{isSavingSoloProp ? "Saving..." : "Save Solo"}</span>
        </button>
      {/if}

      {#if builderState.canFinishHand}
        <button
          class="action-btn complete-btn"
          onclick={() => builderState.finishHand()}
          aria-label="Complete sequence"
        >
          <i class="fas fa-check" aria-hidden="true"></i>
          <span>Complete</span>
        </button>
      {/if}

      {#if isComplete}
        <button
          class="action-btn new-btn"
          onclick={() => builderState.reset()}
          aria-label="Start new sequence"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
          <span>New</span>
        </button>
      {/if}
    </div>
  </div>
</div>

<!-- Action row: below the grid on desktop only -->
<div class="action-row" class:visible={showActions || canSaveSoloProp} class:dimmed={actionsDimmed} style="--hand-color: {handColor}">
  {#if canSaveSoloProp}
    <button
      class="action-btn solo-save-btn"
      onclick={handleSaveSoloProp}
      disabled={isSavingSoloProp}
      aria-label="Save solo prop"
    >
      <i class="fas fa-download" aria-hidden="true"></i>
      <span>{isSavingSoloProp ? "Saving..." : "Save Solo"}</span>
    </button>
  {/if}

  {#if builderState.canFinishHand}
    <button
      class="action-btn complete-btn"
      onclick={() => builderState.finishHand()}
      aria-label="Complete sequence"
    >
      <i class="fas fa-check" aria-hidden="true"></i>
      <span>Complete</span>
    </button>
  {/if}

  {#if isComplete}
    <button
      class="action-btn new-btn"
      onclick={() => builderState.reset()}
      aria-label="Start new sequence"
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
      <span>New</span>
    </button>
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
    justify-content: center;
    align-items: flex-start;
    /* Position at ~30% from top - midpoint between top dot and grid edge */
    padding-top: 2%;
    pointer-events: none;
  }

  @media (max-width: 768px) {
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

  /* ── Top-left control area (turn/orientation trigger on mobile) ── */
  .top-left-control {
    display: none;
    position: absolute;
    top: 8px;
    left: 8px;
    pointer-events: auto;
    z-index: 10;
  }

  @media (max-width: 768px) {
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
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .popover-panel {
    position: fixed;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    padding: 6px;
    box-shadow: 0 8px 32px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    animation: popover-in 0.15s ease-out;

    width: fit-content;
    max-width: calc(100vw - 16px);
  }

  /* Turns popover: vertical layout with rotation toggle on top, grid below */
  .popover-panel.turns-popover {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 10px;
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

  .popover-rotation {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    border: none;
    border-radius: 10px;
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.1));
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    flex-shrink: 0;
    transition: background 0.15s ease;
  }

  .popover-rotation:hover:not(:disabled) {
    background: var(--theme-accent-hover, rgba(99, 102, 241, 0.15));
  }

  .popover-rotation.dimmed {
    opacity: 0.35;
    cursor: default;
  }

  .popover-rotation i {
    font-size: 14px;
    transition: transform 0.2s ease;
  }

  .popover-rotation i.flipped {
    transform: scaleX(-1);
  }

  .popover-pills {
    display: flex;
    gap: 2px;
  }

  .help-btn {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 50%;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .help-btn:hover {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.08));
    color: var(--theme-text, #fff);
  }

  .help-btn:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  /* 4-column grid for turn values - fits any screen width */
  .turns-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .popover-pill {
    padding: 8px 10px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .popover-pill:hover {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.08));
    color: var(--theme-text, #fff);
  }

  .popover-pill.float-pill {
    font-style: italic;
    letter-spacing: 0.02em;
  }

  .popover-pill.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
    border: 1.5px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
  }

  /* ── Bottom bar (mobile only) ── */
  .bottom-bar {
    display: none;
    justify-content: space-between;
    align-items: flex-end;
    pointer-events: none;
  }

  @media (max-width: 768px) {
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
    transition: opacity 0.2s ease, border-color 0.2s ease;
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
    transition: background 0.15s ease, color 0.15s ease;
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
    animation: toggle-pulse-red 2s ease-in-out infinite;
  }

  .hand-toggle.needs-attention-blue {
    animation: toggle-pulse-blue 2s ease-in-out infinite;
  }

  @keyframes toggle-pulse-red {
    0%, 100% {
      border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
    50% {
      border-color: color-mix(in srgb, var(--prop-red, #ed1c24) 60%, transparent);
      box-shadow: 0 0 12px 0 color-mix(in srgb, var(--prop-red, #ed1c24) 20%, transparent);
    }
  }

  @keyframes toggle-pulse-blue {
    0%, 100% {
      border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
    50% {
      border-color: color-mix(in srgb, var(--prop-blue, #2e8bf0) 60%, transparent);
      box-shadow: 0 0 12px 0 color-mix(in srgb, var(--prop-blue, #2e8bf0) 20%, transparent);
    }
  }

  /* ── Action slot (mobile) ── */
  .action-slot {
    display: none;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  @media (max-width: 768px) {
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
    gap: 8px;
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

  @media (max-width: 768px) {
    .action-row {
      display: none;
    }
  }

  /* ── Action buttons (shared) ── */
  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease;
  }

  .action-btn i {
    font-size: 12px;
  }

  .complete-btn {
    border: 1.5px solid var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: var(--theme-text, #fff);
  }

  .complete-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .new-btn {
    border: 1.5px solid var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: var(--theme-text, #fff);
  }

  .new-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .solo-save-btn {
    border: 1.5px solid var(--semantic-success, #10b981);
    background: color-mix(in srgb, var(--semantic-success, #10b981) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: var(--theme-text, #fff);
  }

  .solo-save-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-success, #10b981) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .solo-save-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  @media (max-width: 768px) {
    .action-slot .action-btn {
      background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
      box-shadow: 0 4px 16px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    }
  }

  /* === Focus indicators === */
  .popover-pill:focus-visible,
  .popover-rotation:focus-visible,
  .inline-trigger:focus-visible,
  .hand-toggle:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 3px;
  }

  /* === Reduced motion === */
  @media (prefers-reduced-motion: reduce) {
    .action-row,
    .action-btn,
    .inline-trigger,
    .inline-trigger i,
    .popover-rotation i,
    .hand-toggle,
    .toggle-side,
    .toggle-dot {
      transition: none;
    }

    .popover-panel {
      animation: none;
    }

    .hand-toggle.needs-attention-red,
    .hand-toggle.needs-attention-blue {
      animation: none;
      border-color: var(--theme-accent, #6366f1);
    }
  }

</style>
