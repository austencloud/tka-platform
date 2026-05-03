<script lang="ts">

import { getSequenceTransformer } from "$lib/features/create/shared/getSequenceTransformer";
import { getAnimationPlaybackController } from "$lib/features/compose/getAnimationPlaybackController";

  import { onMount, onDestroy, tick } from "svelte";
  import AnimatorCanvas from "./AnimatorCanvas.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
  import type { StartPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import type { EndState } from "$lib/features/landing/services/contracts/types";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { getBrowseLoader } from "$lib/features/browse/sequences/display/getBrowseLoader";
  import {
    animationSettings,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { EndlessSpinnerOrchestrator } from "$lib/features/landing/services/implementations/EndlessSpinnerOrchestrator";
  import { generationOrchestrator } from "$lib/features/create/generate/shared/services/implementations/GenerationOrchestrator";
  import { startPositionDeriver as startPositionDeriverDirect } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import { orientationCalculator as orientationCalculatorDirect } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
  import { gridPositionDeriver as gridPositionDeriverDirect } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  /**
   * Apply prop type to all motions in sequence data.
   */
  function applyPropTypeToSequence(
    sequence: SequenceData,
    propType: PropType
  ): SequenceData {
    const applyToMotions = (data: StepData | StartPositionData) => {
      if (!data.motions) return data;
      return {
        ...data,
        motions: {
          blue: data.motions.blue
            ? { ...data.motions.blue, propType }
            : undefined,
          red: data.motions.red ? { ...data.motions.red, propType } : undefined,
        },
      };
    };

    return {
      ...sequence,
      startPosition: sequence.startPosition
        ? (applyToMotions(sequence.startPosition) as StartPositionData)
        : undefined,
      steps:
        sequence.steps?.map((step) => applyToMotions(step) as StepData) ?? [],
    };
  }

  // Props
  interface Props {
    propType?: PropType;
    darkMode?: boolean;
    onSequenceChange?: (sequence: SequenceData) => void;
  }

  let { propType = PropType.STAFF, darkMode = true, onSequenceChange }: Props =
    $props();

  // Animation state
  const animationState = createAnimationPanelState();
  let playbackController: AnimationPlaybackController | null = null;
  let startPositionDeriver: StartPositionDeriver | null = null;
  let spinnerOrchestrator: EndlessSpinnerOrchestrator | null = null;

  let isReady = $state(false);
  let isLoading = $state(false);
  let hasError = $state(false);
  let currentSequence = $state<SequenceData | null>(null);

  // Track when sequence completes to chain next
  let lastCompletedBeat = $state(-1);

  // Visibility manager for dark mode
  const visibilityManager = getAnimationVisibilityManager();

  // Derived start position
  let derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData || !startPositionDeriver) return null;
    return startPositionDeriver.getOrDeriveStartPosition(
      animationState.sequenceData
    );
  });

  // Current letter for AnimatorCanvas
  let currentLetter = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentStep = animationState.currentStep;

    if (currentStep < 1) {
      return derivedStartPosition?.letter || null;
    }

    if (animationState.sequenceData.steps?.length > 0) {
      const stepIndex = Math.floor(currentStep) - 1;
      const clampedIndex = Math.max(
        0,
        Math.min(stepIndex, animationState.sequenceData.steps.length - 1)
      );
      return animationState.sequenceData.steps[clampedIndex]?.letter || null;
    }

    return null;
  });

  // Current step data for AnimatorCanvas
  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentStep = animationState.currentStep;

    if (currentStep < 1) {
      return derivedStartPosition || null;
    }

    if (animationState.sequenceData.steps?.length > 0) {
      const stepIndex = Math.floor(currentStep) - 1;
      const clampedIndex = Math.max(
        0,
        Math.min(stepIndex, animationState.sequenceData.steps.length - 1)
      );
      return animationState.sequenceData.steps[clampedIndex] || null;
    }

    return null;
  });

  let gridMode = $derived(animationState.sequenceData?.gridMode ?? null);

  // Watch for sequence completion - when we loop back to beat 1
  $effect(() => {
    const current = Math.floor(animationState.currentStep);
    const total = animationState.totalSteps;

    // Detect when we've completed a full cycle and looped back
    if (
      lastCompletedBeat >= total - 1 &&
      current <= 1 &&
      isReady &&
      !isLoading
    ) {
      // Sequence completed - chain to next
      chainNextSequence();
    }

    lastCompletedBeat = current;
  });

  // Apply dark mode setting
  $effect(() => {
    visibilityManager.setDarkMode(darkMode);
  });

  onMount(async () => {
    try {
      animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS);

      // Get services from DI container (some still need others use direct imports)
      playbackController = getAnimationPlaybackController();
      startPositionDeriver = startPositionDeriverDirect;
      const browseLoader = getBrowseLoader();
      const sequenceTransformer = getSequenceTransformer();

      // Create the spinner orchestrator
      spinnerOrchestrator = new EndlessSpinnerOrchestrator(
        browseLoader,
        generationOrchestrator,
        sequenceTransformer,
        startPositionDeriverDirect,
        orientationCalculatorDirect,
        gridPositionDeriverDirect
      );

      // Initialize the orchestrator
      await spinnerOrchestrator.initialize();

      // Load initial sequence
      const initialSequence = await spinnerOrchestrator.getInitialSequence();
      if (initialSequence) {
        await playSequence(initialSequence);
        isReady = true;
      } else {
        hasError = true;
      }
    } catch (err) {
      console.error("[EndlessSpinner] Failed to initialize:", err);
      hasError = true;
    }
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  /**
   * Chain to the next sequence when current one completes.
   */
  async function chainNextSequence() {
    if (!spinnerOrchestrator || !currentSequence || isLoading) return;

    isLoading = true;

    try {
      // Extract end state from current sequence
      const endState = extractEndState(currentSequence);

      // Get next matching sequence
      const nextSequence = await spinnerOrchestrator.getNextSequence(endState);
      if (nextSequence) {
        await playSequence(nextSequence);
      } else {
        // Fallback to random
        const fallback = await spinnerOrchestrator.getInitialSequence();
        if (fallback) {
          await playSequence(fallback);
        }
      }
    } catch (err) {
      console.error("[EndlessSpinner] Failed to chain sequence:", err);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Extract the end state from a sequence's last beat.
   */
  function extractEndState(sequence: SequenceData): EndState {
    const lastStep = sequence.steps?.[sequence.steps.length - 1];

    return {
      position: lastStep?.endPosition ?? null,
      blueOrientation:
        (lastStep?.motions?.blue?.endOrientation as Orientation) ?? null,
      redOrientation:
        (lastStep?.motions?.red?.endOrientation as Orientation) ?? null,
    };
  }

  /**
   * Play a sequence with the animation controller.
   */
  async function playSequence(sequence: SequenceData) {
    if (!playbackController) return;

    // Stop current playback
    if (animationState.isPlaying) {
      playbackController.togglePlayback();
    }
    animationState.reset();

    // Apply prop type override
    const sequenceWithProps = applyPropTypeToSequence(sequence, propType);

    // Store current sequence
    currentSequence = sequenceWithProps;

    // Notify parent
    onSequenceChange?.(sequenceWithProps);

    // Initialize playback
    animationState.setShouldLoop(true); // Loop to trigger chain detection
    const success = playbackController.initialize(
      sequenceWithProps,
      animationState
    );

    if (!success) {
      console.error("[EndlessSpinner] Failed to initialize playback");
      return;
    }

    // Reset completion tracking
    lastCompletedBeat = -1;

    await tick();

    // Start continuous playback
    animationState.setPlaybackMode("continuous");
    animationState.setCurrentStep(1);
    playbackController.togglePlayback();
  }

  /**
   * Hot swap prop type on current sequence.
   */
  export function changePropType(newPropType: PropType) {
    if (animationState.sequenceData) {
      const updated = applyPropTypeToSequence(
        animationState.sequenceData,
        newPropType
      );
      animationState.setSequenceData(updated);
    }
  }
</script>

<div class="endless-spinner">
  {#if isReady && !hasError}
    <div class="canvas-wrapper">
      <AnimatorCanvas
        blueProp={animationState.bluePropState}
        redProp={animationState.redPropState}
        gridVisible={true}
        {gridMode}
        letter={currentLetter}
        stepData={currentStepData}
        sequenceData={animationState.sequenceData}
        isPlaying={animationState.isPlaying}
        trailSettings={animationSettings.trail}
        bluePropType={propType}
        redPropType={propType}
      />
    </div>
  {:else if hasError}
    <div class="error-state">
      <span class="error-icon">!</span>
      <span>Unable to load animations</span>
    </div>
  {:else}
    <div class="loading-state">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <span>Loading animation...</span>
    </div>
  {/if}
</div>

<style>
  .endless-spinner {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .canvas-wrapper {
    width: 100%;
    height: 100%;
    border-radius: 16px;
    overflow: hidden;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    height: 100%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-radius: 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--semantic-error, #ef4444);
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
  }

</style>
