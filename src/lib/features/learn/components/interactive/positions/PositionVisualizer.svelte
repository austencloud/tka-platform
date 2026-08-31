<!--
PositionVisualizer - Renders a real pictograph showing a static position.
Uses PictographContainer (the actual pictograph renderer) instead of custom SVG.
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    GridLocation,
    GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    HandSide,
    MotionType,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  type PositionType = "alpha" | "beta" | "gamma";

  let {
    leftHand = "N",
    rightHand = "S",
    gridMode = GridMode.DIAMOND,
    showLetter = true,
  }: {
    leftHand?: HandPosition;
    rightHand?: HandPosition;
    gridMode?: GridMode;
    showLetter?: boolean;
  } = $props();

  // Map HandPosition strings to GridLocation enum values
  const HAND_TO_LOCATION: Record<HandPosition, GridLocation> = {
    N: GridLocation.NORTH,
    E: GridLocation.EAST,
    S: GridLocation.SOUTH,
    W: GridLocation.WEST,
    NE: GridLocation.NORTHEAST,
    SE: GridLocation.SOUTHEAST,
    SW: GridLocation.SOUTHWEST,
    NW: GridLocation.NORTHWEST,
  };

  // Position type detection
  const OPPOSITE_PAIRS: Record<string, string> = {
    N: "S", S: "N", E: "W", W: "E",
    NE: "SW", SW: "NE", NW: "SE", SE: "NW",
  };

  const positionType: PositionType = $derived.by(() => {
    if (leftHand === rightHand) return "beta";
    if (OPPOSITE_PAIRS[leftHand] === rightHand) return "alpha";
    return "gamma";
  });

  // Map position type to the Type 6 static letter
  const POSITION_LETTER: Record<PositionType, Letter> = {
    alpha: Letter.ALPHA,
    beta: Letter.BETA,
    gamma: Letter.GAMMA,
  };

  // Build PictographData from hand positions
  const pictographData: PictographData = $derived.by(() => ({
    id: "position-visualizer",
    letter: showLetter ? POSITION_LETTER[positionType] : null,
    startPosition: null,
    endPosition: null,
    gridMode,
    motions: {
      left: createMotionData({
        motionType: MotionType.STATIC,
        rotationDirection: RotationDirection.NO_ROTATION,
        startLocation: HAND_TO_LOCATION[leftHand],
        endLocation: HAND_TO_LOCATION[leftHand],
        turns: 0,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        isVisible: true,
        propType: PropType.HAND,
        arrowLocation: HAND_TO_LOCATION[leftHand],
        color: HandSide.LEFT,
        gridMode,
      }),
      right: createMotionData({
        motionType: MotionType.STATIC,
        rotationDirection: RotationDirection.NO_ROTATION,
        startLocation: HAND_TO_LOCATION[rightHand],
        endLocation: HAND_TO_LOCATION[rightHand],
        turns: 0,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        isVisible: true,
        propType: PropType.HAND,
        arrowLocation: HAND_TO_LOCATION[rightHand],
        color: HandSide.RIGHT,
        gridMode,
      }),
    },
  }));
</script>

<div class="position-visualizer">
  <PictographContainer
    {pictographData}
    gridMode={gridMode}
    showTKA={showLetter}
    showReversals={false}
    showTnD={false}
    showElemental={false}
    showPositions={false}
    disableTransitions={true}
    cellIndex={0}
    leftPropTypeOverride={PropType.HAND}
    rightPropTypeOverride={PropType.HAND}
  />
</div>

<style>
  .position-visualizer {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    max-width: 320px;
    aspect-ratio: 1;
  }
</style>
