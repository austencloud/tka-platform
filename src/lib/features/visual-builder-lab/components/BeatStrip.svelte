<!--
  BeatStrip.svelte - Horizontal strip of real pictographs

  Shows one PictographContainer per beat index. Blue beats fill in first,
  red beats overlay onto existing pictographs when the second hand
  is built. Always reserves vertical space to prevent grid resizing.

  New cells animate in with a scale transition.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import {
    MotionColor,
    MotionType,
    RotationDirection,
    HandMotionType,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { HandPathMotionCalculator } from "$lib/features/create/assemble/services/HandPathMotionCalculator";
  import type { VisualBuilderState, BuilderBeat } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const pathCalculator = new HandPathMotionCalculator();

  /** Derive MotionType (PRO/ANTI/DASH/STATIC) from beat data */
  function resolveMotionType(beat: BuilderBeat): MotionType {
    const handMotionType = pathCalculator.calculateMotionType(
      beat.startPosition, beat.endPosition, builderState.gridMode,
    );
    switch (handMotionType) {
      case HandMotionType.STATIC:
        return MotionType.STATIC;
      case HandMotionType.DASH:
        return MotionType.DASH;
      case HandMotionType.SHIFT: {
        const handPathDir = pathCalculator.calculateRotationDirection(
          beat.startPosition, beat.endPosition, builderState.gridMode,
        );
        return handPathDir === beat.rotationDirection ? MotionType.PRO : MotionType.ANTI;
      }
      default:
        return MotionType.STATIC;
    }
  }

  /** Convert a BuilderBeat into a MotionData for the pictograph pipeline */
  function beatToMotion(beat: BuilderBeat, color: MotionColor) {
    const motionType = resolveMotionType(beat);
    const resolvedRotation = (beat.startPosition === beat.endPosition)
      ? RotationDirection.NO_ROTATION
      : beat.rotationDirection;

    return createMotionData({
      color,
      startLocation: beat.startPosition,
      endLocation: beat.endPosition,
      motionType,
      rotationDirection: resolvedRotation,
      turns: beat.turnCount,
      startOrientation: beat.startOrientation,
      endOrientation: beat.endOrientation,
      gridMode: builderState.gridMode,
      arrowLocation: beat.startPosition,
      isVisible: true,
    });
  }

  // Total beat count = max of both hands
  const totalBeats = $derived(
    Math.max(builderState.blueBeats.length, builderState.redBeats.length)
  );

  // Build PictographData for each beat index
  const beatPictographs = $derived.by((): PictographData[] => {
    const result: PictographData[] = [];
    for (let i = 0; i < totalBeats; i++) {
      const blueBeat = builderState.blueBeats[i];
      const redBeat = builderState.redBeats[i];

      const motions: PictographData["motions"] = {};
      if (blueBeat) motions[MotionColor.BLUE] = beatToMotion(blueBeat, MotionColor.BLUE);
      if (redBeat) motions[MotionColor.RED] = beatToMotion(redBeat, MotionColor.RED);

      result.push({
        id: `builder-beat-${i}`,
        motions,
        gridMode: builderState.gridMode,
      });
    }
    return result;
  });

  const hasBeats = $derived(totalBeats > 0);
</script>

<div class="beat-strip-container" class:has-beats={hasBeats}>
  {#if hasBeats}
    <div class="beat-strip-scroll">
      <div class="beat-strip-row">
        {#each beatPictographs as pictograph, idx (pictograph.id)}
          <div
            class="beat-cell"
            animate:flip={{ duration: 250 }}
            in:scale={{ duration: 250, start: 0.5, opacity: 0 }}
          >
            <PictographContainer
              pictographData={pictograph}
              gridMode={builderState.gridMode}
              disableTransitions={true}
              showTKA={false}
              showReversals={false}
              showPositions={false}
              showVTG={false}
              showElemental={false}
            />
            <span class="beat-label">{idx + 1}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .beat-strip-container {
    flex-shrink: 0;
    width: 100%;
    min-height: 50px;
    display: flex;
    justify-content: center;
    transition: min-height 0.25s ease;
  }

  .beat-strip-container.has-beats {
    min-height: 100px;
  }

  .beat-strip-scroll {
    overflow-x: auto;
    max-width: 100%;
    padding: 4px 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .beat-strip-row {
    display: flex;
    gap: 6px;
    justify-content: center;
  }

  .beat-cell {
    position: relative;
    flex-shrink: 0;
    width: 90px;
    height: 90px;
  }

  .beat-cell :global(svg) {
    width: 100%;
    height: 100%;
    border-radius: 6px;
  }

  .beat-label {
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .beat-strip-container {
      transition: none;
    }
  }
</style>
