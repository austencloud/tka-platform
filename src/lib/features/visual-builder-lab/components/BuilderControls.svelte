<!--
  BuilderControls.svelte - Corner cluster overlay for the visual builder

  Three clusters positioned absolutely over the grid:
  - Top-left: phase instruction + orientation picker
  - Bottom-left: rotation direction + turn count
  - Bottom-right: undo, done/new, trash

  Controls are ALWAYS rendered. Never destroyed. Phase changes only affect
  opacity and pointer-events, so the grid never shifts.
-->
<script lang="ts">
  import {
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const handLabel = $derived(
    builderState.activeHand === MotionColor.BLUE ? "Blue" : "Red"
  );

  const handColor = $derived(
    builderState.activeHand === MotionColor.BLUE
      ? "var(--prop-blue, #2e8bf0)"
      : "var(--prop-red, #ed1c24)"
  );

  const phaseMessage = $derived.by(() => {
    switch (builderState.phase) {
      case "idle": return `Place ${handLabel.toLowerCase()} prop`;
      case "placing": return `Click destination for ${handLabel.toLowerCase()}`;
      case "building":
      case "animating": return "Click next point or Done";
      case "done": return `${handLabel} path locked`;
      case "complete": return "Sequence complete";
      default: return "";
    }
  });

  // Visibility/state derivations — controls never unmount, only dim or hide
  const isAnimating = $derived(builderState.phase === "animating");
  const isActive = $derived(
    builderState.phase === "placing" || builderState.phase === "building"
  );
  const isComplete = $derived(builderState.phase === "complete");
  const isDonePhase = $derived(builderState.phase === "done");
  const isIdle = $derived(builderState.phase === "idle");

  const showOrientation = $derived(builderState.phase === "placing");
  const motionEnabled = $derived(isActive);
  const motionDimmed = $derived(isAnimating || isIdle || isDonePhase);
  const motionHidden = $derived(isComplete);

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "In", ariaLabel: "In orientation" },
    { value: Orientation.OUT, label: "Out", ariaLabel: "Out orientation" },
    { value: Orientation.CLOCK, label: "CW", ariaLabel: "Clockwise orientation" },
    { value: Orientation.COUNTER, label: "CCW", ariaLabel: "Counter-clockwise orientation" },
  ] as const;

  const TURN_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

  function turnAriaLabel(t: number): string {
    if (t === 0) return "No turns";
    if (t === 0.5) return "Half turn";
    if (t === 1) return "1 turn";
    if (t === 1.5) return "1 and a half turns";
    if (t === 2) return "2 turns";
    if (t === 2.5) return "2 and a half turns";
    if (t === 3) return "3 turns";
    return `${t} turns`;
  }

  function toggleRotation(): void {
    const next = builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
    builderState.setRotationDirection(next);
  }

  const rotLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE ? "CW" : "CCW"
  );

  const rotAriaLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? "Rotation direction: Clockwise"
      : "Rotation direction: Counter-clockwise"
  );

  const isFlipped = $derived(
    builderState.rotationDirection === RotationDirection.COUNTER_CLOCKWISE
  );
</script>

<div class="controls-overlay" style="--hand-color: {handColor}">
  <!-- TOP-LEFT: Instruction badge + orientation pills -->
  <div class="cluster top-left">
    <div class="instruction-badge" aria-live="polite" aria-atomic="true">
      <span class="hand-dot" aria-hidden="true"></span>
      <span class="instruction-text">{phaseMessage}</span>
    </div>

    <div class="ori-row" class:visible={showOrientation}>
      <div class="pill-group" role="radiogroup" aria-label="Starting orientation">
        {#each ORIENTATIONS as ori}
          <button
            class="pill"
            class:active={builderState.currentOrientation === ori.value}
            role="radio"
            aria-checked={builderState.currentOrientation === ori.value}
            aria-label={ori.ariaLabel}
            disabled={!showOrientation}
            onclick={() => builderState.setOrientation(ori.value)}
          >
            {ori.label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- BOTTOM-LEFT: Rotation + turns -->
  <div
    class="cluster bottom-left"
    class:dimmed={motionDimmed}
    class:hidden-cluster={motionHidden}
  >
    <div class="motion-card">
      <button
        class="rotation-toggle"
        onclick={toggleRotation}
        disabled={!motionEnabled}
        aria-disabled={!motionEnabled}
        aria-label={rotAriaLabel}
      >
        <i class="fas fa-rotate-right" class:flipped={isFlipped} aria-hidden="true"></i>
        <span class="rot-label">{rotLabel}</span>
      </button>

      <div class="divider" aria-hidden="true"></div>

      <div class="turns-strip" role="radiogroup" aria-label="Turn count">
        {#each TURN_OPTIONS as t}
          <button
            class="turn-pill"
            class:active={builderState.turnCount === t}
            role="radio"
            aria-checked={builderState.turnCount === t}
            aria-label={turnAriaLabel(t)}
            disabled={!motionEnabled}
            aria-disabled={!motionEnabled}
            onclick={() => builderState.setTurnCount(t)}
          >
            {t}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- BOTTOM-RIGHT: Actions -->
  <div class="cluster bottom-right">
    <!-- Undo -->
    <button
      class="action-icon undo"
      class:visible={builderState.canUndo && !isAnimating}
      class:dimmed={isAnimating && builderState.canUndo}
      onclick={() => builderState.undoStep()}
      disabled={!builderState.canUndo || isAnimating}
      aria-disabled={!builderState.canUndo || isAnimating}
      aria-label="Undo last step"
    >
      <i class="fas fa-undo" aria-hidden="true"></i>
    </button>

    <!-- Done with hand -->
    <button
      class="done-btn"
      class:visible={builderState.canFinishHand && !isAnimating}
      class:dimmed={isAnimating && builderState.canFinishHand}
      onclick={() => builderState.finishHand()}
      disabled={!builderState.canFinishHand || isAnimating}
      aria-disabled={!builderState.canFinishHand || isAnimating}
      aria-label="Done with {handLabel.toLowerCase()} hand"
    >
      <i class="fas fa-check" aria-hidden="true"></i>
      <span>Done</span>
    </button>

    <!-- New Sequence (complete phase) -->
    <button
      class="new-btn"
      class:visible={isComplete}
      onclick={() => builderState.reset()}
      disabled={!isComplete}
      aria-disabled={!isComplete}
      aria-label="Start new sequence"
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
      <span>New</span>
    </button>

    <!-- Trash / reset -->
    <button
      class="action-icon trash"
      class:visible={builderState.stepCount > 0 && !isComplete && !isAnimating}
      class:dimmed={isAnimating && builderState.stepCount > 0}
      onclick={() => builderState.reset()}
      disabled={builderState.stepCount === 0 || isComplete || isAnimating}
      aria-disabled={builderState.stepCount === 0 || isComplete || isAnimating}
      aria-label="Reset all"
    >
      <i class="fas fa-trash-alt" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  /* === Overlay container — covers grid, passes clicks through === */
  .controls-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    padding: 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* === Corner clusters === */
  .cluster {
    display: flex;
    pointer-events: none;
  }

  .cluster.top-left {
    align-self: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .cluster.bottom-left {
    align-self: flex-start;
    transition: opacity 0.2s ease;
  }

  .cluster.bottom-right {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .cluster.dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  .cluster.hidden-cluster {
    opacity: 0;
    pointer-events: none;
  }

  /* === Instruction badge (top-left) === */
  .instruction-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    pointer-events: auto;
  }

  .hand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--hand-color);
    flex-shrink: 0;
    box-shadow: 0 0 6px color-mix(in srgb, var(--hand-color) 50%, transparent);
  }

  .instruction-text {
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  /* === Orientation row (top-left, under instruction) === */
  .ori-row {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .ori-row.visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  /* === Shared pill styles === */
  .pill-group {
    display: flex;
    gap: 2px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 3px;
  }

  .pill {
    padding: 6px 12px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    min-height: 48px;
    min-width: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .pill:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }

  .pill.active {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .pill:disabled {
    cursor: default;
  }

  /* === Motion card (bottom-left) === */
  .motion-card {
    display: flex;
    align-items: center;
    gap: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 3px;
    pointer-events: auto;
  }

  .rotation-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    min-height: 48px;
    transition: background 0.15s ease;
  }

  .rotation-toggle:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
  }

  .rotation-toggle:disabled {
    cursor: default;
  }

  .rotation-toggle i {
    font-size: 13px;
    transition: transform 0.2s ease;
  }

  .rotation-toggle i.flipped {
    transform: scaleX(-1);
  }

  .rot-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.7);
  }

  .divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 2px;
    flex-shrink: 0;
  }

  .turns-strip {
    display: flex;
    gap: 1px;
  }

  .turn-pill {
    padding: 6px 8px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    min-height: 48px;
    min-width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .turn-pill:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }

  .turn-pill.active {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .turn-pill:disabled {
    cursor: default;
  }

  /* === Action buttons (bottom-right) === */
  .action-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease,
      border-color 0.15s ease, color 0.15s ease;
  }

  .action-icon.visible {
    pointer-events: auto;
    opacity: 1;
    transform: scale(1);
  }

  .action-icon.dimmed {
    pointer-events: none;
    opacity: 0.3;
    transform: scale(1);
  }

  .action-icon:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .action-icon.trash:hover:not(:disabled) {
    border-color: var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
    background: rgba(239, 68, 68, 0.1);
  }

  /* Done button — pill shape with hand color accent */
  .done-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    border: 1.5px solid var(--hand-color);
    background: color-mix(in srgb, var(--hand-color) 15%, rgba(0, 0, 0, 0.6));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
    pointer-events: none;
    opacity: 0;
    transform: scale(0.9);
    transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease;
  }

  .done-btn.visible {
    pointer-events: auto;
    opacity: 1;
    transform: scale(1);
  }

  .done-btn.dimmed {
    pointer-events: none;
    opacity: 0.3;
    transform: scale(1);
  }

  .done-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--hand-color) 30%, rgba(0, 0, 0, 0.6));
  }

  .done-btn i {
    font-size: 12px;
  }

  /* New sequence button */
  .new-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    border: 1.5px solid var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, rgba(0, 0, 0, 0.6));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
    pointer-events: none;
    opacity: 0;
    transform: scale(0.9);
    transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease;
  }

  .new-btn.visible {
    pointer-events: auto;
    opacity: 1;
    transform: scale(1);
  }

  .new-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, rgba(0, 0, 0, 0.6));
  }

  .new-btn i {
    font-size: 12px;
  }

  /* === Focus indicators — white ring for high contrast against dark overlay === */
  .pill:focus-visible,
  .turn-pill:focus-visible,
  .rotation-toggle:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }

  .action-icon:focus-visible,
  .done-btn:focus-visible,
  .new-btn:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 3px;
  }

  /* === Reduced motion === */
  @media (prefers-reduced-motion: reduce) {
    .ori-row,
    .cluster.bottom-left,
    .action-icon,
    .done-btn,
    .new-btn,
    .pill,
    .turn-pill,
    .rotation-toggle,
    .rotation-toggle i {
      transition: none;
    }
  }

  /* === Mobile === */
  @media (max-width: 768px) {
    .controls-overlay {
      padding: 8px;
    }

    .cluster.bottom-right {
      bottom: 8px;
      right: 8px;
    }

    .motion-card {
      padding: 2px;
    }

    .turn-pill {
      padding: 5px 6px;
      min-width: 40px;
    }

    .rotation-toggle {
      padding: 5px 10px;
    }
  }
</style>
