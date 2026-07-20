<!--
  BuilderInstructionHeader.svelte - Phase instruction and hand switcher above the grid.

  Shows the active hand's color dot, phase-specific instruction text,
  and a blue/red hand switcher on desktop so users can freely switch
  between hands while building.
  On mobile, renders as a compact semi-transparent overlay (switcher hidden;
  mobile uses the hand buttons on the grid canvas in BuilderControls).
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import GridModePicker from "./GridModePicker.svelte";
  import { getBuilderPhaseInstruction } from "../services/builder-phase-presentation";

  let { builderState }: { builderState: AssembleState } = $props();

  const isBlueHand = $derived(builderState.activeHand === MotionColor.BLUE);

  const handColor = $derived(
    isBlueHand ? "var(--prop-blue, #2e8bf0)" : "var(--prop-red, #ed1c24)"
  );

  const otherHandLabel = $derived(isBlueHand ? "Red" : "Blue");
  const otherHandSteps = $derived(
    isBlueHand ? builderState.redSteps.length : builderState.blueSteps.length
  );
  const activeStepCount = $derived(
    isBlueHand ? builderState.blueSteps.length : builderState.redSteps.length
  );

  const phaseMessage = $derived(getBuilderPhaseInstruction(builderState.phase));

  // Contextual hint about the other hand - shown below the main instruction
  const otherHandHint = $derived.by(() => {
    if (builderState.phase === "complete" || builderState.phase === "idle")
      return "";
    if (otherHandSteps === 0 && activeStepCount > 0) {
      return `Switch to ${otherHandLabel} when ready`;
    }
    if (otherHandSteps > 0 && activeStepCount !== otherHandSteps) {
      const diff = Math.abs(activeStepCount - otherHandSteps);
      if (activeStepCount > otherHandSteps) {
        return `${otherHandLabel} needs ${diff} more step${diff > 1 ? "s" : ""} to match`;
      }
    }
    return "";
  });

  // Hand switcher: always rendered to reserve space (prevents layout shift).
  // Hidden on complete or when both hands are empty.
  const switcherHidden = $derived(
    builderState.phase === "complete" ||
      (builderState.blueSteps.length === 0 &&
        builderState.redSteps.length === 0)
  );

  // Pulse the inactive hand's button when it has no steps yet
  const blueNeedsAttention = $derived(
    !isBlueHand && builderState.blueSteps.length === 0
  );
  const redNeedsAttention = $derived(
    isBlueHand && builderState.redSteps.length === 0
  );

  function switchToBlue(): void {
    builderState.switchToHand(MotionColor.BLUE);
  }

  function switchToRed(): void {
    builderState.switchToHand(MotionColor.RED);
  }
</script>

<div class="instruction-header" aria-live="polite" aria-atomic="true">
  <div class="step-title">
    <span
      class="hand-dot-glow"
      style="--dot-color: {handColor}"
      aria-hidden="true"
    ></span>
    <span class="step-text">{phaseMessage}</span>
  </div>

  <span class="other-hand-hint" class:hint-hidden={!otherHandHint}>
    {otherHandHint || "\u00A0"}
  </span>

  {#if builderState.canChangeGridMode}
    <GridModePicker
      gridMode={builderState.gridMode}
      showCenter={builderState.showCenter}
      disabled={!builderState.canChangeGridMode}
      onGridModeChange={(mode) => builderState.setGridMode(mode)}
      onCenterChange={(show) => builderState.setShowCenter(show)}
    />
  {/if}

  <div
    class="hand-switcher"
    class:switcher-hidden={switcherHidden}
    role="radiogroup"
    aria-label="Active hand"
    aria-hidden={switcherHidden}
  >
    <button
      class="hand-switch-btn"
      class:active={isBlueHand}
      class:needs-attention={blueNeedsAttention}
      style="--btn-color: var(--prop-blue, #2e8bf0)"
      role="radio"
      aria-checked={isBlueHand}
      aria-label="Switch to blue hand ({builderState.blueSteps.length} steps)"
      tabindex={switcherHidden ? -1 : 0}
      onclick={switchToBlue}
    >
      <span class="hand-dot" aria-hidden="true"></span>
      <span class="hand-label">Blue</span>
      <span class="step-count">{builderState.blueSteps.length}</span>
    </button>
    <button
      class="hand-switch-btn"
      class:active={!isBlueHand}
      class:needs-attention={redNeedsAttention}
      style="--btn-color: var(--prop-red, #ed1c24)"
      role="radio"
      aria-checked={!isBlueHand}
      aria-label="Switch to red hand ({builderState.redSteps.length} steps)"
      tabindex={switcherHidden ? -1 : 0}
      onclick={switchToRed}
    >
      <span class="hand-dot" aria-hidden="true"></span>
      <span class="hand-label">Red</span>
      <span class="step-count">{builderState.redSteps.length}</span>
    </button>
  </div>

  <div class="keyboard-toggle">
    <FilterChipBase
      label="Keyboard"
      icon="fas fa-keyboard"
      mode="toggle"
      size="sm"
      active={builderState.keyboardMode}
      onclick={() => builderState.toggleKeyboardMode()}
    />
  </div>
</div>

<style>
  .instruction-header {
    width: 100%;
    padding: 12px 16px 8px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .other-hand-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-weight: 500;
    letter-spacing: 0.02em;
    min-height: 1.2em;
    transition: opacity 0.15s ease;
  }

  .other-hand-hint.hint-hidden {
    opacity: 0;
  }

  .step-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: clamp(1rem, 2.5vmin, 1.25rem);
    font-weight: 500;
    color: var(--theme-text, #fff);
    letter-spacing: 0.02em;
  }

  .hand-dot-glow {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--dot-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--dot-color) 60%, transparent);
    flex-shrink: 0;
  }

  /* ── Hand switcher (desktop only) ── */
  .hand-switcher {
    display: flex;
    gap: 4px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.4));
    padding: 3px;
    transition: opacity 0.15s ease;
  }

  .hand-switcher.switcher-hidden {
    opacity: 0;
    pointer-events: none;
  }

  .hand-switch-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 1.5px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .hand-switch-btn:hover {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .hand-switch-btn.active {
    color: var(--theme-text, #fff);
    background: color-mix(in srgb, var(--btn-color) 15%, transparent);
    border-color: color-mix(in srgb, var(--btn-color) 40%, transparent);
  }

  .hand-switch-btn .hand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--btn-color);
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }

  .hand-switch-btn.active .hand-dot {
    opacity: 1;
    box-shadow: 0 0 6px color-mix(in srgb, var(--btn-color) 50%, transparent);
  }

  .step-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .hand-switch-btn.active .step-count {
    background: color-mix(in srgb, var(--btn-color) 25%, transparent);
    color: var(--theme-text, #fff);
  }

  /* Inactive hand with no steps yet - pulse to invite the user to start it */
  .hand-switch-btn.needs-attention {
    border-color: color-mix(in srgb, var(--btn-color) 50%, transparent);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    animation: hand-nudge 2s ease-in-out infinite;
  }

  .hand-switch-btn.needs-attention .hand-dot {
    opacity: 0.8;
  }

  @keyframes hand-nudge {
    0%,
    100% {
      border-color: color-mix(in srgb, var(--btn-color) 30%, transparent);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--btn-color) 0%, transparent);
    }
    50% {
      border-color: var(--btn-color);
      box-shadow: 0 0 8px 0
        color-mix(in srgb, var(--btn-color) 30%, transparent);
    }
  }

  .hand-switch-btn:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  .keyboard-toggle {
    position: absolute;
    right: 16px;
    top: 12px;
  }

  /* ── Mobile: hide entirely - BuilderControls handles instruction + hand switching ── */
  @container tool-panel (max-width: 768px) {
    .instruction-header {
      display: none;
    }
  }

  @media (hover: none), (pointer: coarse) {
    .keyboard-toggle {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-dot-glow {
      box-shadow: none;
    }

    .hand-switch-btn,
    .hand-switch-btn .hand-dot {
      transition: none;
    }

    .hand-switch-btn.needs-attention {
      animation: none;
      /* Still show the border so the nudge is visible without motion */
      border-color: var(--btn-color);
    }
  }
</style>
