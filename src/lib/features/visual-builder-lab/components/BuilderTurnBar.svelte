<!--
  BuilderTurnBar.svelte - Turn count and rotation direction selector.

  Renders as a card below the grid with bubbly pill buttons.
  On mobile, becomes a semi-transparent overlay with horizontal scrolling.
  Dimmed during idle/animating, hidden when sequence is complete.
-->
<script lang="ts">
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const isActive = $derived(
    builderState.phase === "placing" || builderState.phase === "building"
  );
  const isAnimating = $derived(builderState.phase === "animating");
  const isDonePhase = $derived(builderState.phase === "done");
  const isIdle = $derived(builderState.phase === "idle");
  const isComplete = $derived(builderState.phase === "complete");

  const motionEnabled = $derived(isActive);
  const motionDimmed = $derived(isAnimating || isIdle || isDonePhase);
  const motionHidden = $derived(isComplete);

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

<div
  class="turn-bar-card"
  class:dimmed={motionDimmed}
  class:hidden-bar={motionHidden}
>
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

<style>
  .turn-bar-card {
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    padding: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
    transition: opacity 0.2s ease;
  }

  .turn-bar-card.dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  .turn-bar-card.hidden-bar {
    opacity: 0;
    pointer-events: none;
  }

  .rotation-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.1));
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease;
    flex-shrink: 0;
  }

  .rotation-toggle:hover:not(:disabled) {
    background: var(--theme-accent-hover, rgba(99, 102, 241, 0.15));
  }

  .rotation-toggle:disabled {
    cursor: default;
  }

  .rotation-toggle i {
    font-size: 14px;
    transition: transform 0.2s ease;
  }

  .rotation-toggle i.flipped {
    transform: scaleX(-1);
  }

  .rot-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--theme-accent, #6366f1);
  }

  .divider {
    width: 1px;
    height: 28px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 0 6px;
    flex-shrink: 0;
  }

  .turns-strip {
    display: flex;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .turns-strip::-webkit-scrollbar {
    display: none;
  }

  .turn-pill {
    flex: 0 0 auto;
    padding: 10px 10px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    min-width: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .turn-pill:hover:not(:disabled) {
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.08));
    color: var(--theme-text, #fff);
  }

  .turn-pill.active {
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
    border: 1.5px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
  }

  .turn-pill:disabled {
    cursor: default;
  }

  /* ── Mobile: semi-transparent overlay style ── */
  @media (max-width: 768px) {
    .turn-bar-card {
      background: rgba(10, 12, 22, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-color: rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 4px 6px;
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.3);
    }

    .rotation-toggle {
      padding: 8px 10px;
      min-height: 40px;
    }

    .turn-pill {
      min-height: 40px;
      min-width: 40px;
      padding: 8px 8px;
    }

    .divider {
      height: 24px;
      margin: 0 4px;
    }
  }

  /* Focus indicators */
  .turn-pill:focus-visible,
  .rotation-toggle:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .turn-bar-card,
    .turn-pill,
    .rotation-toggle,
    .rotation-toggle i {
      transition: none;
    }
  }
</style>
