<!--
  BuilderTurnBar.svelte - Phase-aware control bar below the grid (desktop).

  Shows orientation pills and next-motion turn settings during "placing",
  then keeps turn count + rotation direction during "building". Stays active during animation so users
  can adjust settings for the next action. Dimmed when idle, hidden
  when sequence is complete. Hidden on mobile (replaced by popover).
-->
<script lang="ts">
  import type { AssembleState } from "../state/assemble-state.svelte";
  import BuilderMotionSettings from "./BuilderMotionSettings.svelte";
  import BuilderOrientationPicker from "./BuilderOrientationPicker.svelte";
  import OrientationExplainer from "./OrientationExplainer.svelte";
  import { getBuilderControlVisibility } from "../services/builder-phase-presentation";

  let { builderState }: { builderState: AssembleState } = $props();

  let explainerOpen = $state(false);

  const isPlacing = $derived(builderState.phase === "placing");
  const isBuilding = $derived(builderState.phase === "building");
  const isAnimating = $derived(builderState.phase === "animating");
  const isIdle = $derived(builderState.phase === "idle");
  const isComplete = $derived(builderState.phase === "complete");
  const controlVisibility = $derived(
    getBuilderControlVisibility(builderState.phase)
  );

  const barDimmed = $derived(isIdle);
  const barHidden = $derived(isComplete);

  // Track which content to show. During animating/done, keep showing whatever
  // was last active (building or placing) to prevent layout shift.
  let lastActiveContent = $state<"placing" | "building" | "idle">("idle");

  $effect(() => {
    if (isPlacing) lastActiveContent = "placing";
    else if (isBuilding) lastActiveContent = "building";
    else if (isIdle) lastActiveContent = "idle";
    // animating/done/complete: keep lastActiveContent unchanged
  });

  const showPlacing = $derived(
    controlVisibility.orientation ||
      ((barDimmed || isAnimating) && lastActiveContent === "placing")
  );
  const showBuilding = $derived(
    controlVisibility.motionSettings ||
      (barDimmed && lastActiveContent === "building")
  );
  const showPlaceholder = $derived(
    !showPlacing && !showBuilding && !isComplete
  );
</script>

<div class="control-bar" class:dimmed={barDimmed} class:hidden-bar={barHidden}>
  <!-- Placing phase: orientation pills (persists during animating/done to prevent layout shift) -->
  {#if showPlacing}
    <div class="bar-content orientation-content">
      <span class="bar-label">Orientation</span>
      <BuilderOrientationPicker
        value={builderState.currentOrientation}
        onchange={(orientation) => builderState.setOrientation(orientation)}
        onHelp={() => {
          explainerOpen = true;
        }}
      />
    </div>
  {/if}

  <!-- Rotation direction + turn count apply to the next destination click. -->
  {#if showBuilding}
    <div class="bar-content">
      <BuilderMotionSettings
        turnCount={builderState.turnCount}
        rotationDirection={builderState.rotationDirection}
        onchangeTurnCount={(turnCount) => builderState.setTurnCount(turnCount)}
        onchangeRotationDirection={(direction) =>
          builderState.setRotationDirection(direction)}
      />
    </div>
  {/if}

  <!-- Idle: empty placeholder preserves bar height -->
  {#if showPlaceholder}
    <div class="bar-content bar-placeholder">
      <span class="bar-label muted">&nbsp;</span>
    </div>
  {/if}
</div>

<OrientationExplainer bind:isOpen={explainerOpen} />

<style>
  .control-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    flex-shrink: 0;
    min-height: 48px;
    transition: opacity 0.2s ease;
  }

  .control-bar.dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  .control-bar.hidden-bar {
    opacity: 0;
    pointer-events: none;
  }

  .bar-content {
    display: flex;
    flex: 1 1 580px;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    max-width: 610px;
    min-width: 0;
  }

  .orientation-content {
    flex-basis: 390px;
    max-width: 410px;
  }

  .bar-placeholder {
    justify-content: center;
  }

  .bar-label {
    padding: 0 4px;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .bar-label.muted {
    text-transform: none;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
  }

  /* Hidden on mobile - BuilderControls popover handles it */
  @container tool-panel (max-width: 768px) {
    .control-bar {
      display: none;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-bar {
      transition: none;
    }
  }
</style>
