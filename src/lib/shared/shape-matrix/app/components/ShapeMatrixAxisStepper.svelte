<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixAxisStepper.svelte
  One axis of the Level Matrix: a prev/next stepper through the turn values
  the chosen difficulty allows, showing the value in the current notation
  only. Rows (blue, left hand) and columns (red, right hand) each get one, so
  there is no Apply-to mode and no "Mixed" placeholder. The corner layout
  scales with the grid's corner cell; the plain layout is a header control. -->
<script lang="ts">
  import {
    matrixTurnSpokenLabel,
    matrixTurnVisibleLabel,
  } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import type { TurnValue } from "$lib/shared/create/services/level-turn-values";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    hand: "left" | "right";
    /** Corner: sized in container units inside the grid's corner cell. */
    layout?: "plain" | "corner";
  }
  let { hand, layout = "plain" }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const axisName = $derived(hand === "left" ? "Rows" : "Columns");
  const turn = $derived(
    hand === "left" ? appState.leftTurn : appState.rightTurn
  );
  const turns = $derived(appState.availableTurns);
  const index = $derived(turns.indexOf(turn));
  const canStep = $derived(turns.length > 1);

  const visible = $derived(matrixTurnVisibleLabel(turn, appState.labelMode));
  const spoken = $derived(matrixTurnSpokenLabel(turn, appState.labelMode));

  function step(delta: number): void {
    const next = turns[index + delta] as TurnValue | undefined;
    if (next === undefined) return;
    appState.setTurnFor(hand, next);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  }
</script>

<div
  class="axis-stepper"
  class:rows={hand === "left"}
  class:columns={hand === "right"}
  class:corner={layout === "corner"}
  role="group"
  aria-label={`${axisName}: ${spoken}`}
>
  <button
    type="button"
    class="step"
    aria-label={`Previous ${axisName.toLowerCase()} value`}
    disabled={!canStep || index <= 0}
    onclick={() => step(-1)}
  >
    <i class="fas fa-chevron-left" aria-hidden="true"></i>
  </button>
  <span
    class="value"
    role="spinbutton"
    tabindex={canStep ? 0 : -1}
    aria-label={`${axisName} value`}
    aria-valuenow={index}
    aria-valuemin={0}
    aria-valuemax={turns.length - 1}
    aria-valuetext={spoken}
    onkeydown={onKey}
  >
    {visible}
  </span>
  <button
    type="button"
    class="step"
    aria-label={`Next ${axisName.toLowerCase()} value`}
    disabled={!canStep || index >= turns.length - 1}
    onclick={() => step(1)}
  >
    <i class="fas fa-chevron-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .axis-stepper {
    --axis-color: var(--prop-blue-text, #818cf8);
    --step-size: var(--min-touch-target, 44px);
    --value-size: var(--font-size-md, 1rem);
    display: inline-flex;
    align-items: stretch;
    min-width: 0;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    overflow: hidden;
  }

  .axis-stepper.columns {
    --axis-color: var(--prop-red-text, #f87171);
  }

  /* Inside the corner cell the stepper reads in that cell's container
     units, so it shrinks with a laptop grid and grows on a wide one. */
  .axis-stepper.corner {
    --step-size: clamp(1.5rem, 18cqi, 2.75rem);
    --value-size: clamp(0.9rem, 11cqi, 1.4rem);
    border-radius: 8px;
  }

  .step {
    display: grid;
    flex: 0 0 auto;
    width: var(--step-size);
    min-height: var(--step-size);
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.7));
    font: inherit;
    font-size: calc(var(--value-size) * 0.7);
    cursor: pointer;
    transition:
      color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .step:hover:not(:disabled) {
    color: var(--theme-text, #fff);
    background: color-mix(in srgb, var(--axis-color) 14%, transparent);
  }

  .step:disabled {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.28));
    cursor: default;
  }

  .step:focus-visible,
  .value:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: -2px;
  }

  .value {
    display: inline-flex;
    flex: 1 1 auto;
    min-width: 3rem;
    align-items: center;
    justify-content: center;
    padding: 0.2rem 0.35rem;
    border-inline: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    color: var(--axis-color);
    font-size: var(--value-size);
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .axis-stepper.corner .value {
    min-width: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .step {
      transition: none;
    }
  }
</style>
