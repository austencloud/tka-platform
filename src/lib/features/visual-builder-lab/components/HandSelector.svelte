<!--
  HandSelector.svelte - Active hand toggle + rotation direction toggle

  Blue/Red hand selector with CW/CCW rotation preset per hand.
  Rotation is set before clicking, eliminating the assembler's 4th phase.
-->
<script lang="ts">
  import {
    MotionColor,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { state }: { state: VisualBuilderState } = $props();

  const activeRotation = $derived(
    state.activeHand === MotionColor.BLUE ? state.blueRotation : state.redRotation
  );

  function toggleRotation(): void {
    const newDirection = activeRotation === RotationDirection.CLOCKWISE
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
    state.setRotation(state.activeHand, newDirection);
  }
</script>

<div class="hand-selector">
  <div class="hand-buttons" role="radiogroup" aria-label="Active hand">
    <button
      class="hand-btn blue"
      class:active={state.activeHand === MotionColor.BLUE}
      role="radio"
      aria-checked={state.activeHand === MotionColor.BLUE}
      onclick={() => state.switchHand(MotionColor.BLUE)}
    >
      <span class="hand-dot blue-dot"></span>
      Blue
    </button>
    <button
      class="hand-btn red"
      class:active={state.activeHand === MotionColor.RED}
      role="radio"
      aria-checked={state.activeHand === MotionColor.RED}
      onclick={() => state.switchHand(MotionColor.RED)}
    >
      <span class="hand-dot red-dot"></span>
      Red
    </button>
  </div>

  <button
    class="rotation-btn"
    onclick={toggleRotation}
    aria-label="Rotation direction: {activeRotation === RotationDirection.CLOCKWISE ? 'Clockwise' : 'Counter-clockwise'}"
  >
    <i
      class="fas fa-rotate-right"
      class:flipped={activeRotation === RotationDirection.COUNTER_CLOCKWISE}
    ></i>
    <span class="rotation-label">
      {activeRotation === RotationDirection.CLOCKWISE ? "CW" : "CCW"}
    </span>
  </button>
</div>

<style>
  .hand-selector {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hand-buttons {
    display: flex;
    gap: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    padding: 3px;
  }

  .hand-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    min-height: 40px;
  }

  .hand-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .hand-btn.active {
    color: var(--theme-text, #fff);
  }

  .hand-btn.blue.active {
    background: rgba(46, 139, 240, 0.2);
  }

  .hand-btn.red.active {
    background: rgba(237, 28, 36, 0.2);
  }

  .hand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .blue-dot {
    background: var(--prop-blue, #2e8bf0);
  }

  .red-dot {
    background: var(--prop-red, #ed1c24);
  }

  .rotation-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: border-color 0.15s ease;
    min-height: 40px;
  }

  .rotation-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .rotation-btn i {
    font-size: 16px;
    transition: transform 0.2s ease;
  }

  .rotation-btn i.flipped {
    transform: scaleX(-1);
  }

  .rotation-label {
    font-weight: 500;
    min-width: 28px;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .rotation-btn i {
      transition: none;
    }
  }
</style>
