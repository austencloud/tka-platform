<!--
  BatchStepEditor.svelte

  Multi-select batch editor BODY. Rendered inside the coordinator's shared
  CreatePanelDrawer (same shell as StepEditorPanel) when 2+ beats are selected,
  so switching single↔multi crossfades in place instead of closing/reopening a
  drawer. Shows every selected pictograph in a grid and edits their per-hand
  turns together.

  Mixed values: when the selected steps disagree on a hand's turns, the control
  offers two modes (SegmentedControl):
    - "Set all"  → value palette; tapping writes one absolute value to every step.
    - "Adjust"   → shows the min–max range; stepping nudges each step by ±0.5,
                    preserving their differences.
  Each pictograph renders its own beat number + per-hand turns, so the spread is
  visible at all times without an extra caption.
-->
<script lang="ts">
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
  import { calculateGridLayout } from "$lib/shared/create/utils/grid-calculations";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";

  type BatchMode = "set" | "adjust";

  interface Props {
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

  // Size the pictograph cells to fill the available panel space — the same
  // responsive sizing the workspace grid uses, so batch pictographs are big
  // and clearly readable instead of a tight auto-fill of tiny thumbnails.
  const deviceDetector = getDeviceDetector();
  let gridEl = $state<HTMLElement>();
  let gridW = $state(0);
  let gridH = $state(0);

  $effect(() => {
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    gridW = rect.width;
    gridH = rect.height;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        gridW = entry.contentRect.width;
        gridH = entry.contentRect.height;
      }
    });
    ro.observe(gridEl);
    return () => ro.disconnect();
  });

  const layout = $derived(
    calculateGridLayout(count, gridW, gridH, deviceDetector, {
      maxCellSize: 320,
    })
  );

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

  // Absolute turn options for "Set all" — the full TKA axis plus float.
  const SET_OPTIONS: (number | "fl")[] = ["fl", 0, 0.5, 1, 1.5, 2, 2.5, 3];

  function fmt(v: number | "fl"): string {
    return v === "fl" ? "fl" : `${v}`;
  }

  const norm = (v: number | "fl"): number => (v === "fl" ? -0.5 : v);

  // Highlight an option chip only when the whole selection already shares it.
  function isActiveOption(agg: TurnsAggregate, opt: number | "fl"): boolean {
    return !agg.mixed && agg.value !== null && norm(agg.value) === norm(opt);
  }

  // Adjust-mode readout: shared value, or the min–max range when mixed.
  function adjustDisplay(agg: TurnsAggregate): string {
    if (!agg.mixed) return agg.value === null ? "0" : fmt(agg.value);
    return `${formatTurn(agg.min)}–${formatTurn(agg.max)}`;
  }
</script>

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
    <div class="grid-scroll" bind:this={gridEl}>
      <div
        class="pictograph-grid"
        style:grid-template-columns={`repeat(${layout.columns}, ${layout.cellSize}px)`}
      >
        {#each steps as step, i (stepNumbers[i] ?? i)}
          <!-- The pictograph already renders its beat number + per-hand turns,
               so no extra caption is needed here. -->
          <div class="pictograph-box" style:width={`${layout.cellSize}px`}>
            <PictographContainer
              pictographData={step}
              disableTransitions={true}
              cellIndex={i}
              {bluePropTypeOverride}
              {redPropTypeOverride}
            />
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
    {#if mode === "set"}
      <!-- Absolute value palette — tap sets every selected step to that value. -->
      <div class="value-grid">
        {#each SET_OPTIONS as opt (opt)}
          <button
            class="value-chip"
            class:active={isActiveOption(agg, opt)}
            type="button"
            aria-label="Set all {colorName} turns to {fmt(opt)}"
            onclick={() => onBatchTurnsChange(color, "set", opt)}
          >
            {fmt(opt)}
          </button>
        {/each}
      </div>
    {:else}
      <!-- Relative nudge — ±0.5 to each step, preserving offsets. -->
      <div class="stepper">
        <button
          class="ctrl-btn"
          type="button"
          aria-label="Decrease {colorName} turns"
          onclick={() => onBatchTurnsChange(color, "adjust", -0.5)}
        >
          <i class="fas fa-minus" aria-hidden="true"></i>
        </button>
        <span class="turns-value" class:mixed={agg.mixed}>{adjustDisplay(agg)}</span>
        <button
          class="ctrl-btn"
          type="button"
          aria-label="Increase {colorName} turns"
          onclick={() => onBatchTurnsChange(color, "adjust", 0.5)}
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    {/if}
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

  /* Columns + cell size are computed (calculateGridLayout) and set inline so the
     pictographs fill the panel. `safe center` centers them when they fit and
     falls back to scroll-from-top when the selection overflows. */
  .pictograph-grid {
    display: grid;
    gap: 12px;
    padding: 6px;
    box-sizing: border-box;
    min-height: 100%;
    justify-content: safe center;
    align-content: safe center;
  }

  .pictograph-box {
    position: relative;
    aspect-ratio: 1;
    background: var(--dm-pictograph-bg, #0a0a0f);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pictograph-box :global(.pictograph-container) {
    width: 100%;
    height: 100%;
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

  /* Set-all value palette */
  .value-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .value-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target, 44px);
    border-radius: 10px;
    border: 1px solid rgba(var(--prop-color-rgb, 59, 130, 246), 0.35);
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.12);
    color: rgba(255, 255, 255, 0.92);
    font-size: 1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .value-chip:hover {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.24);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.6);
  }

  .value-chip:active {
    transform: scale(0.96);
  }

  .value-chip.active {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.85);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 1);
    color: #fff;
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
    .ctrl-btn,
    .value-chip {
      transition: none;
    }
    .ctrl-btn:active,
    .value-chip:active {
      transform: none;
    }
  }
</style>
