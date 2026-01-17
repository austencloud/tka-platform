<!--
  PropTurnsControl.svelte

  Internal controls for adjusting turns and rotation of a single prop.
  Designed to be used inside PropControlPair which provides the card styling.
  Uses CSS custom properties from parent card for color theming.
-->
<script lang="ts">
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  interface Props {
    color: "blue" | "red";
    turns: number | "fl";
    rotationDirection: RotationDirection;
    showRotation: boolean;
    onTurnsChange: (delta: number) => void;
    onRotationChange: (direction: RotationDirection) => void;
  }

  let {
    color,
    turns,
    rotationDirection,
    showRotation,
    onTurnsChange,
    onRotationChange,
  }: Props = $props();

  const displayTurns = $derived(turns === "fl" ? "fl" : turns);

  function handleTurnsChangeClick(e: MouseEvent, delta: number) {
    e.stopPropagation();
    onTurnsChange(delta);
  }

  function handleRotationClick(e: MouseEvent, direction: RotationDirection) {
    e.stopPropagation();
    if (turns === "fl") return; // Float motions don't support rotation
    onRotationChange(direction);
  }
</script>

<div
  class="turns-controls"
  class:blue={color === "blue"}
  class:red={color === "red"}
>
  <div class="turns-row">
    <button
      class="ctrl-btn"
      aria-label="Decrease {color} turns"
      onclick={(e) => handleTurnsChangeClick(e, -0.5)}
    >
      <i class="fas fa-minus" aria-hidden="true"></i>
    </button>
    <span class="turns-value">{displayTurns}</span>
    <button
      class="ctrl-btn"
      aria-label="Increase {color} turns"
      onclick={(e) => handleTurnsChangeClick(e, 0.5)}
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
    </button>
  </div>

  <div class="rotation-row">
    <button
      class="rot-btn"
      class:active={showRotation &&
        rotationDirection === RotationDirection.CLOCKWISE}
      aria-label="Rotate {color} clockwise"
      onclick={(e) => handleRotationClick(e, RotationDirection.CLOCKWISE)}
      disabled={!showRotation}
    >
      <i class="fas fa-rotate-right" aria-hidden="true"></i>
    </button>
    <button
      class="rot-btn"
      class:active={showRotation &&
        rotationDirection === RotationDirection.COUNTER_CLOCKWISE}
      aria-label="Rotate {color} counter clockwise"
      onclick={(e) =>
        handleRotationClick(e, RotationDirection.COUNTER_CLOCKWISE)}
      disabled={!showRotation}
    >
      <i class="fas fa-rotate-left" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .turns-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .turns-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .turns-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    min-width: var(--min-touch-target);
    text-align: center;
  }

  .rotation-row {
    display: flex;
    gap: 8px;
  }

  /* ============================================================================
     CONTROL BUTTONS - Use CSS custom properties from PropControlPair
     ============================================================================ */

  .ctrl-btn,
  .rot-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    border: 1px solid;
    cursor: pointer;
    font-size: 1.1rem;
    transition: all var(--duration-fast) ease;
  }

  .ctrl-btn:active:not(:disabled),
  .rot-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .rot-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Blue theme - uses CSS custom properties from PropControlPair */
  .turns-controls.blue .ctrl-btn {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.2);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.4);
    color: var(--prop-color, var(--semantic-info));
  }

  .turns-controls.blue .ctrl-btn:hover {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.6);
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 59, 130, 246), 0.25);
  }

  .turns-controls.blue .rot-btn {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.15);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.7);
  }

  .turns-controls.blue .rot-btn:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.25);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.5);
    color: var(--prop-color, var(--semantic-info));
  }

  .turns-controls.blue .rot-btn.active {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.6);
    color: var(--prop-color, var(--semantic-info));
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 59, 130, 246), 0.25);
  }

  /* Red theme */
  .turns-controls.red .ctrl-btn {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.2);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.4);
    color: var(--prop-color, var(--semantic-error));
  }

  .turns-controls.red .ctrl-btn:hover {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.3);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.6);
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 239, 68, 68), 0.25);
  }

  .turns-controls.red .rot-btn {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.15);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.3);
    color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.7);
  }

  .turns-controls.red .rot-btn:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.25);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.5);
    color: var(--prop-color, var(--semantic-error));
  }

  .turns-controls.red .rot-btn.active {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.3);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.6);
    color: var(--prop-color, var(--semantic-error));
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 239, 68, 68), 0.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .ctrl-btn,
    .rot-btn {
      transition: none;
    }
    .ctrl-btn:active:not(:disabled),
    .rot-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
