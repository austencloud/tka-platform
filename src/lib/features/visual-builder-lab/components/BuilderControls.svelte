<!--
  BuilderControls.svelte - Context-sensitive overlay controls for the visual builder.

  Bottom-left trigger (mobile only):
    - "placing" phase → orientation popover (In/Out/CW/CCW)
    - "building" phase → turns popover (rotation direction + turn count)
  Top-left orientation pills shown on desktop only.
  Action row (Next:Red / Complete / Back / New) below grid on desktop,
  overlaid bottom-right on mobile.
-->
<script lang="ts">
  import {
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const handColor = $derived(
    builderState.activeHand === MotionColor.BLUE
      ? "var(--prop-blue, #2e8bf0)"
      : "var(--prop-red, #ed1c24)"
  );

  const isAnimating = $derived(builderState.phase === "animating");
  const isComplete = $derived(builderState.phase === "complete");
  const isPlacing = $derived(builderState.phase === "placing");
  const isBuilding = $derived(builderState.phase === "building");
  const isBlueHand = $derived(builderState.activeHand === MotionColor.BLUE);

  // Show action row when there's a relevant action to take.
  // Keep visible during animation (dimmed) to prevent layout shift.
  const showActions = $derived(
    builderState.canFinishHand ||
    builderState.canGoBack ||
    isComplete
  );

  // Dim action row during animation — buttons stay in place but look inactive
  const actionsDimmed = $derived(isAnimating);

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "In", ariaLabel: "In orientation" },
    { value: Orientation.OUT, label: "Out", ariaLabel: "Out orientation" },
    { value: Orientation.CLOCK, label: "CW", ariaLabel: "Clockwise orientation" },
    { value: Orientation.COUNTER, label: "CCW", ariaLabel: "Counter-clockwise orientation" },
  ] as const;

  // ── Orientation popover state ──
  let oriPopoverOpen = $state(false);

  const currentOriLabel = $derived(
    ORIENTATIONS.find(o => o.value === builderState.currentOrientation)?.label ?? "In"
  );

  function selectOrientation(ori: Orientation): void {
    builderState.setOrientation(ori);
    oriPopoverOpen = false;
  }

  // ── Turns popover state ──
  let turnsPopoverOpen = $state(false);

  const TURN_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

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

  const triggerLabel = $derived(
    `${rotLabel} ${builderState.turnCount}`
  );

  // Close any open popover when phase changes
  $effect(() => {
    // Read phase to track it
    const _phase = builderState.phase;
    oriPopoverOpen = false;
    turnsPopoverOpen = false;
  });
</script>

<!-- Grid overlay -->
<div class="controls-overlay">
  <!-- Spacer for top (desktop ori-row removed — now in BuilderTurnBar) -->
  <div></div>

  <!-- Bottom-left: context-sensitive trigger (mobile only) -->
  <div class="bottom-trigger-area">
    <!-- Orientation trigger: during placing phase -->
    {#if isPlacing}
      <div class="trigger-wrapper visible">
        <button
          class="compact-trigger"
          onclick={() => { oriPopoverOpen = !oriPopoverOpen; }}
          aria-label="Orientation: {currentOriLabel}"
          aria-expanded={oriPopoverOpen}
        >
          <i class="fas fa-compass" aria-hidden="true"></i>
          <span class="trigger-text">{currentOriLabel}</span>
        </button>

        {#if oriPopoverOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="popover-backdrop"
            onclick={() => { oriPopoverOpen = false; }}
            onkeydown={() => {}}
            role="presentation"
          ></div>

          <div class="popover-panel" role="dialog" aria-label="Starting orientation">
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
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Turns trigger: during building phase -->
    {#if isBuilding}
      <div class="trigger-wrapper visible">
        <button
          class="compact-trigger"
          onclick={() => { turnsPopoverOpen = !turnsPopoverOpen; }}
          aria-label="Turn settings: {triggerLabel}"
          aria-expanded={turnsPopoverOpen}
        >
          <i class="fas fa-rotate-right" class:flipped={isFlipped} aria-hidden="true"></i>
          <span class="trigger-text">{triggerLabel}</span>
        </button>

        {#if turnsPopoverOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="popover-backdrop"
            onclick={() => { turnsPopoverOpen = false; }}
            onkeydown={() => {}}
            role="presentation"
          ></div>

          <div class="popover-panel" role="dialog" aria-label="Turn count and rotation direction">
            <button
              class="popover-rotation"
              onclick={toggleRotation}
              aria-label="Toggle rotation direction"
            >
              <i class="fas fa-rotate-right" class:flipped={isFlipped} aria-hidden="true"></i>
              <span>{rotLabel}</span>
            </button>

            <div class="popover-divider" aria-hidden="true"></div>

            <div class="popover-pills" role="radiogroup" aria-label="Turn count">
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
</div>

<!-- Action row: below the grid, full-width -->
<div class="action-row" class:visible={showActions} class:dimmed={actionsDimmed} style="--hand-color: {handColor}">
  {#if builderState.canGoBack}
    <button
      class="action-btn back-btn"
      onclick={() => builderState.goBackToBlue()}
      aria-label="Go back to blue hand"
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
      <span>Back</span>
    </button>
  {/if}

  {#if builderState.canFinishHand && isBlueHand}
    <button
      class="action-btn done-btn"
      onclick={() => builderState.finishHand()}
      aria-label="Finish blue hand and start red"
    >
      <span>Next: Red</span>
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  {/if}

  {#if builderState.canFinishHand && !isBlueHand}
    <button
      class="action-btn done-btn red-done"
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

  /* ── Bottom-left trigger area (mobile only) ── */
  .bottom-trigger-area {
    align-self: flex-start;
    /* Hidden on desktop — full turn bar / pill bar handles it */
    display: none;
  }

  @media (max-width: 768px) {
    .bottom-trigger-area {
      display: block;
    }
  }

  .trigger-wrapper {
    position: relative;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .trigger-wrapper.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .compact-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1.5px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
    border-radius: 12px;
    background: rgba(10, 12, 22, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .compact-trigger:hover {
    background: rgba(99, 102, 241, 0.12);
    border-color: var(--theme-accent, #6366f1);
  }

  .compact-trigger i {
    font-size: 14px;
    transition: transform 0.2s ease;
  }

  .compact-trigger i.flipped {
    transform: scaleX(-1);
  }

  .trigger-text {
    letter-spacing: 0.03em;
  }

  /* Popover backdrop — full-screen tap-to-close */
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  /* Shared popover panel — anchored above the trigger */
  .popover-panel {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0;
    background: rgba(10, 12, 22, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: popover-in 0.15s ease-out;
  }

  @keyframes popover-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .popover-rotation {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
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

  .popover-rotation:hover {
    background: var(--theme-accent-hover, rgba(99, 102, 241, 0.15));
  }

  .popover-rotation i {
    font-size: 14px;
    transition: transform 0.2s ease;
  }

  .popover-rotation i.flipped {
    transform: scaleX(-1);
  }

  .popover-divider {
    width: 1px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 4px;
    flex-shrink: 0;
  }

  .popover-pills {
    display: flex;
    gap: 2px;
  }

  .popover-pill {
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

  .popover-pill:hover {
    background: rgba(99, 102, 241, 0.08);
    color: var(--theme-text, #fff);
  }

  .popover-pill.active {
    background: rgba(99, 102, 241, 0.12);
    color: var(--theme-accent, #6366f1);
    border: 1.5px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
  }

  /* === Action row — below the grid, full-width === */
  .action-row {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 6px 0;
    flex-shrink: 0;
    opacity: 0;
    pointer-events: none;
    /* Always reserve space to prevent layout shift */
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

  /* Mobile: overlay the action row on the grid, bottom-right corner */
  @media (max-width: 768px) {
    .action-row {
      position: absolute;
      bottom: 12px;
      right: 12px;
      left: auto;
      z-index: 10;
      padding: 0;
      min-height: 0; /* No space reservation needed — absolute positioned */
    }

    .action-btn {
      background: rgba(10, 12, 22, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }
  }

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

  .done-btn {
    border: 1.5px solid var(--hand-color);
    background: color-mix(in srgb, var(--hand-color) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: #fff;
  }

  .done-btn:hover {
    background: color-mix(in srgb, var(--hand-color) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .done-btn.red-done {
    border-color: var(--prop-red, #ed1c24);
    background: color-mix(in srgb, var(--prop-red, #ed1c24) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .done-btn.red-done:hover {
    background: color-mix(in srgb, var(--prop-red, #ed1c24) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .back-btn {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.5));
    color: rgba(255, 255, 255, 0.8);
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .new-btn {
    border: 1.5px solid var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: #fff;
  }

  .new-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  /* === Focus indicators === */
  .popover-pill:focus-visible,
  .popover-rotation:focus-visible,
  .compact-trigger:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }

  .action-btn:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 3px;
  }

  /* === Reduced motion === */
  @media (prefers-reduced-motion: reduce) {
    .action-row,
    .action-btn,
    .compact-trigger,
    .trigger-wrapper,
    .compact-trigger i,
    .popover-rotation i {
      transition: none;
    }

    .popover-panel {
      animation: none;
    }
  }
</style>
