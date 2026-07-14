<!--
  BatchStepEditor.svelte

  Multi-select batch editor. Opens (in the same drawer shell as StepEditorPanel)
  when 2+ beats are selected in the workspace. Shows every selected pictograph in
  a grid and edits their per-hand turns together.

  Mixed values: when the selected steps disagree on a hand's turns, the control
  offers two modes (SegmentedControl):
    - "Set all"  → shows "Mixed"; stepping writes one absolute value to every step.
    - "Adjust"   → shows the min–max range; stepping nudges each step by ±0.5,
                    preserving their differences.
  The grid caption under each pictograph always shows that step's own turns, so
  the spread is visible at all times.
-->
<script lang="ts">
  import CreatePanelDrawer from "../CreatePanelDrawer.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    aggregateTurns,
    formatTurn,
    type TurnsAggregate,
  } from "../../services/step-operations/turns-aggregation";

  type BatchMode = "set" | "adjust";

  interface Props {
    isOpen: boolean;
    steps: StepData[];
    stepNumbers: number[];
    totalBeats: number;
    onBatchTurnsChange: (
      color: MotionColor,
      mode: BatchMode,
      amount: number | "fl"
    ) => void;
    onClose: () => void;
    onSelectAll: () => void;
    bluePropTypeOverride?: PropType;
    redPropTypeOverride?: PropType;
  }

  let {
    isOpen = $bindable(),
    steps,
    stepNumbers,
    totalBeats,
    onBatchTurnsChange,
    onClose,
    onSelectAll,
    bluePropTypeOverride,
    redPropTypeOverride,
  }: Props = $props();

  const count = $derived(steps.length);

  const blueAgg = $derived(
    aggregateTurns(steps.map((s) => s.motions?.[MotionColor.BLUE]?.turns))
  );
  const redAgg = $derived(
    aggregateTurns(steps.map((s) => s.motions?.[MotionColor.RED]?.turns))
  );

  // Per-hand mode. Defaults to "Set all" — the simplest mental model; the grid
  // already shows the spread so the user knows what a flatten replaces.
  let blueMode = $state<BatchMode>("set");
  let redMode = $state<BatchMode>("set");

  const MODE_OPTIONS: { value: BatchMode; label: string }[] = [
    { value: "set", label: "Set all" },
    { value: "adjust", label: "Adjust" },
  ];

  function fmt(v: number | "fl"): string {
    return v === "fl" ? "fl" : `${v}`;
  }

  function display(agg: TurnsAggregate, mode: BatchMode): string {
    if (!agg.mixed) return agg.value === null ? "0" : fmt(agg.value);
    // Mixed:
    return mode === "set"
      ? "Mixed"
      : `${formatTurn(agg.min)}–${formatTurn(agg.max)}`;
  }

  // Seed for absolute "Set all" stepping when the selection is mixed: raise/lower
  // from the current MAX so "+"/"−" move everyone to a predictable common value.
  function seed(agg: TurnsAggregate): number {
    if (!agg.mixed) return agg.value === "fl" ? -0.5 : (agg.value ?? 0);
    return agg.max;
  }

  function stepTurns(
    color: MotionColor,
    mode: BatchMode,
    agg: TurnsAggregate,
    delta: number
  ) {
    if (mode === "adjust") {
      onBatchTurnsChange(color, "adjust", delta);
      return;
    }
    // Absolute target for "Set all". Per-step min (fl floor) is enforced in the
    // write path; here we only clamp to the global axis [-0.5 .. 3].
    let target = seed(agg) + delta;
    target = Math.min(3, Math.max(-0.5, target));
    onBatchTurnsChange(color, "set", target === -0.5 ? "fl" : target);
  }
</script>

<CreatePanelDrawer
  bind:isOpen
  panelName="batch-edit"
  ariaLabel="Edit {count} beats"
  onClose={onClose}
>
  <div class="batch-editor">
    <!-- Header -->
    <header class="batch-header">
      <button
        class="header-btn close"
        type="button"
        onclick={onClose}
        aria-label="Close batch editor"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
      <span class="batch-title">Editing {count} beats</span>
      {#if count < totalBeats}
        <button
          class="header-btn select-all"
          type="button"
          onclick={onSelectAll}
        >
          Select all
        </button>
      {:else}
        <span class="header-spacer"></span>
      {/if}
    </header>

    <!-- Pictograph grid: every selected step, captioned with its own turns -->
    <div class="grid-scroll">
      <div class="pictograph-grid">
        {#each steps as step, i (stepNumbers[i] ?? i)}
          <div class="grid-cell">
            <div class="pictograph-box">
              <PictographContainer
                pictographData={step}
                disableTransitions={true}
                cellIndex={i}
                {bluePropTypeOverride}
                {redPropTypeOverride}
              />
            </div>
            <div class="cell-caption">
              <span class="beat-num">{stepNumbers[i]}</span>
              <span class="turn blue"
                >{fmt(step.motions?.[MotionColor.BLUE]?.turns ?? 0)}</span
              >
              <span class="turn red"
                >{fmt(step.motions?.[MotionColor.RED]?.turns ?? 0)}</span
              >
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Per-hand turn controls -->
    <div class="controls">
      {@render handCard(
        "blue",
        MotionColor.BLUE,
        blueAgg,
        blueMode,
        (m) => (blueMode = m)
      )}
      {@render handCard(
        "red",
        MotionColor.RED,
        redAgg,
        redMode,
        (m) => (redMode = m)
      )}
    </div>
  </div>
</CreatePanelDrawer>

{#snippet handCard(
  colorName: "blue" | "red",
  color: MotionColor,
  agg: TurnsAggregate,
  mode: BatchMode,
  setMode: (m: BatchMode) => void
)}
  <div class="hand-card" class:blue={colorName === "blue"} class:red={colorName === "red"}>
    <span class="hand-label">{colorName === "blue" ? "Left" : "Right"} turns</span>
    <SegmentedControl
      options={MODE_OPTIONS}
      value={mode}
      color={colorName}
      size="sm"
      onchange={setMode}
    />
    <div class="stepper">
      <button
        class="ctrl-btn"
        type="button"
        aria-label="Decrease {colorName} turns"
        onclick={() => stepTurns(color, mode, agg, -0.5)}
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="turns-value" class:mixed={agg.mixed}>{display(agg, mode)}</span>
      <button
        class="ctrl-btn"
        type="button"
        aria-label="Increase {colorName} turns"
        onclick={() => stepTurns(color, mode, agg, 0.5)}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </div>
{/snippet}

<style>
  .batch-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: 12px 16px 16px;
    box-sizing: border-box;
    gap: 12px;
  }

  /* ===== Header ===== */
  .batch-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .batch-title {
    flex: 1;
    text-align: center;
    font-size: var(--font-size-md, 1rem);
    font-weight: 700;
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
  }

  .header-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target, 44px);
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-fast) ease;
  }

  .header-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
  }

  .header-btn.close {
    min-width: var(--min-touch-target, 44px);
    padding: 0;
  }

  .header-spacer {
    min-width: var(--min-touch-target, 44px);
  }

  /* ===== Pictograph grid ===== */
  .grid-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }

  .pictograph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 10px;
    padding: 2px;
  }

  .grid-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .pictograph-box {
    width: 100%;
    aspect-ratio: 1;
    background: var(--dm-pictograph-bg, #0a0a0f);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cell-caption {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 0.72rem);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .beat-num {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }

  .turn.blue {
    color: var(--prop-blue, #3b82f6);
  }

  .turn.red {
    color: var(--prop-red, #ef4444);
  }

  /* ===== Per-hand controls ===== */
  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    flex-shrink: 0;
  }

  @media (max-width: 420px) {
    .controls {
      grid-template-columns: 1fr;
    }
  }

  .hand-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .hand-card.blue {
    --prop-color-rgb: 59, 130, 246;
  }

  .hand-card.red {
    --prop-color-rgb: 239, 68, 68;
  }

  .hand-label {
    font-size: var(--font-size-sm, 0.85rem);
    font-weight: 600;
    text-align: center;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
  }

  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border-radius: 10px;
    border: 1px solid rgba(var(--prop-color-rgb, 59, 130, 246), 0.4);
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.2);
    color: rgba(255, 255, 255, 0.95);
    font-size: 1.1rem;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .ctrl-btn:hover {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.6);
  }

  .ctrl-btn:active {
    transform: scale(0.95);
  }

  .turns-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    min-width: 4ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* "Mixed" / range reads as a hint, not a hard number */
  .turns-value.mixed {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    letter-spacing: 0.02em;
  }

  @media (prefers-reduced-motion: reduce) {
    .header-btn,
    .ctrl-btn {
      transition: none;
    }
    .ctrl-btn:active {
      transform: none;
    }
  }
</style>
