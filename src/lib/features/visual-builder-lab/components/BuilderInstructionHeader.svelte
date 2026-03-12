<!--
  BuilderInstructionHeader.svelte - Phase instruction and hand switcher above the grid.

  Shows the active hand's color dot, phase-specific instruction text,
  and a blue/red hand switcher on desktop so users can freely switch
  between hands while building.
  On mobile, renders as a compact semi-transparent overlay (switcher hidden;
  mobile uses the HandPickerButton in the ButtonPanel instead).
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const isBlueHand = $derived(builderState.activeHand === MotionColor.BLUE);

  const handColor = $derived(
    isBlueHand
      ? "var(--prop-blue, #2e8bf0)"
      : "var(--prop-red, #ed1c24)"
  );

  const phaseMessage = $derived.by(() => {
    const handLabel = isBlueHand ? "Blue" : "Red";
    switch (builderState.phase) {
      case "idle": return "Tap a starting point";
      case "placing": return "Tap destination";
      case "building":
      case "animating": return "Tap next point";
      case "done": return `${handLabel} path set`;
      case "complete": return "Sequence complete";
      default: return "";
    }
  });

  // Hand switcher: show as soon as the active hand has at least one step,
  // so the user can switch to the other hand at any time
  const showHandSwitcher = $derived(
    builderState.phase !== "complete" &&
    builderState.phase !== "animating" &&
    (builderState.blueSteps.length > 0 || builderState.redSteps.length > 0)
  );

  // Pulse the inactive hand's button when it has no steps yet
  const blueNeedsAttention = $derived(!isBlueHand && builderState.blueSteps.length === 0);
  const redNeedsAttention = $derived(isBlueHand && builderState.redSteps.length === 0);

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

  {#if showHandSwitcher}
    <div class="hand-switcher" role="radiogroup" aria-label="Active hand">
      <button
        class="hand-switch-btn"
        class:active={isBlueHand}
        class:needs-attention={blueNeedsAttention}
        style="--btn-color: var(--prop-blue, #2e8bf0)"
        role="radio"
        aria-checked={isBlueHand}
        aria-label="Switch to blue hand"
        onclick={switchToBlue}
      >
        <span class="hand-dot" aria-hidden="true"></span>
        <span class="hand-label">Blue</span>
      </button>
      <button
        class="hand-switch-btn"
        class:active={!isBlueHand}
        class:needs-attention={redNeedsAttention}
        style="--btn-color: var(--prop-red, #ed1c24)"
        role="radio"
        aria-checked={!isBlueHand}
        aria-label="Switch to red hand"
        onclick={switchToRed}
      >
        <span class="hand-dot" aria-hidden="true"></span>
        <span class="hand-label">Red</span>
      </button>
    </div>
  {/if}
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
  }

  .step-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 700;
    color: #fff;
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
  }

  .hand-switch-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 1.5px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .hand-switch-btn:hover {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.04);
  }

  .hand-switch-btn.active {
    color: #fff;
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

  /* Inactive hand with no steps yet — pulse to invite the user to start it */
  .hand-switch-btn.needs-attention {
    border-color: color-mix(in srgb, var(--btn-color) 50%, transparent);
    color: rgba(255, 255, 255, 0.7);
    animation: hand-nudge 2s ease-in-out infinite;
  }

  .hand-switch-btn.needs-attention .hand-dot {
    opacity: 0.8;
  }

  @keyframes hand-nudge {
    0%, 100% {
      border-color: color-mix(in srgb, var(--btn-color) 30%, transparent);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--btn-color) 0%, transparent);
    }
    50% {
      border-color: var(--btn-color);
      box-shadow: 0 0 8px 0 color-mix(in srgb, var(--btn-color) 30%, transparent);
    }
  }

  .hand-switch-btn:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }

  /* ── Mobile: minimal text overlay, no background strip ── */
  @media (max-width: 768px) {
    .instruction-header {
      padding: 6px 12px 4px;
      background: none;
      pointer-events: none;
    }

    .step-title {
      font-size: 14px;
      gap: 0;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
    }

    /* Hide the dot on mobile — just plain white text */
    .hand-dot-glow {
      display: none;
    }

    /* Hide hand switcher on mobile — ButtonPanel has HandPickerButton */
    .hand-switcher {
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
