<script lang="ts">
  import AnimationPlayer from "$lib/shared/sequence-viewer/components/AnimationPlayer.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { MotionType, MotionColor, Orientation, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

  let {
    blueStart,
    blueEnd,
    redStart,
    redEnd,
    motionType,
  }: {
    blueStart: GridLocation;
    blueEnd: GridLocation;
    redStart: GridLocation;
    redEnd: GridLocation;
    motionType: "shift" | "dash" | "static";
  } = $props();

  function makeMotion(
    color: MotionColor,
    start: GridLocation,
    end: GridLocation,
  ): MotionData {
    return {
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: start,
      endLocation: end,
      color,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      isVisible: true,
      propType: PropType.HAND,
      gridMode: GridMode.DIAMOND,
      arrowLocation: start,
      arrowPlacementData: {
        positionX: 0, positionY: 0, rotationAngle: 0,
        coordinates: null, svgCenter: null, svgMirrored: false,
        manualAdjustmentX: 0, manualAdjustmentY: 0,
      },
      propPlacementData: { positionX: 0, positionY: 0, rotationAngle: 0 },
    };
  }

  const startPosition: StartPositionData = {
    isStartPosition: true as const,
    id: `guide-${motionType}-start`,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: makeMotion(MotionColor.BLUE, blueStart, blueStart),
      red: makeMotion(MotionColor.RED, redStart, redStart),
    },
  };

  const step: StepData = {
    isStep: true as const,
    id: `guide-${motionType}-step1`,
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: makeMotion(MotionColor.BLUE, blueStart, blueEnd),
      red: makeMotion(MotionColor.RED, redStart, redEnd),
    },
  };

  const sequence = createSequenceData({
    id: `guide-motion-${motionType}`,
    name: motionType,
    word: motionType,
    steps: [step],
    startPosition,
    gridMode: GridMode.DIAMOND,
  });
</script>

<div class="guide-motion-demo">
  <AnimationPlayer
    {sequence}
    autoPlay={true}
    showControls={false}
    hideProgressBar={true}
    hideWordHeader={true}
    bluePropType={PropType.HAND}
    redPropType={PropType.HAND}
  />
</div>

<style>
  .guide-motion-demo {
    width: 100%;
    max-width: 360px;
    aspect-ratio: 1;
    margin: 0 auto;
  }
</style>
