<!--
  BuilderTurnBar.svelte - Phase-aware control bar below the grid (desktop).

  Shows orientation pills during "placing" phase, turn count + rotation
  direction during "building" phase. Stays active during animation so users
  can adjust settings for the next action. Dimmed when idle, hidden
  when sequence is complete. Hidden on mobile (replaced by popover).
-->
<script lang="ts">
  import {
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import OrientationExplainer from "./OrientationExplainer.svelte";

  let { builderState }: { builderState: AssembleState } = $props();

  let explainerOpen = $state(false);

  const isPlacing = $derived(builderState.phase === "placing");
  const isBuilding = $derived(builderState.phase === "building");
  const isAnimating = $derived(builderState.phase === "animating");
  const isIdle = $derived(builderState.phase === "idle");
  const isComplete = $derived(builderState.phase === "complete");

  const barActive = $derived(isPlacing || isBuilding || isAnimating);
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
    isPlacing || ((barDimmed || isAnimating) && lastActiveContent === "placing")
  );
  const showBuilding = $derived(
    isBuilding || ((barDimmed || isAnimating) && lastActiveContent === "building")
  );
  const showPlaceholder = $derived(!showPlacing && !showBuilding && !isComplete);

  // ── Orientation ──
  const ORIENTATIONS = [
    { value: Orientation.IN, label: "in", ariaLabel: "in orientation" },
    { value: Orientation.OUT, label: "out", ariaLabel: "out orientation" },
    { value: Orientation.CLOCK, label: "clock", ariaLabel: "clock orientation" },
    { value: Orientation.COUNTER, label: "counter", ariaLabel: "counter orientation" },
  ] as const;

  // ── Turns ──
  const FLOAT_TURN = -0.5;
  const TURN_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;
  const isFloat = $derived(builderState.turnCount === FLOAT_TURN);

  function turnAriaLabel(t: number): string {
    if (t === 0) return "No turns";
    if (t === 0.5) return "Half turn";
    if (t === 1) return "1 turn";
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
  class="control-bar"
  class:dimmed={barDimmed}
  class:hidden-bar={barHidden}
>
  <!-- Placing phase: orientation pills (persists during animating/done to prevent layout shift) -->
  {#if showPlacing}
    <div class="bar-content" role="radiogroup" aria-label="Starting orientation">
      <span class="bar-label">Orientation</span>
      <div class="divider" aria-hidden="true"></div>
      {#each ORIENTATIONS as ori}
        <button
          class="bar-pill"
          class:active={builderState.currentOrientation === ori.value}
          role="radio"
          aria-checked={builderState.currentOrientation === ori.value}
          aria-label={ori.ariaLabel}
          onclick={() => builderState.setOrientation(ori.value)}
        >
          {ori.label}
        </button>
      {/each}
      <button
        class="help-btn"
        onclick={() => { explainerOpen = true; }}
        aria-label="Learn about orientation"
      >
        ?
      </button>
    </div>
  {/if}

  <!-- Building phase: rotation direction + turn count (persists during animating/done) -->
  {#if showBuilding}
    <div class="bar-content">
      <button
        class="rotation-toggle"
        onclick={toggleRotation}
        aria-label={rotAriaLabel}
      >
        <i class="fas fa-rotate-right" class:flipped={isFlipped} aria-hidden="true"></i>
        <span class="rot-label">{rotLabel}</span>
      </button>

      <div class="divider" aria-hidden="true"></div>

      <div class="turns-strip" role="radiogroup" aria-label="Turn count">
        <button
          class="bar-pill float-pill"
          class:active={isFloat}
          role="radio"
          aria-checked={isFloat}
          aria-label="Float (negative half turn, shifts only)"
          onclick={() => builderState.setTurnCount(FLOAT_TURN)}
        >
          fl
        </button>
        {#each TURN_OPTIONS as t}
          <button
            class="bar-pill"
            class:active={builderState.turnCount === t}
            role="radio"
            aria-checked={builderState.turnCount === t}
            aria-label={turnAriaLabel(t)}
            onclick={() => builderState.setTurnCount(t)}
          >
            {t}
          </button>
        {/each}
      </div>
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
    align-items: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    padding: 8px;
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
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
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

  .divider {
    width: 1px;
    height: 28px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 0 6px;
    flex-shrink: 0;
  }

  .bar-pill {
    flex: 0 0 auto;
    padding: 10px 14px;
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

  .bar-pill:hover {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.08));
    color: var(--theme-text, #fff);
  }

  .bar-pill.float-pill {
    font-style: italic;
    letter-spacing: 0.02em;
  }

  .bar-pill.active {
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
    border: 1.5px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
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

  .rotation-toggle:hover {
    background: var(--theme-accent-hover, rgba(99, 102, 241, 0.15));
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

  .turns-strip {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .turns-strip::-webkit-scrollbar {
    display: none;
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

  /* Hidden on mobile — BuilderControls popover handles it */
  @media (max-width: 768px) {
    .control-bar {
      display: none;
    }
  }

  /* Focus indicators */
  .bar-pill:focus-visible,
  .rotation-toggle:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-bar,
    .bar-pill,
    .rotation-toggle,
    .rotation-toggle i {
      transition: none;
    }
  }
</style>
