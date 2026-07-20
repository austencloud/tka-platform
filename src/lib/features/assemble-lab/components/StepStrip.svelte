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
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import {
    createStaticMotion,
    lookupLetter,
    stepToMotion,
  } from "../services/builder-step-converter";

  let { builderState }: { builderState: AssembleState } = $props();

  // --- Letter lookup cache ---
  // Key by the full motion pair so edits at an existing index invalidate the
  // previous glyph instead of leaving a stale letter in the strip.
  let letterCache = $state<Map<string, Letter | null>>(new Map());
  let pendingLetters = $state<Set<string>>(new Set());

  function pairKey(index: number): string | null {
    const blue = builderState.blueSteps[index];
    const red = builderState.redSteps[index];
    return blue && red
      ? JSON.stringify([builderState.gridMode, blue, red])
      : null;
  }

  // Reset cache when steps are cleared
  $effect(() => {
    if (
      builderState.blueSteps.length === 0 &&
      builderState.redSteps.length === 0
    ) {
      letterCache = new Map();
      pendingLetters = new Set();
    }
  });

  // Async letter lookup for paired steps
  $effect(() => {
    const blueSteps = builderState.blueSteps;
    const redSteps = builderState.redSteps;
    const paired = Math.min(blueSteps.length, redSteps.length);
    const gm = builderState.gridMode;

    for (let i = 0; i < paired; i++) {
      const key = pairKey(i);
      if (!key || letterCache.has(key)) continue;
      const blueMotion = stepToMotion(blueSteps[i]!, MotionColor.BLUE, gm);
      const redMotion = stepToMotion(redSteps[i]!, MotionColor.RED, gm);
      // Mark as pending so we don't re-trigger and so the cell shows a skeleton.
      letterCache = new Map(letterCache).set(key, null);
      pendingLetters = new Set(pendingLetters).add(key);
      lookupLetter(blueMotion, redMotion, gm)
        .then((letter) => {
          letterCache = new Map(letterCache).set(
            key,
            (letter as Letter) ?? null
          );
        })
        .finally(() => {
          const next = new Set(pendingLetters);
          next.delete(key);
          pendingLetters = next;
        });
    }
  });

  // Total step count = max of both hands
  const totalSteps = $derived(
    Math.max(builderState.blueSteps.length, builderState.redSteps.length)
  );

  // Start position pictograph (stepNumber 0 -> renders "Start" text)
  // Shows immediately on first click (placing phase) before any steps exist.
  const startPictograph = $derived.by(
    (): (PictographData & { stepNumber: number }) | null => {
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
      if (bluePos)
        motions[MotionColor.BLUE] = createStaticMotion(
          bluePos,
          blueOri,
          MotionColor.BLUE,
          builderState.gridMode
        );
      if (redPos)
        motions[MotionColor.RED] = createStaticMotion(
          redPos,
          redOri,
          MotionColor.RED,
          builderState.gridMode
        );

      return {
        id: "builder-start",
        motions,
        gridMode: builderState.gridMode,
        stepNumber: 0,
      };
    }
  );

  // Build PictographData for each step index (with stepNumber and letter)
  const stepPictographs = $derived.by(
    (): (PictographData & { stepNumber: number })[] => {
      const result: (PictographData & { stepNumber: number })[] = [];
      for (let i = 0; i < totalSteps; i++) {
        const blueStep = builderState.blueSteps[i];
        const redStep = builderState.redSteps[i];

        const motions: PictographData["motions"] = {};
        if (blueStep)
          motions[MotionColor.BLUE] = stepToMotion(
            blueStep,
            MotionColor.BLUE,
            builderState.gridMode
          );
        if (redStep)
          motions[MotionColor.RED] = stepToMotion(
            redStep,
            MotionColor.RED,
            builderState.gridMode
          );

        const key = pairKey(i);
        const resolvedLetter = key
          ? (letterCache.get(key) ?? undefined)
          : undefined;

        result.push({
          id: `builder-step-${i}`,
          motions,
          gridMode: builderState.gridMode,
          letter: resolvedLetter,
          stepNumber: i + 1,
        });
      }
      return result;
    }
  );

  const hasContent = $derived(totalSteps > 0 || startPictograph !== null);
</script>

<div
  class="step-strip-container"
  class:has-steps={hasContent}
  aria-label="Sequence history"
>
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
            {#if pairKey(idx) && pendingLetters.has(pairKey(idx)!)}
              <span
                class="letter-skeleton"
                aria-hidden="true"
                title="Resolving letter"
              ></span>
            {/if}
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
    min-height: 78px;
    height: 78px;
    display: flex;
    justify-content: center;
  }

  .step-strip-scroll {
    overflow-x: auto;
    max-width: 100%;
    padding: 4px var(--settings-spacing-sm, 8px);
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2))
      transparent;
  }

  .step-strip-row {
    display: flex;
    gap: 6px;
    justify-content: flex-start;
  }

  .step-cell {
    position: relative;
    flex-shrink: 0;
    width: 68px;
    height: 68px;
  }

  .step-cell :global(svg) {
    width: 100%;
    height: 100%;
    border-radius: 6px;
  }

  .start-cell {
    opacity: 0.7;
  }

  /* Letter-resolving skeleton: a soft shimmer where the TKA glyph will land,
     so the cell doesn't pop the letter in without warning. */
  .letter-skeleton {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 38%;
    height: 14px;
    border-radius: 7px;
    background: linear-gradient(
      90deg,
      var(--theme-card-bg, rgba(255, 255, 255, 0.06)) 25%,
      var(--theme-card-bg-hover, rgba(255, 255, 255, 0.14)) 50%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.06)) 75%
    );
    background-size: 200% 100%;
    animation: letter-shimmer 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes letter-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @container tool-panel (max-width: 768px) {
    .step-strip-container {
      height: 66px;
      min-height: 66px;
    }

    .step-cell {
      width: 56px;
      height: 56px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .letter-skeleton {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
