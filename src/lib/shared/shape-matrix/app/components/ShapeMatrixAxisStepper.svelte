<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixAxisStepper.svelte
  One axis of the Level Matrix recipe bar: a prev/next stepper through the
  turn values the chosen difficulty allows, showing the value in the current
  notation with the other notation beside it. Rows (blue, left hand) and
  columns (red, right hand) each get one, so there is no Apply-to mode and no
  "Mixed" placeholder: the bar always names both axes exactly. -->
<script lang="ts">
  import {
    matrixTurnSpokenLabel,
    matrixTurnVisibleLabel,
  } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import { ratioLabel } from "$lib/shared/shape-matrix/domain/flower-signature";
  import type { TurnValue } from "$lib/shared/create/services/level-turn-values";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    hand: "left" | "right";
  }
  let { hand }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const axisName = $derived(hand === "left" ? "Rows" : "Columns");
  const turn = $derived(
    hand === "left" ? appState.leftTurn : appState.rightTurn
  );
  const turns = $derived(appState.availableTurns);
  const index = $derived(turns.indexOf(turn));
  const canStep = $derived(turns.length > 1);

  /* The value reads in the chosen notation; the other notation rides along
     small so a roll is legible to both a TKA reader and a VTG reader. */
  const primary = $derived(matrixTurnVisibleLabel(turn, appState.labelMode));
  const secondary = $derived(
    appState.labelMode === "ratios"
      ? turn === "fl"
        ? "Float"
        : `${turn} turn${turn === 1 ? "" : "s"}`
      : ratioLabel(turn)
  );
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
    <strong>{primary}</strong>
    <span class="secondary">{secondary}</span>
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

  .step {
    display: grid;
    width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.7));
    font: inherit;
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
    min-width: 5.5rem;
    align-items: baseline;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.35rem 0.5rem;
    border-inline: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .value strong {
    color: var(--axis-color);
    font-size: var(--font-size-md, 1rem);
    font-weight: 750;
  }

  .secondary {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .step {
      transition: none;
    }
  }
</style>
