<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { MotionType, MotionColor, Orientation, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
  import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceAnimationOrchestrator";
  import { AnimationStateManager } from "$lib/shared/animation-engine/services/implementations/AnimationStateManager";
  import { PropInterpolator } from "$lib/shared/animation-engine/services/implementations/PropInterpolator";
  import { EndpointCalculator } from "$lib/shared/animation-engine/services/implementations/EndpointCalculator";
  import { createAngleCalculator } from "$lib/shared/animation-engine/services/angle-calculator";
  import { AnimationLoop } from "$lib/shared/animation-engine/services/implementations/AnimationLoop";
  import { SequenceViewerVisibilityState } from "$lib/shared/sequence-viewer/state/viewer-visibility-state.svelte";
  import { setViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

  let {
    start,
    end,
    motionType,
  }: {
    start: GridLocation;
    end: GridLocation;
    motionType: MotionType;
  } = $props();

  // Show only the red hand (right-handed lead)
  const visibilityState = new SequenceViewerVisibilityState();
  visibilityState.setBlueMotion(false);
  setViewerVisibilityContext(visibilityState);

  const animState = createAnimationPanelState();
  let controller = $state<AnimationPlaybackController | null>(null);

  function makeMotion(color: MotionColor, startLoc: GridLocation, endLoc: GridLocation, type: MotionType): MotionData {
    return {
      motionType: type,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: startLoc,
      endLocation: endLoc,
      color,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      isVisible: true,
      propType: PropType.HAND,
      gridMode: GridMode.DIAMOND,
      pathShape: "linear",
      arrowLocation: startLoc,
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
      blue: makeMotion(MotionColor.BLUE, start, start, MotionType.STATIC),
      red: makeMotion(MotionColor.RED, start, start, MotionType.STATIC),
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
      blue: makeMotion(MotionColor.BLUE, start, start, MotionType.STATIC),
      red: makeMotion(MotionColor.RED, start, end, motionType),
    },
  };

  const sequence = createSequenceData({
    id: `guide-motion-${motionType}-${start}-${end}`,
    name: `${motionType}`,
    word: `${motionType}`,
    steps: [step],
    startPosition,
    gridMode: GridMode.DIAMOND,
  });

  const isPlaying = $derived(animState.isPlaying);
  const currentStep = $derived(animState.currentStep);
  const bluePropState = $derived(animState.bluePropState);
  const redPropState = $derived(animState.redPropState);

  const stepData = $derived.by(() => {
    const seq = animState.sequenceData;
    if (!seq) return null;
    if (currentStep < 1) return seq.startPosition ?? null;
    const idx = Math.min(Math.max(0, Math.floor(currentStep) - 1), (seq.steps?.length ?? 1) - 1);
    return seq.steps?.[idx] ?? null;
  });

  onMount(() => {
    const angleCalc = createAngleCalculator();
    const endpointCalc = new EndpointCalculator(angleCalc);
    const propInterp = new PropInterpolator(createAngleCalculator(), endpointCalc);
    const orchestrator = new SequenceAnimationOrchestrator(new AnimationStateManager(), propInterp);
    const loop = new AnimationLoop();
    const ctrl = new AnimationPlaybackController(orchestrator, loop);

    animState.setShouldLoop(true);
    const ok = ctrl.initialize(sequence, animState);
    if (ok) {
      setTimeout(() => ctrl.togglePlayback(), 300);
    }

    controller = ctrl;
  });

  onDestroy(() => {
    controller?.dispose();
    animState.dispose();
  });
</script>

{#if typeof window !== 'undefined'}
  <div class="guide-motion-demo">
    <AnimatorCanvas
      blueProp={bluePropState}
      redProp={redPropState}
      gridVisible={true}
      gridMode={GridMode.DIAMOND}
      stepData={stepData}
      sequenceData={sequence}
      {currentStep}
      {isPlaying}
      word={null}
      bluePropType={PropType.HAND}
      redPropType={PropType.HAND}
      hideProgressBar={true}
      hideStepNumbers={true}
      disableContextMenu={true}
      fillContainer={true}
      showNonRadialPoints={false}
    />
  </div>
{/if}

<style>
  .guide-motion-demo {
    width: 100%;
    aspect-ratio: 1;
  }
</style>
