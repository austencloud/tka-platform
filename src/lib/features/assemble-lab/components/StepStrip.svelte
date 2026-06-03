<!--
  StepStrip.svelte - Horizontal strip of real pictographs

  Shows one PictographContainer per step index. Blue steps fill in first,
  red steps overlay onto existing pictographs when the second hand
  is built. Always reserves vertical space to prevent grid resizing.

  Start position pictograph appears to the left (stepNumber 0).
  Step numbers render via PictographContainer's built-in StepNumber glyph.
  Letters are looked up asynchronously via MotionQueryHandler when both
  hands have matching steps.

  New cells animate in with a scale transition.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import {
    MotionColor,
    MotionType,
    Orientation,
    RotationDirection,
    HandMotionType,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, type GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { calculateMotionType, calculateRotationDirection } from "$lib/features/create/assemble/services/hand-path-motion-calculator";
  import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
  import type { AssembleState, BuilderStep } from "../state/assemble-state.svelte";

  let { builderState }: { builderState: AssembleState } = $props();

  /** Derive MotionType (PRO/ANTI/DASH/STATIC) from step data */
  function resolveMotionType(step: BuilderStep): MotionType {
    const handMotionType = calculateMotionType(
      step.startPosition, step.endPosition, builderState.gridMode,
    );
    switch (handMotionType) {
      case HandMotionType.STATIC:
        return MotionType.STATIC;
      case HandMotionType.DASH:
        return MotionType.DASH;
      case HandMotionType.SHIFT: {
        const handPathDir = calculateRotationDirection(
          step.startPosition, step.endPosition, builderState.gridMode,
        );
        return handPathDir === step.rotationDirection ? MotionType.PRO : MotionType.ANTI;
      }
      default:
        return MotionType.STATIC;
    }
  }

  /** Convert a BuilderStep into a MotionData for the pictograph pipeline */
  function stepToMotion(step: BuilderStep, color: MotionColor) {
    const motionType = resolveMotionType(step);
    const resolvedRotation = (step.startPosition === step.endPosition)
      ? RotationDirection.NO_ROTATION
      : step.rotationDirection;

    return createMotionData({
      color,
      startLocation: step.startPosition,
      endLocation: step.endPosition,
      motionType,
      rotationDirection: resolvedRotation,
      turns: step.turnCount,
      startOrientation: step.startOrientation,
      endOrientation: step.endOrientation,
      gridMode: builderState.gridMode,
      arrowLocation: step.startPosition,
      isVisible: true,
    });
  }

  // --- Letter lookup cache ---
  // Maps step index -> resolved letter (null = looked up but no match)
  let letterCache = $state<Map<number, Letter | null>>(new Map());

  // Reset cache when steps are cleared
  $effect(() => {
    if (builderState.blueSteps.length === 0 && builderState.redSteps.length === 0) {
      letterCache = new Map();
    }
  });

  // Async letter lookup for paired steps
  $effect(() => {
    const blueSteps = builderState.blueSteps;
    const redSteps = builderState.redSteps;
    const paired = Math.min(blueSteps.length, redSteps.length);
    const gm = builderState.gridMode;

    for (let i = 0; i < paired; i++) {
      if (letterCache.has(i)) continue;
      const blueMotion = stepToMotion(blueSteps[i]!, MotionColor.BLUE);
      const redMotion = stepToMotion(redSteps[i]!, MotionColor.RED);
      // Mark as pending so we don't re-trigger
      letterCache = new Map(letterCache).set(i, null);
      motionQueryHandler.findLetterByMotionConfiguration(blueMotion, redMotion, gm)
        .then(letter => {
          letterCache = new Map(letterCache).set(i, (letter as Letter) ?? null);
        });
    }
  });

  // Total step count = max of both hands
  const totalSteps = $derived(
    Math.max(builderState.blueSteps.length, builderState.redSteps.length)
  );

  /** Create a static MotionData for start position display */
  function createStaticMotion(position: GridLocation, orientation: Orientation, color: MotionColor) {
    return createMotionData({
      color,
      startLocation: position,
      endLocation: position,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      startOrientation: orientation,
      endOrientation: orientation,
      gridMode: builderState.gridMode,
      arrowLocation: position,
      isVisible: true,
    });
  }

  // Start position pictograph (stepNumber 0 -> renders "Start" text)
  // Shows immediately on first click (placing phase) before any steps exist.
  const startPictograph = $derived.by((): (PictographData & { stepNumber: number }) | null => {
    const firstBlue = builderState.blueSteps[0];
    const firstRed = builderState.redSteps[0];
    const isPlacing = builderState.currentPosition !== null;
    const activeHand = builderState.activeHand;

    // Determine blue start: from first step, or from current position if blue is placing
    let bluePos: GridLocation | null = null;
    let blueOri: Orientation = Orientation.IN;
    if (firstBlue) {
      bluePos = firstBlue.startPosition;
      blueOri = firstBlue.startOrientation;
    } else if (isPlacing && activeHand === MotionColor.BLUE) {
      bluePos = builderState.currentPosition;
      blueOri = builderState.currentOrientation;
    }

    // Determine red start: from first step, or from current position if red is placing
    let redPos: GridLocation | null = null;
    let redOri: Orientation = Orientation.IN;
    if (firstRed) {
      redPos = firstRed.startPosition;
      redOri = firstRed.startOrientation;
    } else if (isPlacing && activeHand === MotionColor.RED) {
      redPos = builderState.currentPosition;
      redOri = builderState.currentOrientation;
    }

    if (!bluePos && !redPos) return null;

    const motions: PictographData["motions"] = {};
    if (bluePos) motions[MotionColor.BLUE] = createStaticMotion(bluePos, blueOri, MotionColor.BLUE);
    if (redPos) motions[MotionColor.RED] = createStaticMotion(redPos, redOri, MotionColor.RED);

    return {
      id: "builder-start",
      motions,
      gridMode: builderState.gridMode,
      stepNumber: 0,
    };
  });

  // Build PictographData for each step index (with stepNumber and letter)
  const stepPictographs = $derived.by((): (PictographData & { stepNumber: number })[] => {
    const result: (PictographData & { stepNumber: number })[] = [];
    for (let i = 0; i < totalSteps; i++) {
      const blueStep = builderState.blueSteps[i];
      const redStep = builderState.redSteps[i];

      const motions: PictographData["motions"] = {};
      if (blueStep) motions[MotionColor.BLUE] = stepToMotion(blueStep, MotionColor.BLUE);
      if (redStep) motions[MotionColor.RED] = stepToMotion(redStep, MotionColor.RED);

      const resolvedLetter = letterCache.get(i) ?? undefined;

      result.push({
        id: `builder-step-${i}`,
        motions,
        gridMode: builderState.gridMode,
        letter: resolvedLetter,
        stepNumber: i + 1,
      });
    }
    return result;
  });

  const hasContent = $derived(totalSteps > 0 || startPictograph !== null);
</script>

<div class="step-strip-container" class:has-steps={hasContent}>
  {#if hasContent}
    <div class="step-strip-scroll">
      <div class="step-strip-row">
        {#if startPictograph}
          <div
            class="step-cell start-cell"
            in:scale={{ duration: 250, start: 0.5, opacity: 0 }}
          >
            <PictographContainer
              pictographData={startPictograph}
              gridMode={builderState.gridMode}
              disableTransitions={true}
              showTKA={false}
              showReversals={false}
              showPositions={false}
              showTnD={false}
              showElemental={false}
            />
          </div>
        {/if}
        {#each stepPictographs as pictograph, idx (pictograph.id)}
          <div
            class="step-cell"
            animate:flip={{ duration: 250 }}
            in:scale={{ duration: 250, start: 0.5, opacity: 0 }}
          >
            <PictographContainer
              pictographData={pictograph}
              gridMode={builderState.gridMode}
              disableTransitions={true}
              showTKA={true}
              showReversals={false}
              showPositions={false}
              showTnD={false}
              showElemental={false}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .step-strip-container {
    flex-shrink: 0;
    width: 100%;
    min-height: 50px;
    display: flex;
    justify-content: center;
    transition: min-height 0.25s ease;
  }

  .step-strip-container.has-steps {
    min-height: 100px;
  }

  .step-strip-scroll {
    overflow-x: auto;
    max-width: 100%;
    padding: 4px 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .step-strip-row {
    display: flex;
    gap: 6px;
    justify-content: center;
  }

  .step-cell {
    position: relative;
    flex-shrink: 0;
    width: 90px;
    height: 90px;
  }

  .step-cell :global(svg) {
    width: 100%;
    height: 100%;
    border-radius: 6px;
  }

  .start-cell {
    opacity: 0.7;
  }

  @media (prefers-reduced-motion: reduce) {
    .step-strip-container {
      transition: none;
    }
  }
</style>
