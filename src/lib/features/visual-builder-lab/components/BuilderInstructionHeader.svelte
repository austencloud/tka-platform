<!--
  BuilderInstructionHeader.svelte - Phase instruction above the grid.

  Shows the active hand's color dot and phase-specific instruction text.
  On mobile, renders as a compact semi-transparent overlay.
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
</div>

<style>
  .instruction-header {
    width: 100%;
    text-align: center;
    padding: 12px 16px 8px;
    flex-shrink: 0;
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
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-dot-glow {
      box-shadow: none;
    }
  }
</style>
