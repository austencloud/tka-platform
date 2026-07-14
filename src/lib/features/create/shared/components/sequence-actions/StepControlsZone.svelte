<!--
  StepControlsZone.svelte

  The PERSISTENT blue/red turn controls at the bottom of the step editor drawer.
  Rendered once by StepEditorCoordinator, OUTSIDE the top-zone crossfade, so the
  colored blue/red frames (PropControlPair) survive a single ↔ multi switch and
  MORPH in place: only the inner control crossfades (single per-hand stepper ↔
  batch value palette), the frame persists.

  Shows only when there's something to edit turns for — a single regular beat, or
  a multi-selection. Start-position / no-selection have no turn pair and are
  handled by the top zone (StepEditorPanel).
-->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PropControlPair from "./PropControlPair.svelte";
  import PropTurnsControl from "./PropTurnsControl.svelte";
  import PropTypeRow from "./PropTypeRow.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import {
    MotionColor,
    MotionType,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PathShapeValue } from "../../services/step-operations/path-shape-handler";
  import {
    aggregateTurns,
    formatTurn,
    type TurnsAggregate,
  } from "../../services/step-operations/turns-aggregation";

  type BatchMode = "set" | "adjust";

  interface Props {
    selectionMode: "single" | "multi";
    stacked?: boolean;
    compact?: boolean;
    // Single-select: the displayed regular step (null when none / start position)
    stepData: StepData | null;
    onTurnsChange: (color: MotionColor, delta: number) => void;
    onRotationChange: (color: MotionColor, direction: RotationDirection) => void;
    onOpenPropSheet?: (color: "blue" | "red") => void;
    onPathShapeChange?: (color: MotionColor, shape: PathShapeValue) => void;
    onPathShapeClear?: (color: MotionColor) => void;
    // Multi-select: every selected step + the batch turns writer
    batchSteps: StepData[];
    onBatchTurnsChange: (
      color: MotionColor,
      mode: BatchMode,
      amount: number | "fl"
    ) => void;
  }

  let {
    selectionMode,
    stacked = false,
    compact = false,
    stepData,
    onTurnsChange,
    onRotationChange,
    onOpenPropSheet,
    onPathShapeChange,
    onPathShapeClear,
    batchSteps,
    onBatchTurnsChange,
  }: Props = $props();

  // ---- Single-select display turns (mirrors StepEditorPanel's derivations) ----
  const blueMotion = $derived(stepData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(stepData?.motions?.[MotionColor.RED]);

  const normalizeTurns = (turns: number | string | undefined): number =>
    turns === "fl" ? -0.5 : Number(turns) || 0;

  const currentBlueTurns = $derived(normalizeTurns(blueMotion?.turns));
  const currentRedTurns = $derived(normalizeTurns(redMotion?.turns));

  const displayBlueTurns = $derived(
    blueMotion?.turns === "fl" ? "fl" : currentBlueTurns
  );
  const displayRedTurns = $derived(
    redMotion?.turns === "fl" ? "fl" : currentRedTurns
  );

  const showBlueRotation = $derived.by(() => {
    if (currentBlueTurns < 0) return false;
    if (
      (blueMotion?.motionType === MotionType.STATIC ||
        blueMotion?.motionType === MotionType.DASH) &&
      currentBlueTurns === 0
    ) {
      return false;
    }
    return true;
  });
  const showRedRotation = $derived.by(() => {
    if (currentRedTurns < 0) return false;
    if (
      (redMotion?.motionType === MotionType.STATIC ||
        redMotion?.motionType === MotionType.DASH) &&
      currentRedTurns === 0
    ) {
      return false;
    }
    return true;
  });

  const blueRotation = $derived(
    blueMotion?.rotationDirection ?? RotationDirection.NO_ROTATION
  );
  const redRotation = $derived(
    redMotion?.rotationDirection ?? RotationDirection.NO_ROTATION
  );

  const bluePathShape = $derived(blueMotion?.pathShape);
  const redPathShape = $derived(redMotion?.pathShape);
  const blueIsShift = $derived(
    blueMotion ? blueMotion.startLocation !== blueMotion.endLocation : false
  );
  const redIsShift = $derived(
    redMotion ? redMotion.startLocation !== redMotion.endLocation : false
  );

  // ---- Multi-select aggregates (mirrors BatchStepEditor) ----
  const blueAgg = $derived(
    aggregateTurns(batchSteps.map((s) => s.motions?.[MotionColor.BLUE]?.turns))
  );
  const redAgg = $derived(
    aggregateTurns(batchSteps.map((s) => s.motions?.[MotionColor.RED]?.turns))
  );

  // Per-hand batch mode. Defaults to "Set all" — the palette shows the spread.
  let blueMode = $state<BatchMode>("set");
  let redMode = $state<BatchMode>("set");

  const MODE_OPTIONS: { value: BatchMode; label: string }[] = [
    { value: "set", label: "Set all" },
    { value: "adjust", label: "Adjust" },
  ];
  const SET_OPTIONS: (number | "fl")[] = ["fl", 0, 0.5, 1, 1.5, 2, 2.5, 3];

  function fmt(v: number | "fl"): string {
    return v === "fl" ? "fl" : `${v}`;
  }
  const norm = (v: number | "fl"): number => (v === "fl" ? -0.5 : v);

  function isActiveOption(agg: TurnsAggregate, opt: number | "fl"): boolean {
    return !agg.mixed && agg.value !== null && norm(agg.value) === norm(opt);
  }
  function adjustDisplay(agg: TurnsAggregate): string {
    if (!agg.mixed) return agg.value === null ? "0" : fmt(agg.value);
    return `${formatTurn(agg.min)}–${formatTurn(agg.max)}`;
  }

  // Show the turn pair only when there's turns to edit: a single regular beat or
  // a live multi-selection. Start position / no selection show nothing here.
  const showPair = $derived(
    selectionMode === "multi" ? batchSteps.length > 0 : stepData != null
  );
</script>

{#if showPair}
  <div class="controls-zone">
    <PropControlPair {stacked} {compact}>
      {#snippet blueContent()}
        <Crossfade key={selectionMode} duration={DURATION.fast}>
          {#if selectionMode === "multi"}
            {@render batchHand(
              "blue",
              MotionColor.BLUE,
              blueAgg,
              blueMode,
              (m) => (blueMode = m)
            )}
          {:else}
            {@render singleHand(
              "blue",
              MotionColor.BLUE,
              displayBlueTurns,
              blueRotation,
              showBlueRotation,
              bluePathShape,
              blueIsShift
            )}
          {/if}
        </Crossfade>
      {/snippet}
      {#snippet redContent()}
        <Crossfade key={selectionMode} duration={DURATION.fast}>
          {#if selectionMode === "multi"}
            {@render batchHand(
              "red",
              MotionColor.RED,
              redAgg,
              redMode,
              (m) => (redMode = m)
            )}
          {:else}
            {@render singleHand(
              "red",
              MotionColor.RED,
              displayRedTurns,
              redRotation,
              showRedRotation,
              redPathShape,
              redIsShift
            )}
          {/if}
        </Crossfade>
      {/snippet}
    </PropControlPair>
  </div>
{/if}

{#snippet singleHand(
  colorName: "blue" | "red",
  color: MotionColor,
  turns: number | "fl",
  rotation: RotationDirection,
  showRotation: boolean,
  pathShape: PathShapeValue | undefined,
  isShift: boolean
)}
  <div class="hand-inner">
    <PropTurnsControl
      color={colorName}
      {turns}
      rotationDirection={rotation}
      {showRotation}
      {compact}
      {pathShape}
      {isShift}
      onTurnsChange={(delta) => onTurnsChange(color, delta)}
      onRotationChange={(dir) => onRotationChange(color, dir)}
      onPathShapeChange={onPathShapeChange
        ? (shape) => onPathShapeChange(color, shape)
        : undefined}
      onPathShapeClear={onPathShapeClear
        ? () => onPathShapeClear(color)
        : undefined}
    />
    <PropTypeRow color={colorName} {compact} {onOpenPropSheet} />
  </div>
{/snippet}

{#snippet batchHand(
  colorName: "blue" | "red",
  color: MotionColor,
  agg: TurnsAggregate,
  mode: BatchMode,
  setMode: (m: BatchMode) => void
)}
  <div class="hand-inner">
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
  .controls-zone {
    padding: 12px;
    padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  /* Inner column so single (stepper + prop row) and batch (segmented + palette)
     both stack the same way inside the shared card. */
  .hand-inner {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    width: 100%;
  }

  /* ===== Batch: Set-all value palette ===== */
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

  /* ===== Batch: Adjust stepper ===== */
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

  .turns-value.mixed {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    letter-spacing: 0.02em;
  }

  @media (prefers-reduced-motion: reduce) {
    .value-chip,
    .ctrl-btn {
      transition: none;
    }
    .value-chip:active,
    .ctrl-btn:active {
      transform: none;
    }
  }
</style>
