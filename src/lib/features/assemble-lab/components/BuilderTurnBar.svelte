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
    gap: var(--settings-spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--settings-radius-lg, 16px);
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    padding: var(--settings-spacing-sm, 8px);
    box-shadow: 0 4px 16px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    flex-shrink: 0;
    min-height: 60px;
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
    flex: 1 1 390px;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    min-width: 0;
  }

  .orientation-content {
    max-width: 560px;
    margin: 0 auto;
  }

  .bar-placeholder {
    justify-content: center;
  }

  .bar-label {
    padding: 0 12px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
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

  @container tool-panel (min-width: 769px) and (max-width: 900px) {
    .control-bar {
      min-height: 128px;
      align-content: center;
    }

    .bar-content {
      flex: 0 0 100%;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-bar {
      transition: none;
    }
  }
</style>
