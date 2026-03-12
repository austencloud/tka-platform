<!--
  BuilderControls.svelte - Context-sensitive overlay controls for the visual builder.

  Mobile: orientation/turns trigger (top-left), blue hand (bottom-left),
  red hand (bottom-right) overlaid on the grid canvas.
  Desktop: triggers hidden (BuilderTurnBar handles it).
  Action row (Complete / New) below grid on desktop, overlaid bottom-right on mobile.
-->
<script lang="ts">
  import {
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { AssembleState } from "../state/assemble-state.svelte";

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

  // Show hand buttons once any hand has steps (or during placing/building)
  const showHandButtons = $derived(
    !isComplete && !isIdle &&
    (builderState.blueSteps.length > 0 || builderState.redSteps.length > 0 || isPlacing || isBuilding)
  );

  // Show action row when there's a relevant action to take.
  const showActions = $derived(
    builderState.canFinishHand ||
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
    `${builderState.turnCount}`
  );

  // Close any open popover when phase changes
  $effect(() => {
    const _phase = builderState.phase;
    oriPopoverOpen = false;
    turnsPopoverOpen = false;
  });

  function switchToBlue(): void {
    builderState.switchToHand(MotionColor.BLUE);
  }

  function switchToRed(): void {
    builderState.switchToHand(MotionColor.RED);
  }
</script>

<!-- Grid overlay -->
<div class="controls-overlay">
  <!-- Top-left: context-sensitive trigger (mobile only) -->
  <div class="top-trigger-area">
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

          <div class="popover-panel below" role="dialog" aria-label="Starting orientation">
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

    <!-- Turns trigger: during building/animating phase -->
    {#if isBuilding || isAnimating}
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

          <div class="popover-panel below" role="dialog" aria-label="Turn count and rotation direction">
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

  <!-- Bottom row: blue hand (left) + action (center) + red hand (right) — mobile only -->
  <div class="bottom-hand-row">
    {#if showHandButtons || showActions}
      <button
        class="hand-btn blue-hand"
        class:active={isBlueHand}
        class:hand-hidden={!showHandButtons}
        onclick={switchToBlue}
        aria-label="Switch to blue hand ({builderState.blueSteps.length} steps)"
        tabindex={showHandButtons ? 0 : -1}
      >
        <span class="hand-dot" aria-hidden="true"></span>
        {#if builderState.blueSteps.length > 0}
          <span class="hand-count">{builderState.blueSteps.length}</span>
        {/if}
      </button>

      <!-- Action button: centered between hand buttons on mobile -->
      <div class="action-slot" class:visible={showActions} class:dimmed={actionsDimmed}>
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

      <button
        class="hand-btn red-hand"
        class:active={!isBlueHand}
        class:hand-hidden={!showHandButtons}
        onclick={switchToRed}
        aria-label="Switch to red hand ({builderState.redSteps.length} steps)"
        tabindex={showHandButtons ? 0 : -1}
      >
        {#if builderState.redSteps.length > 0}
          <span class="hand-count">{builderState.redSteps.length}</span>
        {/if}
        <span class="hand-dot" aria-hidden="true"></span>
      </button>
    {/if}
  </div>
</div>

<!-- Action row: below the grid on desktop only -->
<div class="action-row" class:visible={showActions} class:dimmed={actionsDimmed} style="--hand-color: {handColor}">
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

  /* ── Top-left trigger area (mobile only) ── */
  .top-trigger-area {
    align-self: flex-start;
    display: none;
  }

  @media (max-width: 768px) {
    .top-trigger-area {
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

  /* Shared popover panel — opens below the trigger (moved to top-left) */
  .popover-panel {
    position: absolute;
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

  .popover-panel.below {
    top: calc(100% + 8px);
    left: 0;
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

  /* ── Bottom hand row (mobile only) ── */
  .bottom-hand-row {
    display: none;
    justify-content: space-between;
    align-items: flex-end;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .bottom-hand-row {
      display: flex;
    }
  }

  .hand-btn.hand-hidden {
    opacity: 0;
    pointer-events: none;
  }

  /* Action slot: centered between hand buttons on mobile */
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

  .hand-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 12px;
    border: 1.5px solid transparent;
    background: rgba(10, 12, 22, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .hand-btn .hand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity 0.15s ease;
  }

  .blue-hand .hand-dot {
    background: var(--prop-blue, #2e8bf0);
  }

  .red-hand .hand-dot {
    background: var(--prop-red, #ed1c24);
  }

  .hand-btn.active {
    border-color: color-mix(in srgb, var(--btn-color, #fff) 40%, transparent);
    background: rgba(10, 12, 22, 0.85);
    color: #fff;
  }

  .blue-hand.active {
    --btn-color: var(--prop-blue, #2e8bf0);
    border-color: color-mix(in srgb, var(--prop-blue, #2e8bf0) 40%, transparent);
  }

  .red-hand.active {
    --btn-color: var(--prop-red, #ed1c24);
    border-color: color-mix(in srgb, var(--prop-red, #ed1c24) 40%, transparent);
  }

  .hand-btn.active .hand-dot {
    opacity: 1;
    box-shadow: 0 0 8px color-mix(in srgb, var(--btn-color, #fff) 50%, transparent);
  }

  .hand-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.1);
  }

  .hand-btn.active .hand-count {
    background: color-mix(in srgb, var(--btn-color, #fff) 25%, transparent);
    color: #fff;
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

  /* Mobile: action row hidden (handled by bottom-hand-row action-slot instead) */
  @media (max-width: 768px) {
    .action-row {
      display: none;
    }
  }

  /* Mobile action buttons get overlay styling */
  @media (max-width: 768px) {
    .action-slot .action-btn {
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

  .complete-btn {
    border: 1.5px solid var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: #fff;
  }

  .complete-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
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
  .compact-trigger:focus-visible,
  .hand-btn:focus-visible {
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
    .popover-rotation i,
    .hand-btn,
    .hand-btn .hand-dot {
      transition: none;
    }

    .popover-panel {
      animation: none;
    }
  }
</style>
